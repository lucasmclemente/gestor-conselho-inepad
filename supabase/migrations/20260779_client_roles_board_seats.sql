-- ============================================================
-- Papéis por cliente + Assento de conselheiro (deliberativo/consultivo)
-- FASE 1 — FUNDAÇÃO. Aditiva, idempotente e PORTÁVEL (prod + develop).
-- NÃO altera nenhuma policy → comportamento 100% inalterado.
-- Plano completo: SPEC-papeis-por-cliente.md (§2, §3.1, §3.2).
--
-- Dois conceitos que hoje estão grudados no papel único, aqui separados:
--  (1) PAPEL DE GESTÃO por cliente  → members.client_roles / app_metadata.client_roles
--  (2) ASSENTO NO CONSELHO por cliente → members.board_seats / app_metadata.board_seats
--      assento 'deliberativo' = assina + vota + aprova; 'consultivo' = só aprova; ausente = nenhum.
-- ============================================================

-- 1) Colunas novas em members (espelham o que também vai no app_metadata da JWT)
alter table public.members add column if not exists client_roles jsonb not null default '{}'::jsonb;
alter table public.members add column if not exists board_seats  jsonb not null default '{}'::jsonb;

comment on column public.members.client_roles is
  'Mapa {client_id: papel_de_gestao} — papel por cliente. Vazio = usa o papel global (role). Espelha app_metadata.client_roles.';
comment on column public.members.board_seats is
  'Mapa {client_id: deliberativo|consultivo} — assento no conselho por cliente, independente do papel de gestao. Espelha app_metadata.board_seats.';

-- 2) Helpers de JWT (search_path travado; leem app_metadata = fonte segura, só service_role grava)
create or replace function public.jwt_client_roles() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' -> 'client_roles', '{}'::jsonb)
$$;

create or replace function public.jwt_board_seats() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' -> 'board_seats', '{}'::jsonb)
$$;

-- Papel EFETIVO de gestão no cliente X: papel específico do cliente, senão o papel global.
create or replace function public.jwt_role_for(cid text) returns text
language sql stable set search_path = '' as $$
  select coalesce(public.jwt_client_roles() ->> cid, public.jwt_role())
$$;

-- Assento EFETIVO no cliente X: atribuição explícita (board_seats) ganha; senão é inferido
-- do papel efetivo (Conselheiro → deliberativo; Conselheiro Consultivo → consultivo; senão nenhum).
create or replace function public.jwt_board_seat_for(cid text) returns text
language sql stable set search_path = '' as $$
  select coalesce(
    public.jwt_board_seats() ->> cid,
    case public.jwt_role_for(cid)
      when 'Conselheiro'            then 'deliberativo'
      when 'Conselheiro Consultivo' then 'consultivo'
      else null
    end
  )
$$;

-- 3) Overloads CLIENT-AWARE dos gates de governança. As versões SEM-ARG continuam existindo
--    (compatibilidade); as policies passam a usar estas na FASE 2.
--    Incluem o novo papel 'Conselheiro Consultivo' na LEITURA.
create or replace function public.can_read_governance(cid text) returns boolean
language sql stable set search_path = '' as $$
  select public.jwt_role_for(cid) in
    ('SuperAdmin','Administrador','Secretário','Conselheiro','Conselheiro Consultivo','Controller','Diretor')
$$;

create or replace function public.can_write_governance(cid text) returns boolean
language sql stable set search_path = '' as $$
  select public.jwt_role_for(cid) in ('SuperAdmin','Administrador','Secretário')
$$;

-- 4) Atualiza a versão SEM-ARG de can_read_governance p/ reconhecer o 'Conselheiro Consultivo'
--    também (enquanto as policies não migram na FASE 2). Mantém Controller/Diretor.
create or replace function public.can_read_governance() returns boolean
language sql stable set search_path = '' as $$
  select public.jwt_role() in
    ('SuperAdmin','Administrador','Secretário','Conselheiro','Conselheiro Consultivo','Controller','Diretor')
$$;

-- Nota: can_write_governance() SEM-ARG não muda (Consultivo não escreve governança).
-- Nenhuma policy foi tocada aqui. FASE 2 troca os call sites para as versões (cid).
