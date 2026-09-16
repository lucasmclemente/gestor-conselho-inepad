-- ============================================================
-- Boardplan CRM — Quem recebe ligações (grupo de toque do inbound)
--
-- Lista de usuários que devem TOCAR quando entra ligação. O webfone de plantão
-- só registra para quem estiver aqui. Gerenciado pelo admin na tela do CRM.
--
-- Leitura: qualquer usuário do CRM do cliente (para o próprio webfone saber se toca).
-- Escrita: apenas Administrador/SuperAdmin do cliente.
-- Aditiva e idempotente. Rodar em develop, testar, depois produção.
-- ============================================================

create table if not exists public.crm_inbound_agents (
  client_id  text not null,
  member_id  uuid not null,
  created_at timestamptz not null default now(),
  primary key (client_id, member_id)
);

alter table public.crm_inbound_agents enable row level security;

drop policy if exists crm_inbound_agents_select on public.crm_inbound_agents;
create policy crm_inbound_agents_select on public.crm_inbound_agents
  for select to authenticated
  using ( public.can_access_crm(client_id) );

drop policy if exists crm_inbound_agents_write on public.crm_inbound_agents;
create policy crm_inbound_agents_write on public.crm_inbound_agents
  for all to authenticated
  using ( public.can_access_crm(client_id) and public.jwt_role() in ('SuperAdmin','Administrador') )
  with check ( public.can_access_crm(client_id) and public.jwt_role() in ('SuperAdmin','Administrador') );

grant select, insert, update, delete on public.crm_inbound_agents to authenticated;
