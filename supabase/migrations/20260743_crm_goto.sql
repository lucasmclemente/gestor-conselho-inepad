-- ============================================================
-- Boardplan — CRM: conexão de telefonia GoTo (OAuth por usuário)
--
-- Guarda os tokens OAuth de cada vendedor (access/refresh). NENHUM acesso
-- para authenticated: só o service_role (Edge Functions) lê/escreve tokens.
-- O status de conexão é exposto pela Edge Function goto-oauth (action=status),
-- nunca por leitura direta da tabela — os tokens jamais chegam ao navegador.
-- Aditiva e idempotente.
-- ============================================================

create table if not exists public.crm_goto_connections (
  member_id     uuid primary key,          -- auth.users id do vendedor
  client_id     text not null,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  scope         text,
  goto_line_id  text,                        -- linha/ramal na GoTo (para originar chamadas) — preenchido depois
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.crm_goto_connections enable row level security;
-- Sem policies para authenticated → default deny. Só service_role (que ignora RLS) acessa.
