-- ============================================================
-- Boardplan — CRM: campos personalizados por negócio
--
-- Admin define os campos (rótulo + tipo); cada negócio guarda os valores
-- num jsonb `custom` (chaveado pelo id do campo). Ex.: Lead Score, respostas
-- de qualificação, CNAE, etc.
--
-- crm_field_defs: leitura p/ quem acessa o CRM (renderizar); escrita só
-- Admin/SuperAdmin (config do tenant).
-- Aditiva e idempotente.
-- ============================================================

create table if not exists public.crm_field_defs (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null,
  label      text not null,
  type       text not null default 'text' check (type in ('text','number','select','date','checkbox')),
  options    jsonb not null default '[]'::jsonb,  -- para type='select'
  position   int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_field_defs_client on public.crm_field_defs (client_id, position) where active;

-- Valores por negócio (jsonb chaveado pelo id do campo)
alter table public.crm_deals add column if not exists custom jsonb not null default '{}'::jsonb;

-- ── RLS ─────────────────────────────────────────────────────
alter table public.crm_field_defs enable row level security;

drop policy if exists crm_field_defs_select on public.crm_field_defs;
create policy crm_field_defs_select on public.crm_field_defs for select to authenticated
  using ( public.can_access_crm(client_id) );

drop policy if exists crm_field_defs_write on public.crm_field_defs;
create policy crm_field_defs_write on public.crm_field_defs for all to authenticated
  using ( public.can_access_crm(client_id) and public.jwt_role() in ('SuperAdmin','Administrador') )
  with check ( public.can_access_crm(client_id) and public.jwt_role() in ('SuperAdmin','Administrador') );

grant select, insert, update, delete on public.crm_field_defs to authenticated;
