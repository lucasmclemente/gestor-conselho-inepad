-- ============================================================
-- Papel CERTIFICADOR (equipe INEPAD de certificação).
-- Alcance: TODOS os clientes, restrito à certificação. Poderes: ver a maturidade
-- registrada (última nota + evidências), VALIDAR evidências e EMITIR/REVOGAR selos.
-- NÃO gerencia usuários, rubrica, contas de clientes nem dados operacionais.
--
-- Estratégia: policies ADITIVAS (permissivas, OR-combinadas) só para o Certificador,
-- sobre a superfície de maturidade (uniforme prod/develop via jwt_*). Não altera
-- nenhuma policy existente nem a camada internal.* das tabelas operacionais.
-- ============================================================

-- Rubrica (global): leitura
drop policy if exists maturity_criteria_read_certifier on public.maturity_criteria;
create policy maturity_criteria_read_certifier on public.maturity_criteria
  for select to authenticated using (public.jwt_role() = 'Certificador');

-- Respostas do diagnóstico: leitura de todos + validação (update). Cross-client.
drop policy if exists maturity_answers_read_certifier on public.maturity_answers;
create policy maturity_answers_read_certifier on public.maturity_answers
  for select to authenticated using (public.jwt_role() = 'Certificador');

drop policy if exists maturity_answers_validate_certifier on public.maturity_answers;
create policy maturity_answers_validate_certifier on public.maturity_answers
  for update to authenticated
  using (public.jwt_role() = 'Certificador')
  with check (public.jwt_role() = 'Certificador');

-- Histórico da nota: leitura (o snapshot é gravado pelo próprio cliente)
drop policy if exists maturity_history_read_certifier on public.maturity_history;
create policy maturity_history_read_certifier on public.maturity_history
  for select to authenticated using (public.jwt_role() = 'Certificador');

-- Selos: leitura + emissão/revogação. Cross-client.
drop policy if exists governance_seals_read_certifier on public.governance_seals;
create policy governance_seals_read_certifier on public.governance_seals
  for select to authenticated using (public.jwt_role() = 'Certificador');

drop policy if exists governance_seals_write_certifier on public.governance_seals;
create policy governance_seals_write_certifier on public.governance_seals
  for all to authenticated
  using (public.jwt_role() = 'Certificador')
  with check (public.jwt_role() = 'Certificador');

-- Clientes: leitura (para listar/nomear as empresas no console). Aditiva.
drop policy if exists clients_read_certifier on public.clients;
create policy clients_read_certifier on public.clients
  for select to authenticated using (public.jwt_role() = 'Certificador');

-- Storage: o Certificador abre/renova o link das EVIDÊNCIAS (prefixo maturidade/),
-- nunca atas/materiais. Aditiva, escopada ao primeiro nível da pasta.
drop policy if exists "meeting_files_select_certifier" on storage.objects;
create policy "meeting_files_select_certifier" on storage.objects
  for select to authenticated using (
    bucket_id = 'meeting-files'
    and (storage.foldername(name))[1] = 'maturidade'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'Certificador'
  );

-- Benchmark anônimo: incluir o Certificador entre os papéis autorizados.
create or replace function public.benchmark_maturity(my_overall int default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with latest as (
    select distinct on (client_id) client_id, overall, pillars
    from public.maturity_history
    order by client_id, snapshot_date desc, created_at desc
  ),
  agg as (
    select count(*)::int as n,
           round(avg(overall))::int as avg,
           round(percentile_cont(0.5)  within group (order by overall))::int as median,
           round(percentile_cont(0.25) within group (order by overall))::int as p25,
           round(percentile_cont(0.75) within group (order by overall))::int as p75,
           case when my_overall is null then null
                else round(100.0 * count(*) filter (where overall <= my_overall) / nullif(count(*), 0))::int
           end as my_percentile
    from latest
  ),
  pil as (
    select coalesce(jsonb_agg(jsonb_build_object('key', key, 'avg', a) order by key), '[]'::jsonb) as pillars
    from (
      select p->>'key' as key, round(avg((p->>'score')::numeric))::int as a
      from latest, jsonb_array_elements(pillars) p
      where (p->>'score') is not null
      group by p->>'key'
    ) q
  )
  select case
    when public.jwt_role() not in ('SuperAdmin', 'Administrador', 'Secretário', 'Certificador')
      then jsonb_build_object('error', 'forbidden')
    when (select n from agg) < 5
      then jsonb_build_object('n', (select n from agg), 'insufficient', true, 'min_n', 5)
    else jsonb_build_object(
      'n',            (select n from agg),
      'avg',          (select avg from agg),
      'median',       (select median from agg),
      'p25',          (select p25 from agg),
      'p75',          (select p75 from agg),
      'my_percentile',(select my_percentile from agg),
      'pillars',      (select pillars from pil)
    )
  end;
$$;
