-- ============================================================
-- Histórico da nota de maturidade (roadmap "Histórico da nota").
-- Guarda snapshots do índice de governança (0–100) + notas por pilar ao longo
-- do tempo, para o cliente acompanhar a PRÓPRIA evolução mês a mês.
-- O índice é calculado no front (computeGovernance); o snapshot é gravado a
-- partir da tela (1 por dia, atualizado se a nota mudar) e na emissão do selo.
-- Leitura/escrita: Adm/Sec/Super do cliente (+ secretary_clients). Conselheiro fora.
-- ============================================================

create table if not exists public.maturity_history (
  id            uuid primary key default gen_random_uuid(),
  client_id     text not null,
  snapshot_date date not null default current_date,
  overall       int  not null,
  pillars       jsonb not null default '[]'::jsonb,   -- [{key,label,score}]
  source        text not null default 'auto',          -- 'auto' | 'selo'
  created_by    text,
  created_at    timestamptz not null default now(),
  unique (client_id, snapshot_date)
);
create index if not exists maturity_history_client_idx on public.maturity_history (client_id, snapshot_date);
alter table public.maturity_history enable row level security;

drop policy if exists maturity_history_read on public.maturity_history;
create policy maturity_history_read on public.maturity_history
  for select to authenticated using (
    public.jwt_role() = 'SuperAdmin'
    or (public.jwt_role() in ('Administrador', 'Secretário')
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  );

drop policy if exists maturity_history_write on public.maturity_history;
create policy maturity_history_write on public.maturity_history
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
