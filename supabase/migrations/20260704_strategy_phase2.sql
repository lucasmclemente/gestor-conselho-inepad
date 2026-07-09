-- ============================================================
-- GovCorp — Planejamento Estratégico · Fase 2
-- Indicadores evoluídos: meta por período (farol realizado × meta),
-- hierarquia (nível) e responsável. Aditivo e retrocompatível.
-- ============================================================

alter table public.indicators add column if not exists level text
  check (level in ('estrategico','tatico','operacional'));
alter table public.indicators add column if not exists responsible_member_id uuid;

-- Meta por competência (uma meta por indicador/mês)
create table if not exists public.indicator_targets (
  id           uuid primary key default gen_random_uuid(),
  client_id    text not null,
  indicator_id uuid not null references public.indicators(id) on delete cascade,
  period       date not null,
  target_value numeric not null,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (indicator_id, period)
);

create index if not exists idx_targets_indicator_period on public.indicator_targets (indicator_id, period desc);
create index if not exists idx_targets_client on public.indicator_targets (client_id);

alter table public.indicator_targets enable row level security;

drop policy if exists targets_select on public.indicator_targets;
create policy targets_select on public.indicator_targets for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists targets_write on public.indicator_targets;
create policy targets_write on public.indicator_targets for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

grant select, insert, update, delete on public.indicator_targets to authenticated;
