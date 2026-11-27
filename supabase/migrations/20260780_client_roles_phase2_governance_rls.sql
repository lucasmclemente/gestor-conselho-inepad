-- ============================================================
-- Papéis por cliente — FASE 2: RLS de GOVERNANÇA por cliente.
-- As policies de indicadores/estratégia/OKR/maturidade/QA/comitês que hoje checam
-- o papel GLOBAL (can_read_governance() / can_write_governance()) passam a checar o
-- papel EFETIVO no cliente da LINHA (versões (client_id), criadas na FASE 1).
--
-- Portável (prod + develop): a GOVERNANÇA usa os helpers jwt_* nos dois ambientes.
-- NÃO toca no núcleo (meetings/members/audit) — isso é a FASE 3 (diverge prod×develop).
-- Idempotente: a regex exige parênteses VAZIOS, então rodar de novo não reprocessa.
-- Plano: SPEC-papeis-por-cliente.md (§3.2).
--
-- Compat: para quem não tem client_roles, jwt_role_for(cid) = jwt_role() → inalterado.
-- ============================================================

-- 1) Reescreve dinamicamente os call sites: can_(read|write)_governance() → (client_id).
--    Toda policy que usa esses helpers está em tabela de governança com coluna client_id
--    (já aparecem junto de gov_tenant_visible(client_id)); o ALTER preserva nome/comando/roles.
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
    join pg_class cls    on cls.oid = pol.polrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    where ns.nspname = 'public'
      and ( coalesce(pg_get_expr(pol.polqual, pol.polrelid), '')      ~ 'can_(read|write)_governance\(\)'
         or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ~ 'can_(read|write)_governance\(\)' )
  loop
    new_using := regexp_replace(coalesce(r.using_expr, ''), 'can_(read|write)_governance\(\)', 'can_\1_governance(client_id)', 'g');
    new_check := regexp_replace(coalesce(r.check_expr, ''), 'can_(read|write)_governance\(\)', 'can_\1_governance(client_id)', 'g');

    if r.using_expr is not null and r.check_expr is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)', r.polname, r.nspname, r.relname, new_using, new_check);
    elsif r.using_expr is not null then
      execute format('alter policy %I on %I.%I using (%s)', r.polname, r.nspname, r.relname, new_using);
    elsif r.check_expr is not null then
      execute format('alter policy %I on %I.%I with check (%s)', r.polname, r.nspname, r.relname, new_check);
    end if;

    raise notice 'FASE 2 — policy de governança migrada: %.% / %', r.nspname, r.relname, r.polname;
  end loop;
end $$;

-- 2) indicator_readings.readings_write: Controller/Diretor também por cliente
--    (inline jwt_role() → jwt_role_for(client_id)). Definição explícita (espelha 20260760).
drop policy if exists readings_write on public.indicator_readings;
create policy readings_write on public.indicator_readings for all to authenticated
  using (
    ( public.can_write_governance(client_id)
      or public.jwt_role_for(client_id) in ('Controller','Diretor') )
    and public.gov_tenant_visible(client_id)
  )
  with check (
    ( public.can_write_governance(client_id)
      or public.jwt_role_for(client_id) in ('Controller','Diretor') )
    and public.gov_tenant_visible(client_id)
  );

-- Nota: indicator_targets.targets_write foi migrada pelo passo 1 para can_write_governance(client_id)
-- → Adm/Sec do cliente escrevem metas; Controller/Diretor continuam de fora (não constam ali).
