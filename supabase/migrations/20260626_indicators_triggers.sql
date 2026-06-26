-- ============================================================
-- GovCorp — Módulo Indicadores & Gatilhos (Semáforos)
-- Adaptado à realidade do GovCorp: client_id é TEXT; isolamento
-- multi-empresa via secretary_clients; Assistente sem acesso;
-- Conselheiro apenas leitura. Disciplina do linter: funções com
-- search_path fixo e objetos qualificados (zero warnings).
-- ============================================================

-- ── Helpers de JWT (search_path travado p/ linter) ──────────
create or replace function public.jwt_role() returns text
language sql stable set search_path = '' as $$
  select auth.jwt() -> 'user_metadata' ->> 'role'
$$;

create or replace function public.jwt_client_id() returns text
language sql stable set search_path = '' as $$
  select auth.jwt() -> 'user_metadata' ->> 'client_id'
$$;

create or replace function public.jwt_secretary_clients() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'user_metadata' -> 'secretary_clients', '[]'::jsonb)
$$;

create or replace function public.can_read_governance() returns boolean
language sql stable set search_path = '' as $$
  select public.jwt_role() in ('SuperAdmin','Administrador','Secretário','Conselheiro')
$$;

create or replace function public.can_write_governance() returns boolean
language sql stable set search_path = '' as $$
  select public.jwt_role() in ('SuperAdmin','Administrador','Secretário')
$$;

-- Visível ao tenant: SuperAdmin tudo; cliente "casa"; ou clientes atribuídos (multi-empresa)
create or replace function public.gov_tenant_visible(row_client_id text) returns boolean
language sql stable set search_path = '' as $$
  select public.jwt_role() = 'SuperAdmin'
      or row_client_id = public.jwt_client_id()
      or (public.jwt_secretary_clients() ? row_client_id)
$$;

