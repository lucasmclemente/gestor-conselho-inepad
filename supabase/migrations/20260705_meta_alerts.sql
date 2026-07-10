-- ============================================================
-- GovCorp — Indicadores: alertas dirigidos pela META (aposenta gatilhos manuais)
-- - trigger_events passa a aceitar eventos de meta (sem trigger_id)
-- - view do semáforo recalculada por realizado × meta
-- Aditivo/retrocompatível: dados de gatilhos antigos permanecem, mas o motor
-- passa a operar por meta.
-- ============================================================

-- Eventos de alerta agora podem nascer da meta (sem gatilho)
alter table public.trigger_events alter column trigger_id drop not null;
alter table public.trigger_events add column if not exists indicator_id uuid references public.indicators(id) on delete cascade;
alter table public.trigger_events add column if not exists source text not null default 'trigger';

-- Idempotência dos eventos de meta: 1 por (indicador, leitura)
create unique index if not exists uq_meta_event on public.trigger_events (indicator_id, indicator_reading_id) where source = 'meta';

-- Semáforo por realizado × meta (0 verde ≥100% · 1 amarelo ≥80% · 2 vermelho <80%),
-- respeitando a direção do indicador. Sem meta na competência → 0 (neutro/verde).
create or replace view public.indicator_current_status
with (security_invoker = on) as
with latest as (
  select distinct on (indicator_id)
    indicator_id, client_id, value, period, id as reading_id
  from public.indicator_readings
  order by indicator_id, period desc, created_at desc
)
select
  i.id        as indicator_id,
  i.client_id,
  i.name,
  i.unit,
  i.direction,
  i.category,
  l.value     as current_value,
  l.period    as current_period,
  coalesce((
    select case
      when tg.target_value is null then 0
      when i.direction = 'lower_is_better' then
        case
          when l.value = 0 then 0
          when tg.target_value / l.value >= 1 then 0
          when tg.target_value / l.value >= 0.8 then 1
          else 2
        end
      else
        case
          when tg.target_value = 0 then 0
          when l.value / tg.target_value >= 1 then 0
          when l.value / tg.target_value >= 0.8 then 1
          else 2
        end
    end
    from public.indicator_targets tg
    where tg.indicator_id = i.id and tg.period = l.period
    limit 1
  ), 0) as breach_level
from public.indicators i
left join latest l on l.indicator_id = i.id
where i.active;
