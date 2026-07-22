-- ============================================================
-- SEGURANÇA STORAGE: fecha o buraco de user_metadata nas policies do storage.
--
-- Duas policies de storage.objects ainda liam user_metadata (editável pelo
-- usuário → dá pra forjar client_id e acessar storage de outro cliente). O
-- linter não varre policies do schema `storage`, por isso passou batido.
--
--   "Acesso por ClientID"        (ALL, sem filtro de bucket) — a preocupante:
--        foldername[2] = user_metadata.client_id  OR  user_metadata.role='SuperAdmin'
--        (também é a única policy que cobre o bucket client-logos, pelo ramo
--         SuperAdmin — por isso NÃO removemos, apenas trocamos a fonte).
--   "Acesso restrito ao ClientID" (SELECT):
--        foldername[1] = user_metadata.client_id
--
-- Correção: ALTER preservando a lógica idêntica, só trocando user_metadata →
-- app_metadata (fonte segura, só service_role grava). Comportamento inalterado
-- para quem já relogou; nada de bucket perde cobertura. Guard por existência
-- (não aborta se a policy não existir neste ambiente). Idempotente.
-- ============================================================

do $$
begin
  if exists (select 1 from pg_policy
             where polname = 'Acesso por ClientID'
               and polrelid = 'storage.objects'::regclass) then
    execute $q$
      alter policy "Acesso por ClientID" on storage.objects
      using (
        ((storage.foldername(name))[2] = (auth.jwt() -> 'app_metadata' ->> 'client_id'))
        or ((auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin')
      )$q$;
    raise notice 'Policy "Acesso por ClientID" migrada para app_metadata.';
  end if;

  if exists (select 1 from pg_policy
             where polname = 'Acesso restrito ao ClientID'
               and polrelid = 'storage.objects'::regclass) then
    execute $q$
      alter policy "Acesso restrito ao ClientID" on storage.objects
      using (
        (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'client_id')
      )$q$;
    raise notice 'Policy "Acesso restrito ao ClientID" migrada para app_metadata.';
  end if;
end $$;
