-- ============================================================
-- Papéis por cliente — FASE 3 (NÚCLEO) — ⚠️ VARIANTE DEVELOP ⚠️
--
-- Reescreve as policies de papel do núcleo (meetings/members/audit_logs/
-- server_audit_logs) para avaliarem o papel EFETIVO no cliente DA LINHA
-- (jwt_role_for(client_id)) em vez do papel global.
--
-- ⚠️ NÃO RODAR EM PRODUÇÃO. A produção usa o schema internal.* nessas policies
-- (divergência conhecida) → terá uma variante _PROD própria, escrita depois de
-- inspecionar as policies reais da prod. Esta versão casa com o texto atual da DEVELOP.
--
-- Compat: para quem não tem client_roles, jwt_role_for(X)=jwt_role() → inalterado.
-- Preserva: isolação por cliente (casa + secretary_clients), SuperAdmin global,
-- e todas as policies RESTRICTIVE (MFA aal2, bloqueio CRM, isolamento de comitê).
-- Plano: SPEC-papeis-por-cliente.md (§3.2, §3.3).
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

-- 4) AUDIT_LOGS — leitura por admin: Administrador EFETIVO do cliente do log (ou Super).
alter policy "Admins can view audit logs" on public.audit_logs
  using (
    (
      public.jwt_role_for(client_id) = 'Administrador'
      and ( client_id = public.jwt_client_id() or public.jwt_secretary_clients() ? client_id )
    )
    or public.jwt_role() = 'SuperAdmin'
  );

-- 5) SERVER_AUDIT_LOGS — leitura por admin: idem.
alter policy "Admins can view server audit logs" on public.server_audit_logs
  using (
    (
      public.jwt_role_for(client_id) = 'Administrador'
      and ( client_id = public.jwt_client_id() or public.jwt_secretary_clients() ? client_id )
    )
    or public.jwt_role() = 'SuperAdmin'
  );

-- Inalteradas de propósito (não gateiam papel de governança por cliente):
--   members "Users can view colleagues" / "Members can view their own data" (visibilidade/próprio),
--   audit_logs INSERT (isolação de escrita), server_audit_logs "Admin can view logs" (só Super),
--   *_block_crm_role, meetings_comite_isolation, require_mfa_aal2 (RESTRICTIVE).
