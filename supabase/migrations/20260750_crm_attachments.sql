-- ============================================================
-- Boardplan CRM — Anexos nas atividades (arquivos, áudios, imagens)
--
-- (1) Coluna jsonb `attachments` em crm_activities:
--       [{ name, path, type, size }]  (path = objeto no bucket privado)
-- (2) Bucket privado `crm-attachments` (50 MB por arquivo)
-- (3) RLS em storage.objects isolando por client_id (1º segmento do path),
--     lido do app_metadata do JWT — portável entre develop e produção
--     (não depende de funções jwt_*/internal que divergem entre ambientes).
--     Reconhece secretary_clients (multi-empresa) e SuperAdmin.
--
-- Convenção de path: `${client_id}/${deal_id}/${activity_id}/arquivo`
-- Rodar em develop e em produção. Idempotente.
-- ============================================================

alter table public.crm_activities
  add column if not exists attachments jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-attachments', 'crm-attachments', false, 52428800)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- LEITURA (necessária p/ createSignedUrl)
drop policy if exists crm_att_read on storage.objects;
create policy crm_att_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'crm-attachments' and (
      (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'client_id')
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin'
      or ((auth.jwt() -> 'app_metadata' -> 'secretary_clients') ? ((storage.foldername(name))[1]))
    )
  );

-- ESCRITA (upload)
drop policy if exists crm_att_insert on storage.objects;
create policy crm_att_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'crm-attachments' and (
      (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'client_id')
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin'
      or ((auth.jwt() -> 'app_metadata' -> 'secretary_clients') ? ((storage.foldername(name))[1]))
    )
  );

-- REMOÇÃO (excluir anexo / limpeza ao apagar a atividade)
drop policy if exists crm_att_delete on storage.objects;
create policy crm_att_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'crm-attachments' and (
      (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'client_id')
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin'
      or ((auth.jwt() -> 'app_metadata' -> 'secretary_clients') ? ((storage.foldername(name))[1]))
    )
  );
