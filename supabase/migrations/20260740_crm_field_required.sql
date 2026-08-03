-- ============================================================
-- Boardplan — CRM: campo personalizado obrigatório
--
-- Marca um campo como obrigatório. O front bloqueia AVANÇAR o negócio de
-- etapa (mover para uma etapa de posição maior) enquanto os campos
-- obrigatórios não estiverem preenchidos. Guardrail de qualificação —
-- validação no front (regra de fluxo, não de segurança).
-- Aditiva e idempotente.
-- ============================================================

alter table public.crm_field_defs add column if not exists required boolean not null default false;
