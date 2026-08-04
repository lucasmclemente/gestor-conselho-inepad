-- ============================================================
-- Boardplan — CRM: id externo em atividades (dedup de ligações da GoTo)
--
-- Guarda o conversationSpaceId da GoTo na atividade para não reimportar a
-- mesma ligação. Índice único parcial por (client_id, external_id).
-- Aditiva e idempotente.
-- ============================================================

alter table public.crm_activities add column if not exists external_id text;
create unique index if not exists idx_crm_activities_external on public.crm_activities (client_id, external_id) where external_id is not null;
