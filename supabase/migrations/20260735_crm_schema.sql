-- ============================================================
-- Boardplan — Módulo CRM interno (funil de vendas tipo Pipedrive)
--
-- Uso interno da INEPAD. Pipelines e etapas são EDITÁVEIS e é possível
-- ter VÁRIOS pipelines (crm_pipelines + crm_stages).
--
-- SEGURANÇA (reusa os helpers de governança):
--   Acesso ao CRM = can_use_crm() (papéis SuperAdmin/Administrador/Comercial)
--     E gov_tenant_visible(client_id)  -- isolamento multi-tenant
--     E crm_enabled(client_id)         -- add-on ligado só para o cliente certo
--   → Conselheiro/Secretário/Assistente NÃO acessam o CRM.
--   → Outros clientes não veem nada (flag crm_enabled desligada + tenant).
--   → O papel 'Comercial' já está blindado das tabelas de governança pela
--     migração 20260734 (restrictive policies).
--
-- Aditiva e idempotente. Aplicar em develop, testar, depois produção.
-- ============================================================

-- ── Flag do add-on por cliente (igual clicksign_enabled) ────
alter table public.clients
  add column if not exists crm_enabled boolean not null default false;

-- ── Helpers de RLS ──────────────────────────────────────────
-- Quem pode usar o CRM (papéis). Estender aqui no futuro se necessário.
create or replace function public.can_use_crm() returns boolean
language sql stable set search_path = '' as $$
  select public.jwt_role() in ('SuperAdmin','Administrador','Comercial')
$$;

-- O cliente tem o add-on ligado? SECURITY DEFINER: só devolve um booleano
-- (não vaza dado do cliente) e evita depender da RLS de clients.
create or replace function public.crm_enabled(p_client_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clients c
    where c.client_id = p_client_id and c.crm_enabled
  )
$$;
revoke all on function public.crm_enabled(text) from public, anon;
grant execute on function public.crm_enabled(text) to authenticated;

-- Predicado único de acesso ao CRM (reuso nas policies)
create or replace function public.can_access_crm(p_client_id text) returns boolean
language sql stable set search_path = '' as $$
  select public.can_use_crm()
     and public.gov_tenant_visible(p_client_id)
     and public.crm_enabled(p_client_id)
$$;

-- ── Tabelas ─────────────────────────────────────────────────
create table if not exists public.crm_pipelines (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null,
  name        text not null,
  position    int  not null default 0,
  is_default  boolean not null default false,
  active      boolean not null default true,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.crm_stages (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null,
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  name        text not null,
  position    int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.crm_organizations (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null,
  name        text not null,
  segment     text,
  website     text,
  phone       text,
  address     text,
  notes       text,
  owner_member_id uuid,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.crm_contacts (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null,
  organization_id uuid references public.crm_organizations(id) on delete set null,
  name        text not null,
  role_title  text,               -- cargo: ex. "Decisor", "Secretária"
  email       text,
  phone       text,
  notes       text,
  owner_member_id uuid,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.crm_deals (
  id            uuid primary key default gen_random_uuid(),
  client_id     text not null,
  pipeline_id   uuid not null references public.crm_pipelines(id) on delete cascade,
  stage_id      uuid not null references public.crm_stages(id)    on delete restrict,
  title         text not null,
  organization_id uuid references public.crm_organizations(id) on delete set null,
  contact_id      uuid references public.crm_contacts(id)      on delete set null,
  value         numeric not null default 0,
  currency      text not null default 'BRL',
  status        text not null default 'open' check (status in ('open','won','lost')),
  lost_reason   text,
  source        text,             -- origem do lead
  owner_member_id uuid,           -- dono do negócio (vendedor/SDR)
  expected_close_date date,
  position      int not null default 0,   -- ordem dentro da etapa (kanban)
  won_at        timestamptz,
  lost_at       timestamptz,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.crm_activities (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null,
  deal_id     uuid references public.crm_deals(id)         on delete cascade,
  contact_id  uuid references public.crm_contacts(id)      on delete set null,
  organization_id uuid references public.crm_organizations(id) on delete set null,
  type        text not null default 'task'
              check (type in ('call','meeting','email','whatsapp','task','note')),
  title       text,
  notes       text,
  due_at      timestamptz,
  done        boolean not null default false,
  done_at     timestamptz,
  owner_member_id uuid,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

-- ── Índices ─────────────────────────────────────────────────
create index if not exists idx_crm_stages_pipeline on public.crm_stages (pipeline_id, position);
create index if not exists idx_crm_deals_board      on public.crm_deals (client_id, pipeline_id, stage_id, position);
create index if not exists idx_crm_deals_owner      on public.crm_deals (owner_member_id) where status = 'open';
create index if not exists idx_crm_contacts_org     on public.crm_contacts (organization_id);
create index if not exists idx_crm_activities_deal  on public.crm_activities (deal_id);
create index if not exists idx_crm_activities_due   on public.crm_activities (client_id, due_at) where not done;

-- ── RLS ─────────────────────────────────────────────────────
-- Todas as tabelas: leitura e escrita exigem can_access_crm(client_id).
do $$
declare t text;
begin
  foreach t in array array[
    'crm_pipelines','crm_stages','crm_organizations',
    'crm_contacts','crm_deals','crm_activities'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated '
      || 'using ( public.can_access_crm(client_id) )', t||'_select', t);

    execute format('drop policy if exists %I on public.%I', t||'_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using ( public.can_access_crm(client_id) ) '
      || 'with check ( public.can_access_crm(client_id) )', t||'_write', t);

    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ── Seed: pipeline padrão da INEPAD com as 11 etapas ────────
-- Idempotente: liga o add-on, cria o pipeline "Comercial" se não houver, e
-- semeia as etapas só se o pipeline estiver vazio. Pipeline/etapas seguem
-- 100% editáveis pela aplicação depois.
do $$
declare
  v_pipeline_id uuid;
  v_stages text[] := array[
    'Não Iniciado',
    'Pesquisa/Qualificação',
    'Busca pelo Decisor (Secretária)',
    'Tentando Contato (Decisor)',
    'Contato Significativo',
    'No Show',
    'Reunião Apresentação Agendada',
    'Reunião Proposta/Diagnóstico',
    'Dúvidas Ajustes',
    'Follow-up',
    'Nutrição'
  ];
  v_name text;
  v_pos  int := 0;
begin
  update public.clients set crm_enabled = true where client_id = 'INEPAD';

  select id into v_pipeline_id
  from public.crm_pipelines
  where client_id = 'INEPAD' and name = 'Comercial'
  limit 1;

  if v_pipeline_id is null then
    insert into public.crm_pipelines (client_id, name, position, is_default)
    values ('INEPAD', 'Comercial', 0, true)
    returning id into v_pipeline_id;
  end if;

  if not exists (select 1 from public.crm_stages where pipeline_id = v_pipeline_id) then
    foreach v_name in array v_stages loop
      insert into public.crm_stages (client_id, pipeline_id, name, position)
      values ('INEPAD', v_pipeline_id, v_name, v_pos);
      v_pos := v_pos + 1;
    end loop;
  end if;
end $$;
