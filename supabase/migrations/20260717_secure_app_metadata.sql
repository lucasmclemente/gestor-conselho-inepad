-- ============================================================
-- SEGURANÇA CRÍTICA — mover autorização de user_metadata → app_metadata
--
-- Problema (linter Supabase 0015): role/client_id/secretary_clients ficavam
-- em user_metadata, que é EDITÁVEL pelo próprio usuário via
-- supabase.auth.updateUser({ data }). Um Conselheiro podia se autopromover a
-- SuperAdmin e acessar todos os tenants. app_metadata só é gravável pelo
-- service_role (servidor), então é o lugar correto para claims de segurança.
--
-- Esta migração:
--  1) Copia role/client_id/secretary_clients de user_metadata → app_metadata
--     de todos os usuários existentes (sem isso, ninguém entra depois da troca).
--  2) Aponta as funções helper jwt_* para app_metadata (conserta todas as
--     tabelas de governança que as usam).
--  3) Reescreve dinamicamente TODA policy do schema public que referencie
--     user_metadata, trocando por app_metadata — preserva nome, comando,
--     roles e lógica. Dinâmico de propósito: os nomes das policies divergem
--     entre develop e produção.
--
-- ⚠️ Efeito: os JWTs já emitidos não têm app_metadata preenchido — usuários
-- logados precisam sair e entrar de novo (ou aguardar o refresh do token)
-- para o novo token trazer as claims. RLS lê a claim do token; getUser() nas
-- Edge Functions lê a linha do banco (já migrada), então funciona antes.
-- Aditivo e idempotente.
-- ============================================================

-- 1) Migração de dados: user_metadata → app_metadata (preserva provider/providers)
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_strip_nulls(jsonb_build_object(
       'role',              u.raw_user_meta_data -> 'role',
       'client_id',         u.raw_user_meta_data -> 'client_id',
       'secretary_clients', u.raw_user_meta_data -> 'secretary_clients'
     ))
where u.raw_user_meta_data ?| array['role','client_id','secretary_clients'];

-- 2) Funções helper de JWT passam a ler app_metadata (fonte segura)
create or replace function public.jwt_role() returns text
language sql stable set search_path = '' as $$
  select auth.jwt() -> 'app_metadata' ->> 'role'
$$;

create or replace function public.jwt_client_id() returns text
language sql stable set search_path = '' as $$
  select auth.jwt() -> 'app_metadata' ->> 'client_id'
$$;

create or replace function public.jwt_secretary_clients() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' -> 'secretary_clients', '[]'::jsonb)
$$;

-- 3) Reescreve as policies que referenciam user_metadata direto (ALTER preserva
--    nome/comando/roles; só troca a fonte da claim). Dinâmico = à prova da
--    divergência de nomes entre ambientes.
do $$
declare
  r record;
  new_using text;
  new_check text;
begin
  for r in
    select pol.polname,
           ns.nspname,
           cls.relname,
           pg_get_expr(pol.polqual, pol.polrelid)      as using_expr,
           pg_get_expr(pol.polwithcheck, pol.polrelid) as check_expr
    from pg_policy pol
    join pg_class cls     on cls.oid = pol.polrelid
    join pg_namespace ns  on ns.oid = cls.relnamespace
    where ns.nspname = 'public'
      and (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '')      like '%user_metadata%'
        or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%user_metadata%')
  loop
    new_using := replace(coalesce(r.using_expr, ''), 'user_metadata', 'app_metadata');
    new_check := replace(coalesce(r.check_expr, ''), 'user_metadata', 'app_metadata');

    if r.using_expr is not null and r.check_expr is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)', r.polname, r.nspname, r.relname, new_using, new_check);
    elsif r.using_expr is not null then
      execute format('alter policy %I on %I.%I using (%s)', r.polname, r.nspname, r.relname, new_using);
    elsif r.check_expr is not null then
      execute format('alter policy %I on %I.%I with check (%s)', r.polname, r.nspname, r.relname, new_check);
    end if;

    raise notice 'Policy migrada: %.% / %', r.nspname, r.relname, r.polname;
  end loop;
end $$;
