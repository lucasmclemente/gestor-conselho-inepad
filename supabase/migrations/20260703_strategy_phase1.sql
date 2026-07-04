-- ============================================================
-- GovCorp — Módulo de Planejamento Estratégico · Fase 1
-- Fundação (missão/visão/valores) + Perspectivas + Objetivos +
-- relações de causa-efeito + vínculo indicador → objetivo.
-- Reusa os helpers de RLS já criados no módulo de Indicadores
-- (jwt_role, can_read_governance, can_write_governance, gov_tenant_visible).
-- Tudo isolado por client_id (text). Aditivo e retrocompatível.
-- ============================================================

-- Fundação estratégica por cliente
create table if not exists public.strategy_framework (
  client_id       text primary key,
  mission         text,
  vision          text,
  values_text     text,
  success_factors text,
  updated_at      timestamptz not null default now()
);

-- Perspectivas do BSC (4 padrão criadas pelo app; editáveis)
create table if not exists public.perspectives (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null,
  name       text not null,
  position   int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Objetivos estratégicos por perspectiva
create table if not exists public.objectives (
  id            uuid primary key default gen_random_uuid(),
  client_id     text not null,
  perspective_id uuid references public.perspectives(id) on delete cascade,
  name          text not null,
  description   text,
  position      int not null default 0,
  progress      numeric,           -- % manual (opcional); farol vem dos indicadores
  active        boolean not null default true,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);

-- Relações de causa e efeito no mapa
create table if not exists public.objective_links (
  id            uuid primary key default gen_random_uuid(),
  client_id     text not null,
  from_objective uuid not null references public.objectives(id) on delete cascade,
  to_objective   uuid not null references public.objectives(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (from_objective, to_objective)
);

-- Indicador passa a poder medir um objetivo
alter table public.indicators add column if not exists objective_id uuid references public.objectives(id) on delete set null;

create index if not exists idx_objectives_client on public.objectives (client_id) where active;
create index if not exists idx_perspectives_client on public.perspectives (client_id) where active;
create index if not exists idx_indicators_objective on public.indicators (objective_id);

-- ── RLS ─────────────────────────────────────────────────────
alter table public.strategy_framework enable row level security;
alter table public.perspectives       enable row level security;
alter table public.objectives         enable row level security;
alter table public.objective_links    enable row level security;

drop policy if exists framework_select on public.strategy_framework;
create policy framework_select on public.strategy_framework for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists framework_write on public.strategy_framework;
create policy framework_write on public.strategy_framework for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

drop policy if exists perspectives_select on public.perspectives;
create policy perspectives_select on public.perspectives for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists perspectives_write on public.perspectives;
create policy perspectives_write on public.perspectives for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

drop policy if exists objectives_select on public.objectives;
create policy objectives_select on public.objectives for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists objectives_write on public.objectives;
create policy objectives_write on public.objectives for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

drop policy if exists objlinks_select on public.objective_links;
create policy objlinks_select on public.objective_links for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists objlinks_write on public.objective_links;
create policy objlinks_write on public.objective_links for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

grant select, insert, update, delete on public.strategy_framework to authenticated;
grant select, insert, update, delete on public.perspectives       to authenticated;
grant select, insert, update, delete on public.objectives         to authenticated;
grant select, insert, update, delete on public.objective_links    to authenticated;
