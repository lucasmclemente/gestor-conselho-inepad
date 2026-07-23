-- ============================================================
-- Diretório público de conselhos certificados (opt-in).
-- Flag por empresa: só aparece no diretório público quem TEM selo válido E
-- consentiu explicitamente em ser listado. Consentimento é do cliente (Adm) ou
-- da INEPAD (Super), gravado apenas pela Edge Function set-directory-optin
-- (service role) — a tabela clients NÃO é aberta a escrita ampla via RLS.
-- ============================================================

alter table public.clients add column if not exists directory_opt_in boolean not null default false;

comment on column public.clients.directory_opt_in is
  'Consentimento para exibir a empresa no diretório público de certificados INEPAD (só com selo válido).';