-- ── Tabelas ─────────────────────────────────────────────────
create table if not exists public.indicators (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null,
  name        text not null,
  unit        text,
  description text,
  direction   text not null default 'higher_is_better'
              check (direction in ('higher_is_better','lower_is_better')),
  category    text,
  active      boolean not null default true,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.indicator_readings (
  id           uuid primary key default gen_random_uuid(),
  client_id    text not null,
  indicator_id uuid not null references public.indicators(id) on delete cascade,
  period       date not null,
  value        numeric not null,
  source       text,
  entered_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (indicator_id, period)
);

create table if not exists public.triggers (
  id                        uuid primary key default gen_random_uuid(),
  client_id                 text not null,
  indicator_id              uuid not null references public.indicators(id) on delete cascade,
  name                      text not null,
  operator                  text not null
                            check (operator in ('gt','gte','lt','lte','outside','inside')),
  threshold_value           numeric not null,
  threshold_value_secondary numeric,
  severity                  text not null check (severity in ('attention','critical')),
  create_action_on_breach   boolean not null default true,
  notify_on_breach          boolean not null default true,
  assignee_member_id        uuid,
  active                    boolean not null default true,
  created_by                uuid default auth.uid(),
  created_at                timestamptz not null default now(),
  constraint range_needs_two_values check (
    operator not in ('outside','inside') or threshold_value_secondary is not null
  )
);

-- Eventos: inseridos SOMENTE pela Edge Function (service role). Sem policy de INSERT p/ authenticated.
create table if not exists public.trigger_events (
  id                   uuid primary key default gen_random_uuid(),
  client_id            text not null,
  trigger_id           uuid not null references public.triggers(id) on delete cascade,
  indicator_reading_id uuid not null references public.indicator_readings(id) on delete cascade,
  observed_value       numeric not null,
  severity             text not null check (severity in ('attention','critical')),
  status               text not null default 'open' check (status in ('open','acknowledged','resolved')),
  generated_action_id  text,
  fired_at             timestamptz not null default now(),
  resolved_by          uuid,
  resolved_at          timestamptz,
  notes                text,
  unique (trigger_id, indicator_reading_id)
);

-- ── Índices ─────────────────────────────────────────────────
create index if not exists idx_readings_indicator_period on public.indicator_readings (indicator_id, period desc);
create index if not exists idx_readings_client            on public.indicator_readings (client_id);
create index if not exists idx_triggers_indicator         on public.triggers (indicator_id) where active;
create index if not exists idx_events_status              on public.trigger_events (client_id, status);
create index if not exists idx_indicators_client          on public.indicators (client_id) where active;

-- ── Avaliação determinística ────────────────────────────────
create or replace function public.eval_breach(v numeric, op text, t1 numeric, t2 numeric)
returns boolean language sql immutable set search_path = '' as $$
  select case op
    when 'gt'      then v >  t1
    when 'gte'     then v >= t1
    when 'lt'      then v <  t1
    when 'lte'     then v <= t1
    when 'outside' then v < least(t1,t2) or v > greatest(t1,t2)
    when 'inside'  then v >= least(t1,t2) and v <= greatest(t1,t2)
    else false
  end
$$;

-- Gatilhos rompidos por uma leitura — só a Edge Function (service role) chama
create or replace function public.breached_triggers_for_reading(p_reading_id uuid)
returns setof public.triggers
language sql stable security definer set search_path = '' as $$
  select t.*
  from public.indicator_readings r
  join public.triggers t
    on  t.indicator_id = r.indicator_id
    and t.client_id    = r.client_id
    and t.active
    and public.eval_breach(r.value, t.operator, t.threshold_value, t.threshold_value_secondary)
  where r.id = p_reading_id
$$;
revoke all on function public.breached_triggers_for_reading(uuid) from public, anon, authenticated;

-- View do semáforo: pior severidade rompida na leitura mais recente
create or replace view public.indicator_current_status
with (security_invoker = on) as
with latest as (
  select distinct on (indicator_id)
    indicator_id, client_id, value, period, id as reading_id
  from public.indicator_readings
  order by indicator_id, period desc, created_at desc
)
select
  i.id        as indicator_id,
  i.client_id,
  i.name,
  i.unit,
  i.direction,
  i.category,
  l.value     as current_value,
  l.period    as current_period,
  coalesce((
    select max(case t.severity when 'critical' then 2 when 'attention' then 1 else 0 end)
    from public.triggers t
    where t.indicator_id = i.id and t.active
      and public.eval_breach(l.value, t.operator, t.threshold_value, t.threshold_value_secondary)
  ), 0) as breach_level
from public.indicators i
left join latest l on l.indicator_id = i.id
where i.active;

-- ── RLS ─────────────────────────────────────────────────────
alter table public.indicators         enable row level security;
alter table public.indicator_readings enable row level security;
alter table public.triggers           enable row level security;
alter table public.trigger_events     enable row level security;

drop policy if exists indicators_select on public.indicators;
create policy indicators_select on public.indicators for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists indicators_write on public.indicators;
create policy indicators_write on public.indicators for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

drop policy if exists readings_select on public.indicator_readings;
create policy readings_select on public.indicator_readings for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists readings_write on public.indicator_readings;
create policy readings_write on public.indicator_readings for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

drop policy if exists triggers_select on public.triggers;
create policy triggers_select on public.triggers for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists triggers_write on public.triggers;
create policy triggers_write on public.triggers for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

drop policy if exists events_select on public.trigger_events;
create policy events_select on public.trigger_events for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists events_update on public.trigger_events;
create policy events_update on public.trigger_events for update to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );
-- (sem INSERT/DELETE p/ authenticated → eventos nascem só via Edge Function/service role)

-- ── Grants (RLS continua restringindo as linhas) ────────────
grant select, insert, update, delete on public.indicators         to authenticated;
grant select, insert, update, delete on public.indicator_readings to authenticated;
grant select, insert, update, delete on public.triggers           to authenticated;
grant select, update                 on public.trigger_events      to authenticated;
grant select on public.indicator_current_status to authenticated;
