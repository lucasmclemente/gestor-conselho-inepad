-- ============================================================
-- Boardplan — CRM: conexão de e-mail Outlook/Microsoft 365 (OAuth por usuário)
--
-- Guarda os tokens OAuth de cada vendedor (access/refresh) + e-mail conectado.
-- NENHUM acesso para authenticated: só o service_role (Edge Functions).
-- delta_link guarda o cursor de sincronização de entrada (respostas).
-- Aditiva e idempotente.
-- ============================================================

create table if not exists public.crm_outlook_connections (
  member_id     uuid primary key,          -- auth.users id do vendedor
  client_id     text not null,
  email         text,                        -- endereço conectado
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  scope         text,
  delta_link    text,                        -- cursor do /messages/delta (sync de respostas)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.crm_outlook_connections enable row level security;
-- Sem policies para authenticated → default deny. Só service_role acessa.
