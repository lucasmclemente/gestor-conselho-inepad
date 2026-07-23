-- ============================================================
-- Relatório "Estado da Governança" (dados anônimos agregados da plataforma).
-- Função SECURITY DEFINER que devolve SÓ agregados do ecossistema: índice médio/
-- mediana/quartis, distribuição por faixa de maturidade, média por pilar,
-- distribuição de selos válidos e estatísticas de evolução. Nenhum client_id nem
-- nota individual. Artefato de autoridade da INEPAD: só SuperAdmin/Certificador.
-- Massa mínima (5) para preservar o anonimato.
-- ============================================================

create or replace function public.governance_report()
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
  base as (
    select count(*)::int as n,
           round(avg(overall))::int as avg,
           round(percentile_cont(0.5)  within group (order by overall))::int as median,
           round(percentile_cont(0.25) within group (order by overall))::int as p25,
           round(percentile_cont(0.75) within group (order by overall))::int as p75,
           min(overall)::int as mn, max(overall)::int as mx
    from latest
  ),
  bands as (
    select coalesce(jsonb_object_agg(band, cnt), '{}'::jsonb) as obj from (
      select case
        when overall >= 80 then 'avancado'
        when overall >= 60 then 'estruturado'
        when overall >= 40 then 'em_desenvolvimento'
        when overall >= 20 then 'em_estruturacao'
        else 'inicial' end as band,
        count(*) as cnt
      from latest group by 1
    ) q
  ),
  pil as (
    select coalesce(jsonb_agg(jsonb_build_object('key', key, 'avg', a) order by key), '[]'::jsonb) as pillars from (
      select p->>'key' as key, round(avg((p->>'score')::numeric))::int as a
      from latest, jsonb_array_elements(pillars) p
      where (p->>'score') is not null
      group by 1
    ) q
  ),
  top_seal as (
    select distinct on (client_id) client_id, level
    from public.governance_seals
    where status = 'valido' and valid_until > now()
    order by client_id, case level when 'ouro' then 3 when 'prata' then 2 else 1 end desc
  ),
  seals as (
    select coalesce(jsonb_object_agg(level, cnt), '{}'::jsonb) as obj, coalesce(sum(cnt), 0)::int as total from (
      select level, count(*) as cnt from top_seal group by level
    ) q
  ),
  bounds as (
    select client_id,
      (array_agg(overall order by snapshot_date asc,  created_at asc))[1]  as first_o,
      (array_agg(overall order by snapshot_date desc, created_at desc))[1] as last_o,
      min(snapshot_date) as fd, max(snapshot_date) as ld, count(*) as ns
    from public.maturity_history group by client_id
  ),
  evo as (
    select (last_o - first_o) as delta from bounds where ns >= 2 and (ld - fd) >= 21
  ),
  evoagg as (
    select count(*)::int as n,
           count(*) filter (where delta > 0)::int as improved,
           round(avg(delta))::int as avg_delta,
           round(percentile_cont(0.5) within group (order by delta))::int as median_delta
    from evo
  )
  select case
    when public.jwt_role() not in ('SuperAdmin', 'Certificador')
      then jsonb_build_object('error', 'forbidden')
    when (select n from base) < 5
      then jsonb_build_object('n', (select n from base), 'insufficient', true, 'min_n', 5)
    else jsonb_build_object(
      'n', (select n from base),
      'avg', (select avg from base), 'median', (select median from base),
      'p25', (select p25 from base), 'p75', (select p75 from base),
      'min', (select mn from base), 'max', (select mx from base),
      'bands', (select obj from bands),
      'pillars', (select pillars from pil),
      'seals', jsonb_build_object('by_level', (select obj from seals), 'total', (select total from seals)),
      'evolution', case
        when (select n from evoagg) < 3 then jsonb_build_object('insufficient', true, 'n', (select n from evoagg))
        else jsonb_build_object('n', (select n from evoagg), 'improved', (select improved from evoagg), 'avg_delta', (select avg_delta from evoagg), 'median_delta', (select median_delta from evoagg))
      end
    )
  end;
$$;

revoke all on function public.governance_report() from public, anon;
grant execute on function public.governance_report() to authenticated;
