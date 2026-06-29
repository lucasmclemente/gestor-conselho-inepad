-- ============================================================
-- GovCorp — Indicadores: Cenários nomeados + Reavaliação agendada
-- Cenário ativo por cliente; gatilhos por cenário; frequência do cron.
-- Aditivo e retrocompatível (gatilhos existentes viram 'Base').
-- ============================================================

-- Cenário do gatilho (retrocompatível: tudo vira 'Base')
alter table public.triggers add column if not exists scenario text not null default 'Base';

-- Configuração de governança por cliente: cenário ativo + frequência do cron
create table if not exists public.governance_settings (
  client_id        text primary key,
  active_scenario  text not null default 'Base',
  reeval_frequency text not null default 'weekly'
                   check (reeval_frequency in ('off','daily','weekly','monthly')),
  last_reeval_at   timestamptz,
  updated_at       timestamptz not null default now()
);

alter table public.governance_settings enable row level security;

drop policy if exists gov_settings_select on public.governance_settings;
create policy gov_settings_select on public.governance_settings for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists gov_settings_write on public.governance_settings;
create policy gov_settings_write on public.governance_settings for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

grant select, insert, update on public.governance_settings to authenticated;

-- Cenário ativo de um cliente (default 'Base' se não houver registro)
create or replace function public.active_scenario(p_client_id text) returns text
language sql stable set search_path = '' as $$
  select coalesce((select gs.active_scenario from public.governance_settings gs where gs.client_id = p_client_id), 'Base')
$$;

-- RPC ciente do cenário ativo
create or replace function public.breached_triggers_for_reading(p_reading_id uuid)
returns setof public.triggers
language sql stable security definer set search_path = '' as $$
  select t.*
  from public.indicator_readings r
  join public.triggers t
    on  t.indicator_id = r.indicator_id
    and t.client_id    = r.client_id
    and t.active
    and t.scenario     = public.active_scenario(r.client_id)
    and public.eval_breach(r.value, t.operator, t.threshold_value, t.threshold_value_secondary)
  where r.id = p_reading_id
$$;
revoke all on function public.breached_triggers_for_reading(uuid) from public, anon, authenticated;

-- View do semáforo ciente do cenário ativo
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
      and t.scenario = public.active_scenario(i.client_id)
      and public.eval_breach(l.value, t.operator, t.threshold_value, t.threshold_value_secondary)
  ), 0) as breach_level
from public.indicators i
left join latest l on l.indicator_id = i.id
where i.active;
