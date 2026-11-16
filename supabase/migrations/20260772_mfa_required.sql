-- ============================================================================
-- Segurança — MFA (dupla autenticação) obrigatória por cliente
-- ----------------------------------------------------------------------------
-- Flag por cliente (começa DESLIGADA). Quando ligada, todos os usuários desse
-- cliente são obrigados a cadastrar e usar um 2º fator (TOTP, app autenticador)
-- para entrar. O fator em si é gerido pelo Supabase Auth (auth.mfa_factors) —
-- aqui só guardamos a POLÍTICA de exigência por tenant. Qualquer usuário pode
-- cadastrar MFA voluntariamente mesmo sem a flag.
-- ============================================================================

alter table public.clients
  add column if not exists mfa_required boolean not null default false;

comment on column public.clients.mfa_required is
  'Segurança: exige MFA (2FA TOTP) de todos os usuários deste cliente para entrar. Off por padrão.';
