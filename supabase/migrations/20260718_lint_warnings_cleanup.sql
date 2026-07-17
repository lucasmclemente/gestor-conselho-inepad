-- ============================================================
-- FAXINA DE WARNINGS DO LINTER + hygiene de funções legado
--
-- DESCOBERTA (prod diverge da develop): existem DUAS versões dessas funções.
--
--   internal.is_super_admin() / internal.get_my_client_id()
--     - SECURITY DEFINER, search_path fixo, no schema `internal` (fora da API).
--     - Leem a TABELA public.members (role/client_id do próprio usuário).
--     - SÃO SEGURAS: usuário comum não altera o próprio registro em members
--       (escrita só Admin/SuperAdmin). São as que as políticas de prod usam.
--     >>> NÃO TOCAR <<<
--
--   public.is_super_admin() / public.get_my_client_id()
--     - Duplicatas que leem user_metadata (editável pelo usuário).
--     - Órfãs (as políticas usam as internal.*). Código morto + risco latente.
--     Esta migração: (1) blinda-as para ler app_metadata (caso algo ainda
--     dependa delas); (2) tenta removê-las sem CASCADE — se houver dependente,
--     mantém já blindada e NÃO aborta.
--
-- Também (idempotente) endurece INSERT de audit_logs que esteja com
-- WITH CHECK (true). No prod já está endurecido (internal.get_my_client_id),
-- então é no-op lá; na develop já foi aplicado.
-- Aditivo e idempotente.
-- ============================================================

-- 1) Blindar as duplicatas public.* — passam a ler app_metadata (fonte segura)
create or replace function public.get_my_client_id() returns text
  language sql stable set search_path = '' as $f$
  select auth.jwt() -> 'app_metadata' ->> 'client_id'
$f$;

create or replace function public.is_super_admin() returns boolean
  language sql stable set search_path = '' as $f$
  select (auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin'
$f$;

-- 2) Remover as duplicatas public.* se ninguém depender delas (sem CASCADE, sem abortar)
do $$
begin
  begin
    drop function public.get_my_client_id();
    raise notice 'public.get_my_client_id removida (orfa).';
  exception when dependent_objects_still_exist then
    raise notice 'public.get_my_client_id mantida (em uso) — agora le app_metadata.';
  end;

  begin
    drop function public.is_super_admin();
    raise notice 'public.is_super_admin removida (orfa).';
  exception when dependent_objects_still_exist then
    raise notice 'public.is_super_admin mantida (em uso) — agora le app_metadata.';
  end;
end $$;

-- 3) Endurecer INSERT de audit_logs com WITH CHECK (true) (idempotente)
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
