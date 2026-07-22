-- ============================================================
-- BUG multi-empresa no STORAGE: usuário Adm/Sec vinculado a outro cliente via
-- secretary_clients não conseguia subir/ver materiais desse cliente.
--
-- As políticas de `meeting-files` checavam a pasta [2] só contra
-- internal.get_my_client_id() (cliente-casa, da tabela members) — ignoravam
-- secretary_clients. A tabela `meetings` já honra secretary_clients; o storage não.
--
-- Correção ADITIVA (permissiva, OR-combinada — não remove nada): libera
-- INSERT e SELECT no bucket `meeting-files` quando a pasta do cliente [2] for
-- o cliente-casa OU estiver no secretary_clients OU o usuário for SuperAdmin.
-- Fonte segura: app_metadata (só service_role grava), igual à policy de meetings.
-- Caminho do arquivo: `<tipo>/<client_id>/<arquivo>` → foldername[2] = client_id.
-- Idempotente.
-- ============================================================

drop policy if exists "meeting_files_insert_multi" on storage.objects;
create policy "meeting_files_insert_multi" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meeting-files'
    and (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin')
      or ((storage.foldername(name))[2] = (auth.jwt() -> 'app_metadata' ->> 'client_id'))
      or (coalesce(auth.jwt() -> 'app_metadata' -> 'secretary_clients', '[]'::jsonb) ? (storage.foldername(name))[2])
    )
  );

drop policy if exists "meeting_files_select_multi" on storage.objects;
create policy "meeting_files_select_multi" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meeting-files'
    and (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin')
      or ((storage.foldername(name))[2] = (auth.jwt() -> 'app_metadata' ->> 'client_id'))
      or (coalesce(auth.jwt() -> 'app_metadata' -> 'secretary_clients', '[]'::jsonb) ? (storage.foldername(name))[2])
    )
  );
