-- ============================================================
-- Add-on "Perguntas ao Vivo": modo Pesquisa de Satisfação.
-- A mesma sessão (mesmo link/QR) alterna entre 'questions' (Q&A) e 'survey'.
-- O staff monta o questionário (survey jsonb) e vê os resultados agregados.
-- Respostas gravadas pela Edge Function qa-public (service role). Aditiva/idempotente.
-- ============================================================

alter table public.qa_sessions add column if not exists mode   text  not null default 'questions'; -- questions | survey
alter table public.qa_sessions add column if not exists survey jsonb not null default '[]'::jsonb;  -- [{id,type:'text'|'choice',label,options?,multi?}]

-- Respostas da pesquisa (1 por dispositivo; upsert)
create table if not exists public.qa_survey_responses (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.qa_sessions(id) on delete cascade,
  client_id   text not null,
  device_id   text not null,
  answers     jsonb not null default '{}'::jsonb,  -- { [questionId]: string | string[] }
  created_at  timestamptz not null default now(),
  unique (session_id, device_id)
);
create index if not exists qa_survey_responses_session_idx on public.qa_survey_responses (session_id);

alter table public.qa_survey_responses enable row level security;

-- Staff do tenant lê os resultados; inserção só via Edge Function (service role).
drop policy if exists qa_survey_responses_staff on public.qa_survey_responses;
create policy qa_survey_responses_staff on public.qa_survey_responses for select to authenticated
  using (
    public.jwt_role() = 'SuperAdmin'
    or (public.jwt_role() in ('Administrador','Secretário')
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  );
