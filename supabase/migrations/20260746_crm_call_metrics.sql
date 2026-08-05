-- ============================================================
-- Boardplan — CRM: métricas estruturadas das ligações (dashboard)
--
-- Duração (segundos), se foi atendida e direção — em colunas próprias,
-- para o painel de ligações (volume, taxa de atendimento, duração média).
-- Preenchidas pelo sync (novas + backfill das já existentes).
-- Aditiva e idempotente.
-- ============================================================

alter table public.crm_activities add column if not exists call_seconds   integer;
alter table public.crm_activities add column if not exists call_answered  boolean;
alter table public.crm_activities add column if not exists call_direction text;  -- 'out' | 'in'

create index if not exists idx_crm_activities_call on public.crm_activities (client_id, owner_member_id) where type = 'call';
