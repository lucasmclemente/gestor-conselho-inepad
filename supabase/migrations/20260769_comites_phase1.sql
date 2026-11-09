-- ============================================================
-- Comitês — Fase 1: fundação + isolamento (add-on)
--
-- Add-on `clients.committees_enabled`. A conta tem o Conselho (espaço base,
-- meetings.comite_id = NULL) e, com o add-on, cria Comitês (sub-espaços).
-- Spec: SPEC-comites.md.
--
-- SEGURANÇA / BAIXO RISCO: o isolamento é uma policy RESTRICTIVE (só subtrai,
-- combina por AND com as policies atuais — não reescreve nada do núcleo, então
-- NÃO esbarra na divergência prod `internal.*` × develop `jwt_*`: a mesma
-- migração roda nos dois ambientes). Enquanto não houver comitê e todos forem
-- `conselho_member = true` (default), ela é TRANSPARENTE — nada muda.
--
-- Rodar em develop, testar, depois produção. Idempotente.
-- ============================================================

-- ── Colunas novas ───────────────────────────────────────────
alter table public.clients  add column if not exists committees_enabled boolean not null default false;
alter table public.members  add column if not exists conselho_member    boolean not null default true;  -- false = pessoa só de comitê
alter table public.meetings add column if not exists comite_id          uuid;                            -- NULL = Conselho

-- ── Tabela: comites ─────────────────────────────────────────
create table if not exists public.comites (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null,
  nome       text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.comites enable row level security;
create index if not exists idx_comites_client on public.comites (client_id);

-- FK defensiva: apagar um comitê que ainda tem reuniões é BLOQUEADO (restrict)
-- para nunca "soltar" reuniões de comitê para o Conselho (comite_id vira NULL).
-- Desativar um comitê = ativo=false (soft), não apagar.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'meetings_comite_fk') then
    alter table public.meetings
      add constraint meetings_comite_fk foreign key (comite_id)
      references public.comites(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_meetings_comite on public.meetings (comite_id);

-- ── Tabela: comite_membros ──────────────────────────────────
create table if not exists public.comite_membros (
  comite_id  uuid not null references public.comites(id) on delete cascade,
  member_id  uuid not null,
  papel      text,
  created_at timestamptz not null default now(),
  primary key (comite_id, member_id)
);
alter table public.comite_membros enable row level security;
create index if not exists idx_comite_membros_member on public.comite_membros (member_id);

-- ── Helpers (SECURITY DEFINER, portáteis: leem JWT app_metadata + tabelas) ──
-- É membro do Conselho? (default true; false = só de comitê)
create or replace function public.is_conselho_member() returns boolean
  language sql stable security definer set search_path = '' as $$
    select coalesce((select m.conselho_member from public.members m where m.id = auth.uid()), true)
$$;
revoke all on function public.is_conselho_member() from public, anon;
grant execute on function public.is_conselho_member() to authenticated;

-- Tem acesso a este comitê? (é membro dele)
create or replace function public.can_access_comite(p_comite uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
    select exists (
      select 1 from public.comite_membros cm
      where cm.comite_id = p_comite and cm.member_id = auth.uid()
    )
$$;
revoke all on function public.can_access_comite(uuid) from public, anon;
grant execute on function public.can_access_comite(uuid) to authenticated;

-- Supervisiona os comitês? (Admin/Super da conta, ou Secretário do Conselho)
create or replace function public.can_supervise_comites() returns boolean
  language sql stable security definer set search_path = '' as $$
    select
      (auth.jwt() -> 'app_metadata' ->> 'role') in ('SuperAdmin','Administrador')
      or (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'Secretário'
        and public.is_conselho_member()
      )
$$;
revoke all on function public.can_supervise_comites() from public, anon;
grant execute on function public.can_supervise_comites() to authenticated;

-- O comitê está no escopo (cliente) do chamador?
create or replace function public.comite_in_my_scope(p_comite uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
    select exists (
      select 1 from public.comites c
      where c.id = p_comite and (
        c.client_id = (auth.jwt() -> 'app_metadata' ->> 'client_id')
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin'
        or ((auth.jwt() -> 'app_metadata' -> 'secretary_clients') ? c.client_id)
      )
    )
$$;
revoke all on function public.comite_in_my_scope(uuid) from public, anon;
grant execute on function public.comite_in_my_scope(uuid) to authenticated;

-- ── RLS: isolamento de reuniões por colegiado (RESTRICTIVE — só subtrai) ──
-- Quem vê/gere uma reunião:
--   • supervisor (Admin/Super/Secretário-do-Conselho): tudo da conta
--   • Conselho (comite_id NULL): quem é conselho_member
--   • Comitê (comite_id X): quem é membro de X
drop policy if exists meetings_comite_isolation on public.meetings;
create policy meetings_comite_isolation on public.meetings
  as restrictive for all to authenticated
  using (
    public.can_supervise_comites()
    or (comite_id is null and public.is_conselho_member())
    or (comite_id is not null and public.can_access_comite(comite_id))
  )
  with check (
    public.can_supervise_comites()
    or (comite_id is null and public.is_conselho_member())
    or (comite_id is not null and public.can_access_comite(comite_id))
  );

-- ── RLS: comites ────────────────────────────────────────────
-- Leitura: supervisor (do cliente) ou membro do comitê (p/ o seletor)
drop policy if exists comites_select on public.comites;
create policy comites_select on public.comites for select to authenticated
  using (
    (
      client_id = (auth.jwt() -> 'app_metadata' ->> 'client_id')
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin'
      or ((auth.jwt() -> 'app_metadata' -> 'secretary_clients') ? client_id)
    )
    and ( public.can_supervise_comites() or public.can_access_comite(id) )
  );

-- Escrita: só supervisor, dentro do seu cliente
drop policy if exists comites_write on public.comites;
create policy comites_write on public.comites for all to authenticated
  using (
    public.can_supervise_comites() and (
      client_id = (auth.jwt() -> 'app_metadata' ->> 'client_id')
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin'
      or ((auth.jwt() -> 'app_metadata' -> 'secretary_clients') ? client_id)
    )
  )
  with check (
    public.can_supervise_comites() and (
      client_id = (auth.jwt() -> 'app_metadata' ->> 'client_id')
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin'
      or ((auth.jwt() -> 'app_metadata' -> 'secretary_clients') ? client_id)
    )
  );
grant select, insert, update, delete on public.comites to authenticated;

-- ── RLS: comite_membros ─────────────────────────────────────
-- Leitura: a própria pessoa, o supervisor do cliente, ou um membro do comitê
drop policy if exists comite_membros_select on public.comite_membros;
create policy comite_membros_select on public.comite_membros for select to authenticated
  using (
    member_id = auth.uid()
    or (public.can_supervise_comites() and public.comite_in_my_scope(comite_id))
    or public.can_access_comite(comite_id)
  );

-- Escrita: só supervisor, dentro do seu cliente
drop policy if exists comite_membros_write on public.comite_membros;
create policy comite_membros_write on public.comite_membros for all to authenticated
  using ( public.can_supervise_comites() and public.comite_in_my_scope(comite_id) )
  with check ( public.can_supervise_comites() and public.comite_in_my_scope(comite_id) );
grant select, insert, update, delete on public.comite_membros to authenticated;
