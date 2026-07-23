-- ============================================================
-- Conquistas de governança (gamificação — marcos sóbrios e PERMANENTES).
-- Cada conquista é derivada dos dados reais (índice, atas, deliberações, plano,
-- evidências, selo, evolução). Diferente da "Trilha" (estado ao vivo), a conquista
-- é registrada uma vez com a data e permanece (coleção/troféu). O app calcula o
-- que foi conquistado e insere o que ainda não está registrado ao abrir a Maturidade.
-- Leitura: Adm/Sec/Super/Certificador do cliente. Escrita (award): Adm/Sec/Super do cliente.
-- ============================================================

create table if not exists public.maturity_achievements (
  id             uuid primary key default gen_random_uuid(),
  client_id      text not null,
  achievement_id text not null,
  earned_at      timestamptz not null default now(),
  unique (client_id, achievement_id)
);
create index if not exists maturity_achievements_client_idx on public.maturity_achievements (client_id);
alter table public.maturity_achievements enable row level security;

drop policy if exists maturity_achievements_read on public.maturity_achievements;
create policy maturity_achievements_read on public.maturity_achievements
  for select to authenticated using (
    public.jwt_role() in ('SuperAdmin', 'Certificador')
    or (public.jwt_role() in ('Administrador', 'Secretário')
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  );

drop policy if exists maturity_achievements_write on public.maturity_achievements;
create policy maturity_achievements_write on public.maturity_achievements
  for all to authenticated
  using (
    public.jwt_role() = 'SuperAdmin'
    or (public.jwt_role() in ('Administrador', 'Secretário')
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  )
  with check (
    public.jwt_role() = 'SuperAdmin'
    or (public.jwt_role() in ('Administrador', 'Secretário')
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  );
