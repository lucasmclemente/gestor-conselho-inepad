-- ============================================================
-- FAXINA DE WARNINGS DO LINTER (pós-migração app_metadata)
--
-- (A) Remove as funções legado is_super_admin()/get_my_client_id():
--     - Estão ÓRFÃS (nenhuma policy nem o app as usa).
--     - Leem user_metadata (mesma falha que acabamos de corrigir) — bomba
--       relógio se alguém as usasse numa policy no futuro.
--     - Disparam os warnings: function_search_path_mutable (0011) e
--       anon/authenticated_security_definer_function_executable (0028/0029).
--     Removê-las mata todos esses warnings de uma vez. Guard: se alguma
--     policy as referenciar, ABORTA para revisão manual (não usa CASCADE).
--
-- (B) Endurece o INSERT de audit_logs (warning rls_policy_always_true / 0024):
--     WITH CHECK (true) deixava qualquer autenticado inserir log com QUALQUER
--     client_id (forjar log de outra empresa). Passa a exigir que o client_id
--     seja o do próprio usuário (ou de um cliente que ele administra, ou Super).
--     A escrita da própria app (addLog) já usa activeClientId/client_id do
--     usuário, então não quebra. Inserts por Edge Function usam service_role,
--     que ignora RLS — também não são afetados.
--     Dinâmico (por polcmd), à prova da divergência de nomes entre ambientes.
-- Aditivo e idempotente.
-- ============================================================

-- (A) Remover funções legado, com trava de segurança
do $$
declare
  used int;
begin
  select count(*) into used
  from pg_policy pol
  where pg_get_expr(pol.polqual, pol.polrelid)      ~ '(is_super_admin|get_my_client_id)'
     or pg_get_expr(pol.polwithcheck, pol.polrelid) ~ '(is_super_admin|get_my_client_id)';

  if used > 0 then
    raise exception 'Abortado: % policy(ies) ainda usam is_super_admin/get_my_client_id — migrar essas policies para jwt_role()/jwt_client_id() antes de remover.', used;
  end if;

  drop function if exists public.is_super_admin();
  drop function if exists public.get_my_client_id();
  raise notice 'Funcoes legado is_super_admin/get_my_client_id removidas.';
end $$;

-- (B) Endurecer o(s) policy(ies) de INSERT de audit_logs com WITH CHECK (true)
do $$
declare
  r record;
begin
  for r in
    select pol.polname
    from pg_policy pol
    join pg_class cls    on cls.oid = pol.polrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    where ns.nspname = 'public'
      and cls.relname = 'audit_logs'
      and pol.polcmd = 'a'  -- INSERT
      and coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') in ('true', '(true)')
  loop
    execute format(
      'alter policy %I on public.audit_logs with check ('
      || 'public.jwt_role() = ''SuperAdmin'' '
      || 'or client_id = public.jwt_client_id() '
      || 'or (public.jwt_secretary_clients() ? client_id))',
      r.polname
    );
    raise notice 'audit_logs INSERT endurecido: %', r.polname;
  end loop;
end $$;
