-- ============================================================================
-- Comitês — cobrança automática (cron semanal) das ações de comitê
-- ----------------------------------------------------------------------------
-- Toggle por cliente (começa DESLIGADO). Quando ligado, a Edge Function
-- cron-cobrar-comites (chamada por pg_cron toda segunda de manhã) cobra por
-- e-mail os responsáveis por ações de comitê ATRASADAS ou VENCENDO em ≤3 dias.
-- O agendamento pg_cron é feito por ambiente no SQL Editor (reusa CRON_SECRET),
-- pois a URL da função e o segredo diferem entre prod e develop.
-- ============================================================================

alter table public.clients
  add column if not exists committee_auto_charge boolean not null default false;

comment on column public.clients.committee_auto_charge is
  'Comitês: cobrança automática semanal (cron) das ações de comitê atrasadas/vencendo. Off por padrão; exige committees_enabled.';
