-- ============================================================
-- GovCorp — Indicadores: FCA (Ficha de Controle Analítico)
-- Fato → Causa → Ação quando um indicador não atinge a meta.
-- Aditivo; reusa os helpers de RLS de governança.
-- ============================================================

create table if not exists public.fca (
  id           uuid primary key default gen_random_uuid(),
  client_id    text not null,
  indicator_id uuid not null references public.indicators(id) on delete cascade,
  period       date,
  fact         text not null,
  cause        text,
  action_text  text,
  action_id    text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);

create index if not exists idx_fca_indicator on public.fca (indicator_id, created_at desc);
create index if not exists idx_fca_client on public.fca (client_id);

alter table public.fca enable row level security;

drop policy if exists fca_select on public.fca;
create policy fca_select on public.fca for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists fca_write on public.fca;
create policy fca_write on public.fca for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

grant select, insert, update, delete on public.fca to authenticated;
