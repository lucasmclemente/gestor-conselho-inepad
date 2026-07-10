-- ============================================================
-- GovCorp — Planejamento Estratégico · Fase 5 · SWOT (FOFA)
-- Matriz forças / fraquezas / oportunidades / ameaças por cliente.
-- Reusa os helpers de RLS de governança. Aditivo.
-- ============================================================

create table if not exists public.swot_items (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null,
  category   text not null check (category in ('forca','fraqueza','oportunidade','ameaca')),
  text       text not null,
  position   int not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_swot_client on public.swot_items (client_id);

alter table public.swot_items enable row level security;

drop policy if exists swot_select on public.swot_items;
create policy swot_select on public.swot_items for select to authenticated
  using ( public.can_read_governance() and public.gov_tenant_visible(client_id) );
drop policy if exists swot_write on public.swot_items;
create policy swot_write on public.swot_items for all to authenticated
  using ( public.can_write_governance() and public.gov_tenant_visible(client_id) )
  with check ( public.can_write_governance() and public.gov_tenant_visible(client_id) );

grant select, insert, update, delete on public.swot_items to authenticated;
