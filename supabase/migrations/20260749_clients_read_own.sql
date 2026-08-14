-- ============================================================
-- Boardplan — RLS: usuário autenticado pode ler a linha do PRÓPRIO cliente
--
-- Corrige: o menu do CRM (e outros add-ons) não aparecia para Administradores
-- porque eles não conseguiam ler `crm_enabled`/`strategy_enabled` da própria
-- conta na tabela `clients`. A tabela não tem segredos (nome, logo, flags).
-- Lê o client_id do app_metadata do JWT — portável entre develop e produção
-- (não depende de funções jwt_*/internal que divergem entre ambientes).
-- Aditiva (OR-combinada com as policies existentes) e idempotente.
-- ============================================================

drop policy if exists clients_read_own on public.clients;
create policy clients_read_own on public.clients
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'client_id') = client_id);
