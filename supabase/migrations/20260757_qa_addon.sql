-- ============================================================
-- Add-on "Perguntas ao Vivo" (Q&A de eventos, estilo Slido).
-- Participante envia pergunta SEM login (via Edge Function qa-public, service role);
-- o staff do cliente (Adm/Sec/Super) modera pela plataforma. Ligado por cliente
-- pela flag clients.qa_enabled (toggle do SuperAdmin). Aditiva/idempotente.
-- ============================================================

alter table public.clients add column if not exists qa_enabled boolean default false;

-- Sessão de perguntas (um evento/reunião). code = string curta do link público/QR.
create table if not exists public.qa_sessions (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null,
  title      text not null,
  code       text not null unique,
  open       boolean not null default true,   -- aceitando perguntas?
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists qa_sessions_client_idx on public.qa_sessions (client_id);

-- Perguntas recebidas
create table if not exists public.qa_questions (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.qa_sessions(id) on delete cascade,
  client_id   text not null,
  body        text not null,
  author_name text,
  status      text not null default 'new',     -- new | answered | archived
  votes       int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists qa_questions_session_idx on public.qa_questions (session_id, created_at desc);

-- Dedup de votos por dispositivo (só via Edge Function; sem acesso direto)
create table if not exists public.qa_votes (
  question_id uuid not null references public.qa_questions(id) on delete cascade,
  device_id   text not null,
  created_at  timestamptz not null default now(),
  primary key (question_id, device_id)
);

-- ── RLS: staff do cliente gerencia; público acessa só pela Edge Function (service role) ──
alter table public.qa_sessions  enable row level security;
alter table public.qa_questions enable row level security;
alter table public.qa_votes     enable row level security;

drop policy if exists qa_sessions_staff on public.qa_sessions;
create policy qa_sessions_staff on public.qa_sessions for all to authenticated
  using (
    public.jwt_role() = 'SuperAdmin'
    or (public.jwt_role() in ('Administrador','Secretário')
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  )
  with check (
    public.jwt_role() = 'SuperAdmin'
    or (public.jwt_role() in ('Administrador','Secretário')
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  );

drop policy if exists qa_questions_staff on public.qa_questions;
create policy qa_questions_staff on public.qa_questions for all to authenticated
  using (
    public.jwt_role() = 'SuperAdmin'
    or (public.jwt_role() in ('Administrador','Secretário')
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  )
  with check (
    public.jwt_role() = 'SuperAdmin'
    or (public.jwt_role() in ('Administrador','Secretário')
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  );

-- qa_votes: sem policies (só service role acessa) — RLS ativa bloqueia acesso direto.
