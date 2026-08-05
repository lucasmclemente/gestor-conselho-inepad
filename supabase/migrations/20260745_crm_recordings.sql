-- ============================================================
-- Boardplan — CRM: gravações das ligações (GoTo → Supabase Storage)
--
-- • Guarda o recordingId da GoTo na atividade + o caminho do áudio já baixado
-- • Bucket privado crm-recordings (acesso só via service role / signed URL)
-- Aditiva e idempotente.
-- ============================================================

alter table public.crm_activities add column if not exists recording_id   text;
alter table public.crm_activities add column if not exists recording_path text;

-- bucket privado para os áudios das gravações
insert into storage.buckets (id, name, public)
values ('crm-recordings', 'crm-recordings', false)
on conflict (id) do nothing;
