-- ============================================================
-- Boardplan — CRM: metadados de e-mail nas atividades
--
-- Direção (enviado/recebido) e id da mensagem (Graph internetMessageId),
-- para o histórico de e-mails no negócio e o dedup do sync de respostas.
-- Aditiva e idempotente.
-- ============================================================

alter table public.crm_activities add column if not exists email_direction text;    -- 'out' | 'in'
alter table public.crm_activities add column if not exists email_msg_id  text;       -- internetMessageId (dedup do sync)

create unique index if not exists idx_crm_activities_email_msg on public.crm_activities (client_id, email_msg_id) where email_msg_id is not null;
