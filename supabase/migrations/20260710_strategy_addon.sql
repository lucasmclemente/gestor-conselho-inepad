-- ============================================================
-- GovCorp — Add-on "Planejamento Estratégico"
-- Transforma Estratégia (BSC/OKR/SWOT/RAE) + Indicadores (semáforos)
-- em um add-on ligado/desligado por cliente pelo SuperAdmin, no mesmo
-- padrão do add-on ClickSign (coluna booleana em clients).
--
-- Para não regredir quem já usa: habilita o add-on para todos os
-- clientes que já têm indicadores OU objetivos cadastrados.
-- Novos clientes começam SEM o add-on (opt-in do SuperAdmin).
-- Aditivo e idempotente.
-- ============================================================

alter table public.clients
  add column if not exists strategy_enabled boolean not null default false;

update public.clients c
   set strategy_enabled = true
 where c.strategy_enabled = false
   and (
     exists (select 1 from public.indicators i where i.client_id = c.client_id)
     or exists (select 1 from public.objectives o where o.client_id = c.client_id)
   );
