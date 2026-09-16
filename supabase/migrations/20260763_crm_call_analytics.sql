-- ============================================================
-- Boardplan CRM — Analytics de ligações: número discado + causa do encerramento
--
-- call_number: número discado (saída) ou de quem ligou (entrada), em dígitos/E.164
-- call_cause:  causa do encerramento (ex.: 'answered', 'busy', 'rejected',
--              'no_answer', 'invalid', 'cancel'/'agent_hangup') — normalizada no front
--
-- Habilita os painéis "Vale insistir?" (tentativas por número) e
-- "Onde a discagem morre" (causas). Só vale para ligações NOVAS; há um backfill
-- opcional do número a partir da nota (abaixo).
-- Aditiva e idempotente.
-- ============================================================

alter table public.crm_activities
  add column if not exists call_number text,
  add column if not exists call_cause  text;

create index if not exists idx_crm_activities_callnum
  on public.crm_activities (client_id, call_number)
  where type = 'call' and call_number is not null;

-- Backfill do número a partir da nota "Número: +55..." (histórico do webfone/sync)
update public.crm_activities
set call_number = substring(notes from 'N[uú]mero:\s*([+0-9]+)')
where type = 'call' and call_number is null and notes ~ 'N[uú]mero:';
