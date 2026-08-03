-- ============================================================
-- Boardplan — CRM: changelog auditável por negócio
--
-- Registro imutável de alterações do negócio (quem mudou o quê e quando),
-- capturado por GATILHO no banco — não depende do frontend, então cobre
-- qualquer origem (kanban, detalhe, transferência em massa, importação) e
-- não pode ser forjado (sem policy de INSERT; grava só o trigger DEFINER).
--
-- Leitura liberada a quem acessa o CRM do tenant (Comercial inclusive), para
-- ver o histórico do próprio negócio. Nome de quem alterou é gravado no
-- evento (snapshot), então aparece mesmo para o Comercial (que não lê a
-- lista de membros).
-- Aditiva e idempotente.
-- ============================================================

create table if not exists public.crm_deal_events (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null,
  deal_id     uuid not null references public.crm_deals(id) on delete cascade,
  kind        text not null,          -- created | stage | value | status | owner | title
  description text not null,
  actor_id    uuid,
  actor_name  text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_crm_deal_events_deal on public.crm_deal_events (deal_id, created_at desc);

alter table public.crm_deal_events enable row level security;

drop policy if exists crm_deal_events_select on public.crm_deal_events;
create policy crm_deal_events_select on public.crm_deal_events for select to authenticated
  using ( public.can_access_crm(client_id) );
-- (sem policy de INSERT/UPDATE/DELETE → eventos nascem só pelo gatilho DEFINER)

grant select on public.crm_deal_events to authenticated;

-- ── Gatilho de changelog ────────────────────────────────────
create or replace function public.crm_deals_changelog() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_actor      uuid := auth.uid();
  v_actor_name text;
  v_old        text;
  v_new        text;
  fmt_status   text[] := array['open','Aberto','won','Ganho','lost','Perdido'];
begin
  select name into v_actor_name from public.members where id = v_actor;

  if tg_op = 'INSERT' then
    insert into public.crm_deal_events (client_id, deal_id, kind, description, actor_id, actor_name)
    values (new.client_id, new.id, 'created', 'Negócio criado', v_actor, v_actor_name);
    return new;
  end if;

  -- Etapa
  if new.stage_id is distinct from old.stage_id then
    select name into v_old from public.crm_stages where id = old.stage_id;
    select name into v_new from public.crm_stages where id = new.stage_id;
    insert into public.crm_deal_events (client_id, deal_id, kind, description, actor_id, actor_name)
    values (new.client_id, new.id, 'stage', 'Etapa: ' || coalesce(v_old, '—') || ' → ' || coalesce(v_new, '—'), v_actor, v_actor_name);
  end if;

  -- Valor
  if new.value is distinct from old.value then
    insert into public.crm_deal_events (client_id, deal_id, kind, description, actor_id, actor_name)
    values (new.client_id, new.id, 'value',
      'Valor: R$ ' || to_char(coalesce(old.value, 0), 'FM999999990.00') || ' → R$ ' || to_char(coalesce(new.value, 0), 'FM999999990.00'),
      v_actor, v_actor_name);
  end if;

  -- Status
  if new.status is distinct from old.status then
    insert into public.crm_deal_events (client_id, deal_id, kind, description, actor_id, actor_name)
    values (new.client_id, new.id, 'status',
      'Status: ' || coalesce((select fmt_status[i+1] from generate_subscripts(fmt_status, 1) i where fmt_status[i] = old.status), old.status)
        || ' → ' || coalesce((select fmt_status[i+1] from generate_subscripts(fmt_status, 1) i where fmt_status[i] = new.status), new.status),
      v_actor, v_actor_name);
  end if;

  -- Responsável
  if new.owner_member_id is distinct from old.owner_member_id then
    select name into v_old from public.members where id = old.owner_member_id;
    select name into v_new from public.members where id = new.owner_member_id;
    insert into public.crm_deal_events (client_id, deal_id, kind, description, actor_id, actor_name)
    values (new.client_id, new.id, 'owner', 'Responsável: ' || coalesce(v_old, '—') || ' → ' || coalesce(v_new, '—'), v_actor, v_actor_name);
  end if;

  -- Título
  if new.title is distinct from old.title then
    insert into public.crm_deal_events (client_id, deal_id, kind, description, actor_id, actor_name)
    values (new.client_id, new.id, 'title', 'Título: "' || old.title || '" → "' || new.title || '"', v_actor, v_actor_name);
  end if;

  return new;
end $$;

drop trigger if exists trg_crm_deals_changelog on public.crm_deals;
create trigger trg_crm_deals_changelog
  after insert or update on public.crm_deals
  for each row execute function public.crm_deals_changelog();
