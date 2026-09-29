-- ============================================================
-- Add-on "Perguntas ao Vivo": materiais anexos à sessão.
-- O staff sobe arquivos (bucket meeting-files); guardamos o CAMINHO no jsonb
-- e a Edge Function qa-public assina o link na hora para o público baixar.
-- Formato de cada item: { name, path, uploadedAt }. Aditiva/idempotente.
-- ============================================================

alter table public.qa_sessions add column if not exists materials jsonb not null default '[]'::jsonb;
