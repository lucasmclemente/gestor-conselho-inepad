-- ============================================================
-- Horário de FIM (estimado) da reunião — usado para reservar a duração correta
-- no convite de calendário (.ics). Antes o .ics assumia 120 min fixos.
-- Coluna text (guarda "HH:MM"); nula quando não informada. Aditiva/idempotente.
-- ============================================================

alter table public.meetings add column if not exists end_time text;
