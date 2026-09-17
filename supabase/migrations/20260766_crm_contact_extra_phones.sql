-- ============================================================
-- Boardplan CRM — Vários telefones por contato
--
-- `phone` continua sendo o telefone PRINCIPAL (usado por padrão no webfone e no
-- casamento de ligações). Telefones adicionais ficam em `extra_phones` (array).
-- Aditiva e idempotente.
-- ============================================================

alter table public.crm_contacts
  add column if not exists extra_phones jsonb not null default '[]'::jsonb;
