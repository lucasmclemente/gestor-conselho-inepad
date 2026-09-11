-- ============================================================
-- Boardplan CRM — Alertas de tarefa ("X antes do prazo")
--
-- remind_minutes: quantos minutos ANTES do prazo alertar (0 = no horário; null = sem alerta)
-- remind_at:      momento calculado do alerta (due_at - remind_minutes) — usado para disparar/contar
--
-- Aditiva e idempotente. Rodar em develop, testar, depois produção.
-- ============================================================

alter table public.crm_activities
  add column if not exists remind_at      timestamptz,
  add column if not exists remind_minutes int;

-- acelera a busca de alertas pendentes (não concluídos) por cliente
create index if not exists idx_crm_activities_remind
  on public.crm_activities (client_id, remind_at)
  where remind_at is not null and not done;
