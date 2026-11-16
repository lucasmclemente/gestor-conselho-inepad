-- ============================================================================
-- Segurança — SSO (login único) por cliente: campos de base
-- ----------------------------------------------------------------------------
-- Groundwork para o SSO empresarial (multi-cliente, por domínio). Aqui só
-- guardamos, por tenant, SE o SSO está habilitado e QUAIS domínios de e-mail
-- corporativo pertencem ao cliente. O provedor de identidade (Microsoft Entra /
-- Google Workspace) em si é configurado no Supabase Auth; o provisionamento no
-- 1º login usa estes domínios para reconhecer de qual cliente é o funcionário.
-- Ambos começam DESLIGADOS/VAZIOS — nenhuma mudança de comportamento até o SSO
-- ser de fato ligado numa etapa futura.
-- ============================================================================

alter table public.clients
  add column if not exists sso_enabled boolean not null default false,
  add column if not exists sso_domains text[] not null default '{}';

comment on column public.clients.sso_enabled is
  'SSO: habilita login único (Entra/Google) para funcionários deste cliente. Off por padrão.';
comment on column public.clients.sso_domains is
  'SSO: domínios de e-mail corporativo deste cliente (ex: {empresa.com,empresa.com.br}). Usado para rotear o login ao IdP certo e provisionar client_id/role no 1º acesso.';
