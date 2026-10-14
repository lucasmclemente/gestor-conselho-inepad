-- ============================================================
-- Rastreio de acesso a materiais (Engajamento — fase 2).
-- Registra quem ABRIU/BAIXOU cada material, via link rastreado do e-mail
-- (track-material, identifica pelo token) ou dentro do app (logado).
-- INSERT só pela Edge Function (service role). SELECT para staff do tenant.
-- Aditivo e idempotente.
-- ============================================================

create table if not exists public.material_access_logs (
  id            uuid primary key default gen_random_uuid(),
  client_id     text not null,
  meeting_id    uuid,
  material_name text,
  user_name     text,
  user_email    text,
  source        text not null default 'app',   -- app | email
  created_at    timestamptz not null default now()
);
create index if not exists material_access_meeting_idx on public.material_access_logs (client_id, meeting_id);
create index if not exists material_access_user_idx on public.material_access_logs (client_id, user_name);

alter table public.material_access_logs enable row level security;

-- Staff do tenant lê (painel de Engajamento). Inserção só via Edge Function (service role).
drop policy if exists material_access_read on public.material_access_logs;
create policy material_access_read on public.material_access_logs for select to authenticated
  using (
    public.jwt_role() = 'SuperAdmin'
    or (public.jwt_role() in ('Administrador','Secretário')
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  );
