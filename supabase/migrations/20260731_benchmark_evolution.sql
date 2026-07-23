-- ============================================================
-- Benchmark de EVOLUÇÃO (roadmap "reconhecer quem mais evoluiu").
-- Além dos agregados por nota absoluta, a função passa a rankear os clientes por
-- QUANTO evoluíram (delta entre a 1ª e a última nota do histórico) e devolve o
-- percentil de evolução do solicitante ("entre os X% que mais evoluíram").
-- Qualifica só quem tem ≥2 snapshots e span ≥ 21 dias (evolução real, não ruído).
-- Mesma privacidade: só agregados + a própria posição; massa mínima (5).
--
-- Assinatura muda (ganha my_delta): dropa a versão antiga (int) antes de recriar.
-- ============================================================

drop function if exists public.benchmark_maturity(int);
drop function if exists public.benchmark_maturity(int, int);

create function public.benchmark_maturity(my_overall int default null, my_delta int default null)
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
  ),
  bounds as (
    select client_id,
      (array_agg(overall order by snapshot_date asc,  created_at asc))[1]  as first_overall,
      (array_agg(overall order by snapshot_date desc, created_at desc))[1] as last_overall,
      min(snapshot_date) as first_date,
      max(snapshot_date) as last_date,
      count(*) as n_snaps
    from public.maturity_history
    group by client_id
  ),
  evo as (
    select (last_overall - first_overall) as delta
    from bounds
    where n_snaps >= 2 and (last_date - first_date) >= 21
  ),
  evo_agg as (
    select count(*)::int as n,
      case when my_delta is null then null
           else round(100.0 * count(*) filter (where delta <= my_delta) / nullif(count(*), 0))::int
      end as my_pct
    from evo
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
      'pillars',      (select pillars from pil),
      'evolution', case
        when (select n from evo_agg) < 5 then jsonb_build_object('insufficient', true, 'n', (select n from evo_agg))
        else jsonb_build_object('n', (select n from evo_agg), 'my_percentile', (select my_pct from evo_agg))
      end
    )
  end;
$$;

revoke all on function public.benchmark_maturity(int, int) from public, anon;
grant execute on function public.benchmark_maturity(int, int) to authenticated;
