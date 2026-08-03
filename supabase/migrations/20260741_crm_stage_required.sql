-- ============================================================
-- Boardplan — CRM: campos exigidos POR ETAPA
--
-- Cada etapa lista quais campos personalizados precisam estar preenchidos
-- para o negócio AVANÇAR dela (mover para uma etapa de posição maior).
-- Substitui o "obrigatório global" (crm_field_defs.required fica dormente).
-- Validação no front (regra de fluxo). Aditiva e idempotente.
-- ============================================================

alter table public.crm_stages add column if not exists required_field_ids jsonb not null default '[]'::jsonb;
