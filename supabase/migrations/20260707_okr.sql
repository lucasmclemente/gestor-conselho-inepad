-- ============================================================
-- GovCorp — Planejamento Estratégico · Fase 3 · OKR
-- Ciclos, objetivos, resultados-chave e check-ins (com confiança).
-- Reusa os helpers de RLS de governança. Aditivo.
-- ============================================================

create table if not exists public.okr_cycles (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null,
  name       text not null,
  start_date date,
  end_date   date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.okr_objectives (
  id             uuid primary key default gen_random_uuid(),
  client_id      text not null,
  cycle_id       uuid not null references public.okr_cycles(id) on delete cascade,
  name           text not null,
  description    text,
  level          text check (level in ('organizacional','area','individual')),
  owner_member_id uuid,
  perspective_id uuid references public.perspectives(id) on delete set null,
  objective_id   uuid references public.objectives(id) on delete set null,
  position       int not null default 0,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now()
);

create table if not exists public.key_results (
  id               uuid primary key default gen_random_uuid(),
  client_id        text not null,
  okr_objective_id uuid not null references public.okr_objectives(id) on delete cascade,
  name             text not null,
  unit             text,
  start_value      numeric not null default 0,
  target_value     numeric not null,
  current_value    numeric,
  indicator_id     uuid references public.indicators(id) on delete set null,
  position         int not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists public.key_result_checkins (
  id             uuid primary key default gen_random_uuid(),
  client_id      text not null,
  key_result_id  uuid not null references public.key_results(id) on delete cascade,
  value          numeric,
  confidence     text check (confidence in ('green','yellow','red')),
  comment        text,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now()
);

create index if not exists idx_okr_obj_cycle on public.okr_objectives (cycle_id);
create index if not exists idx_kr_objective on public.key_results (okr_objective_id);
create index if not exists idx_checkin_kr on public.key_result_checkins (key_result_id, created_at desc);

alter table public.okr_cycles          enable row level security;
alter table public.okr_objectives      enable row level security;
alter table public.key_results         enable row level security;
alter table public.key_result_checkins enable row level security;

drop policy if exists okrcycles_select on public.okr_cycles;
create policy okrcycles_select on public.okr_cycles for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists okrcycles_write on public.okr_cycles;
create policy okrcycles_write on public.okr_cycles for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

drop policy if exists okrobj_select on public.okr_objectives;
create policy okrobj_select on public.okr_objectives for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists okrobj_write on public.okr_objectives;
create policy okrobj_write on public.okr_objectives for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

drop policy if exists kr_select on public.key_results;
create policy kr_select on public.key_results for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists kr_write on public.key_results;
create policy kr_write on public.key_results for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

drop policy if exists checkin_select on public.key_result_checkins;
create policy checkin_select on public.key_result_checkins for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists checkin_write on public.key_result_checkins;
create policy checkin_write on public.key_result_checkins for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

grant select, insert, update, delete on public.okr_cycles          to authenticated;
grant select, insert, update, delete on public.okr_objectives      to authenticated;
grant select, insert, update, delete on public.key_results         to authenticated;
grant select, insert, update, delete on public.key_result_checkins to authenticated;
