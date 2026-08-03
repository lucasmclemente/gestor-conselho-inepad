-- ============================================================
-- Boardplan — CRM: etiquetas (tags) de segmentação
--
-- Admin define etiquetas (nome + cor); cada negócio guarda os ids das
-- etiquetas num jsonb (crm_deals.tag_ids). Aparecem no card e dão filtro.
-- crm_tags: leitura p/ quem acessa o CRM; escrita só Admin/SuperAdmin.
-- Aditiva e idempotente.
-- ============================================================

create table if not exists public.crm_tags (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null,
  name       text not null,
  color      text not null default '#64748b',
  position   int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_tags_client on public.crm_tags (client_id, position);

alter table public.crm_deals add column if not exists tag_ids jsonb not null default '[]'::jsonb;

alter table public.crm_tags enable row level security;

drop policy if exists crm_tags_select on public.crm_tags;
create policy crm_tags_select on public.crm_tags for select to authenticated
  using ( public.can_access_crm(client_id) );

drop policy if exists crm_tags_write on public.crm_tags;
create policy crm_tags_write on public.crm_tags for all to authenticated
  using ( public.can_access_crm(client_id) and public.jwt_role() in ('SuperAdmin','Administrador') )
  with check ( public.can_access_crm(client_id) and public.jwt_role() in ('SuperAdmin','Administrador') );

grant select, insert, update, delete on public.crm_tags to authenticated;
