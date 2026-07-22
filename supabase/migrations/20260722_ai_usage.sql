-- ============================================================
-- Registro de consumo de IA (tokens + custo) por chamada, para medir o custo
-- real das funções draft-agenda (pauta) e draft-minutes (ata) por cliente/mês.
-- Inserção só via service_role (Edge Functions); leitura para Admin/SuperAdmin.
-- ============================================================

create table if not exists public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  client_id     text not null,
  feature       text not null,                 -- 'pauta' | 'ata'
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd      numeric(10,4) not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists ai_usage_client_date_idx on public.ai_usage (client_id, created_at);

alter table public.ai_usage enable row level security;

-- Leitura: SuperAdmin vê tudo; Administrador vê o próprio cliente (ou os do
-- secretary_clients). Fonte segura: app_metadata via helpers jwt_*.
drop policy if exists "ai_usage_read" on public.ai_usage;
create policy "ai_usage_read" on public.ai_usage
  for select to authenticated
  using (
    public.jwt_role() = 'SuperAdmin'
    or (
      public.jwt_role() = 'Administrador'
      and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id))
    )
  );

-- Inserção: apenas service_role (Edge Functions) — sem policy de INSERT exposta.
