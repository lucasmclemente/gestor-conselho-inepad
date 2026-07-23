-- ============================================================
-- Selo de Governança INEPAD (Camada 5). Certificação emitida pela INEPAD a um
-- cliente que atinge um patamar de maturidade. Níveis Bronze/Prata/Ouro,
-- validade (padrão 24 meses), código de verificação único e snapshot das notas.
-- Emissão só por SuperAdmin; leitura por Adm/Sec/Super do cliente.
-- ============================================================

create table if not exists public.governance_seals (
  id                uuid primary key default gen_random_uuid(),
  client_id         text not null,
  level             text not null,                 -- 'bronze' | 'prata' | 'ouro'
  score_snapshot    jsonb,                         -- índice + pilares no momento da emissão
  verification_code text not null unique,
  issued_by         text,
  issued_at         timestamptz not null default now(),
  valid_until       timestamptz not null,
  status            text not null default 'valido',  -- 'valido' | 'revogado'
  created_at        timestamptz not null default now()
);
create index if not exists governance_seals_client_idx on public.governance_seals (client_id, issued_at desc);
alter table public.governance_seals enable row level security;

drop policy if exists governance_seals_read on public.governance_seals;
create policy governance_seals_read on public.governance_seals
  for select to authenticated using (
    public.jwt_role() = 'SuperAdmin'
    or (public.jwt_role() in ('Administrador', 'Secretário')
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  );
drop policy if exists governance_seals_write on public.governance_seals;
create policy governance_seals_write on public.governance_seals
  for all to authenticated
  using (public.jwt_role() = 'SuperAdmin')
  with check (public.jwt_role() = 'SuperAdmin');
