-- ============================================================
-- Papéis por cliente — FASE 3 (NÚCLEO) — ⚠️ VARIANTE PRODUÇÃO ⚠️
--
-- Reescreve as policies de PAPEL do núcleo da PRODUÇÃO para avaliarem o papel
-- EFETIVO no cliente DA LINHA (public.jwt_role_for(client_id)).
--
-- ⚠️ RODAR SOMENTE NA PRODUÇÃO (ref jrtrrubtjbinnddqdbta), DEPOIS de rodar nela
--    as migrações 20260779 (fundação) e 20260780 (governança).
--    NÃO rodar a 20260781 (variante DEVELOP) na produção, nem esta na develop.
--
-- Diferença p/ a variante DEVELOP: a produção NÃO tem policy de leitura de
-- audit_logs com trava de Admin (lá a leitura é só isolamento por cliente), então
-- audit_logs NÃO é tocada aqui. As 4 policies de papel abaixo são idênticas às da
-- develop (a prod embute app_metadata->>'role' igual). O isolamento que usa
-- internal.get_my_client_id() (leitura de logs/membros, INSERT de logs) permanece.
--
-- Compat: para quem não tem client_roles, jwt_role_for(X)=jwt_role() → inalterado.
-- Preserva: isolação por cliente, SuperAdmin global, e todas as RESTRICTIVE
-- (MFA aal2, bloqueio CRM, isolamento de comitê). Helpers public.jwt_* já leem
-- app_metadata também na prod (migração 20260717) e jwt_role_for vem da 20260779.
-- Plano: SPEC-papeis-por-cliente.md (§3.3).
-- ============================================================

-- 1) MEETINGS — gestão (criar/editar/excluir): Adm/Sec EFETIVO do cliente da reunião,
--    com acesso ao cliente (casa ou atribuído); ou SuperAdmin global.
alter policy "Apenas Adm e Sec gerem reuniões" on public.meetings
  using (
    (
      public.jwt_role_for(client_id) = any (array['Administrador','Secretário'])
      and ( client_id = public.jwt_client_id() or public.jwt_secretary_clients() ? client_id )
    )
    or public.jwt_role() = 'SuperAdmin'
  )
  with check (
    (
      public.jwt_role_for(client_id) = any (array['Administrador','Secretário'])
      and ( client_id = public.jwt_client_id() or public.jwt_secretary_clients() ? client_id )
    )
    or public.jwt_role() = 'SuperAdmin'
  );

-- 2) MEETINGS — leitura: isolação por cliente + exclui quem é ASSISTENTE **naquele** cliente.
alter policy "Meetings isolation" on public.meetings
  using (
    (
      client_id = public.jwt_client_id()
      or public.jwt_role() = 'SuperAdmin'
      or public.jwt_secretary_clients() ? client_id
    )
    and public.jwt_role_for(client_id) is distinct from 'Assistente'
  );

-- 3) MEMBERS — gestão: Administrador EFETIVO do cliente do membro (casa ou atribuído),
--    ou SuperAdmin. (Antes: só o cliente-casa. Mudança intencional: administrar por cliente.)
alter policy "Admins can manage their own client members" on public.members
  using (
    (
      public.jwt_role_for(client_id) = 'Administrador'
      and ( client_id = public.jwt_client_id() or public.jwt_secretary_clients() ? client_id )
    )
    or public.jwt_role() = 'SuperAdmin'
  )
  with check (
    (
      public.jwt_role_for(client_id) = 'Administrador'
      and ( client_id = public.jwt_client_id() or public.jwt_secretary_clients() ? client_id )
    )
    or public.jwt_role() = 'SuperAdmin'
  );

-- 4) SERVER_AUDIT_LOGS — leitura por admin: Administrador EFETIVO do cliente do log (ou Super).
alter policy "Admins can view server audit logs" on public.server_audit_logs
  using (
    (
      public.jwt_role_for(client_id) = 'Administrador'
      and ( client_id = public.jwt_client_id() or public.jwt_secretary_clients() ? client_id )
    )
    or public.jwt_role() = 'SuperAdmin'
  );

-- Inalteradas de propósito na PROD:
--   audit_logs (leitura por isolamento, sem trava de Admin; INSERT por internal.get_my_client_id),
--   members "Privacidade de membros" / "Users can view colleagues" (isolamento),
--   server_audit_logs "Admin can view logs" (só Super),
--   *_block_crm_role, meetings_comite_isolation, require_mfa_aal2 (RESTRICTIVE).
