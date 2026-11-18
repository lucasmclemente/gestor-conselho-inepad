-- 20260774_mfa_enforce_aal2.sql
-- Correção A1 da auditoria de 18/11/2026: o MFA (2FA) era enforçado só no React —
-- um token aal1 (só senha, sem o TOTP) acessava todos os dados via API direta,
-- porque NENHUMA policy checava o nível de autenticação. Esta migração adiciona uma
-- camada RLS RESTRICTIVE que, para tenants com clients.mfa_required = true, exige
-- aal2 (segundo fator cumprido na sessão) antes de ler/gravar dados sensíveis.
--
-- Salvaguardas anti-deadlock (o app lê estas coisas AINDA em aal1, antes do gate):
--   • `clients` NÃO é gateado (o próprio check de MFA lê clients.mfa_required/active).
--   • `members` permite o usuário ler a PRÓPRIA linha em aal1 (bootstrap do perfil);
--     colegas só com aal2.
--   • `audit_logs`/`server_audit_logs` não bloqueiam INSERT (log é best-effort).
-- Edge Functions usam service_role, que IGNORA RLS (inclusive RESTRICTIVE) — nenhum
-- fluxo de servidor é afetado. Tenants sem mfa_required: mfa_satisfied() => true sempre.
--
-- DEVELOP: usa public.jwt_client_id() (helper que lê app_metadata).
-- PRODUÇÃO: as policies do núcleo usam o schema internal.*; ao portar, trocar
--   public.jwt_client_id() por internal.get_my_client_id() dentro do helper. VALIDAR NA DEVELOP ANTES.

-- 1) Helper: a sessão satisfez o MFA exigido pelo tenant do chamador?
create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
    or not exists (
      select 1
      from public.clients c
      where c.client_id = public.jwt_client_id()
        and c.mfa_required
    );
$$;

revoke all on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated;

comment on function public.mfa_satisfied() is
  'True se a sessão é aal2 OU o tenant do chamador não exige MFA. Usada em policies RESTRICTIVE para enforçar 2FA no servidor (auditoria A1, 18/11/2026).';

-- 2) Aplica a policy RESTRICTIVE nas tabelas de dados sensíveis.
--    RESTRICTIVE = AND com as policies permissivas existentes (só subtrai acesso).
--    `clients` é deliberadamente OMITIDO (bootstrap do gate de MFA).
do $$
declare
  t text;
  tables text[] := array[
    -- núcleo
    'meetings','members','audit_logs','server_audit_logs',
    -- indicadores / gatilhos / estratégia
    'indicators','indicator_readings','indicator_targets','triggers','trigger_events',
    'governance_settings','fca','strategy_framework','perspectives','objectives',
    'objective_links','swot_items',
    -- OKR
    'okr_cycles','okr_objectives','key_results','key_result_checkins',
    -- maturidade / selo
    'maturity_criteria','maturity_answers','maturity_history','maturity_achievements',
    'governance_seals','ai_usage',
    -- Q&A (staff) / comitês / logs
    'qa_sessions','qa_questions','qa_survey_responses','comites','comite_membros',
    'material_access_logs',
    -- CRM (desligado em prod, mas protegido se religar)
    'crm_pipelines','crm_stages','crm_organizations','crm_contacts','crm_deals',
    'crm_activities','crm_field_defs','crm_tags','crm_deal_events',
    'crm_outlook_connections','crm_email_signatures'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists require_mfa_aal2 on public.%I', t);

      if t = 'members' then
        -- própria linha sempre legível em aal1 (bootstrap); demais exigem aal2
        execute format($f$
          create policy require_mfa_aal2 on public.%I as restrictive to authenticated
            using ( (select public.mfa_satisfied()) or id = auth.uid() )
            with check ( (select public.mfa_satisfied()) )
        $f$, t);

      elsif t in ('audit_logs','server_audit_logs') then
        -- leitura exige aal2; INSERT de log nunca é bloqueado (best-effort / imutável)
        execute format($f$
          create policy require_mfa_aal2 on public.%I as restrictive to authenticated
            using ( (select public.mfa_satisfied()) )
            with check ( true )
        $f$, t);

      else
        execute format($f$
          create policy require_mfa_aal2 on public.%I as restrictive to authenticated
            using ( (select public.mfa_satisfied()) )
            with check ( (select public.mfa_satisfied()) )
        $f$, t);
      end if;
    end if;
  end loop;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK (se necessário):
--   do $$ declare t text; tables text[] := array[/* mesma lista acima */];
--   begin foreach t in array tables loop
--     if to_regclass('public.'||t) is not null then
--       execute format('drop policy if exists require_mfa_aal2 on public.%I', t);
--     end if; end loop; end $$;
--   drop function if exists public.mfa_satisfied();
-- ───────────────────────────────────────────────────────────────────────────
