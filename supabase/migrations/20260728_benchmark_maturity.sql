-- ============================================================
-- Benchmark anônimo entre clientes (roadmap "Benchmark anônimo").
-- Função SECURITY DEFINER que lê a ÚLTIMA nota de cada cliente em
-- maturity_history e devolve APENAS agregados: média, mediana, quartis (p25/p75),
-- médias por pilar e o percentil do solicitante (a partir do my_overall passado
-- pelo front). Nunca retorna client_id nem nota individual de outra empresa.
-- Anonimato preservado por massa mínima (min_n = 5): abaixo disso não divulga.
-- Só papéis de governança executam; grant apenas a authenticated.
-- ============================================================

create or replace function public.benchmark_maturity(my_overall int default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with latest as (
    -- última nota conhecida de cada cliente
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
    when public.jwt_role() not in ('SuperAdmin', 'Administrador', 'Secretário')
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

revoke all on function public.benchmark_maturity(int) from public, anon;
grant execute on function public.benchmark_maturity(int) to authenticated;
