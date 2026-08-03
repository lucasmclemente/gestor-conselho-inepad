-- ============================================================
-- Boardplan — CRM: CNPJ/cidade/UF na empresa (para importação de listas)
--
-- Importação de listas (Empresas.csv + Socios.csv) usa o CNPJ como chave
-- para deduplicar empresas e vincular os sócios (contatos) à empresa certa.
-- Aditiva e idempotente.
-- ============================================================

alter table public.crm_organizations
  add column if not exists cnpj text,
  add column if not exists city text,
  add column if not exists uf   text;

create index if not exists idx_crm_org_cnpj on public.crm_organizations (client_id, cnpj) where cnpj is not null;
