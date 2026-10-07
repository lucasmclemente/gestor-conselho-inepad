-- ============================================================
-- Papel "Diretor" — MESMAS permissões do Controller.
-- Perfil restrito: lê o painel de Indicadores e lança o realizado
-- (indicator_readings); NÃO altera metas nem cadastra indicadores/estratégia.
-- Além disso (no frontend): "Minhas Pautas" + "Plano de Ação" dele, como o Controller.
-- Espelha a migração 20260709 incluindo 'Diretor'. Aditivo e idempotente.
-- ============================================================

-- 1) Leitura do painel de governança
create or replace function public.can_read_governance() returns boolean
language sql stable set search_path = '' as $$
  select public.jwt_role() in ('SuperAdmin','Administrador','Secretário','Conselheiro','Controller','Diretor')
$$;

-- 2) Escrita de LEITURAS: governança padrão OU Controller OU Diretor
drop policy if exists readings_write on public.indicator_readings;
create policy readings_write on public.indicator_readings for all to authenticated
  using ( (public.can_write_governance() or public.jwt_role() in ('Controller','Diretor')) and public.gov_tenant_visible(client_id) )
  with check ( (public.can_write_governance() or public.jwt_role() in ('Controller','Diretor')) and public.gov_tenant_visible(client_id) );

-- Nota: indicator_targets.targets_write continua exigindo can_write_governance()
-- (Diretor/Controller ficam de fora) — não alteram metas.
