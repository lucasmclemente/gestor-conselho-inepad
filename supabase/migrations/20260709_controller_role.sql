-- ============================================================
-- GovCorp — Papel "Controller"
-- Perfil restrito: acessa o painel de Indicadores APENAS para lançar
-- o realizado (indicator_readings). NÃO pode alterar metas
-- (indicator_targets) nem cadastrar/editar indicadores ou estratégia.
--
-- Implementação:
--  1) can_read_governance() passa a incluir 'Controller' (leitura do painel).
--  2) indicator_readings.readings_write passa a aceitar Controller
--     (além de can_write_governance) — escrita de LEITURAS.
--  3) can_write_governance() NÃO muda: Controller continua sem poder
--     gravar metas, indicadores, objetivos, OKR, SWOT, FCA etc.
-- Aditivo e idempotente.
-- ============================================================

-- 1) Leitura do painel de governança (indicadores, leituras, metas, status)
create or replace function public.can_read_governance() returns boolean
language sql stable set search_path = '' as $$
  select public.jwt_role() in ('SuperAdmin','Administrador','Secretário','Conselheiro','Controller')
$$;

-- 2) Escrita de LEITURAS: governança padrão OU Controller
drop policy if exists readings_write on public.indicator_readings;
create policy readings_write on public.indicator_readings for all to authenticated
  using ( (public.can_write_governance() or public.jwt_role() = 'Controller') and public.gov_tenant_visible(client_id) )
  with check ( (public.can_write_governance() or public.jwt_role() = 'Controller') and public.gov_tenant_visible(client_id) );

-- Nota: indicator_targets.targets_write continua exigindo can_write_governance()
-- (Controller fica de fora) — Controller não altera metas.
