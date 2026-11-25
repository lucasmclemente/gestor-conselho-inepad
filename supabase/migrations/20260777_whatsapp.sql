-- ============================================================
-- Add-on WhatsApp (avisos + links) — base de dados.
-- Canal de notificação que ESPELHA os e-mails e deep-linka para as páginas
-- seguras já existentes (token/página autenticada). NÃO fecha voto/aprovação
-- dentro do WhatsApp. Add-on por cliente (clients.whatsapp_enabled). Dormente
-- até os secrets da Meta + opt-in do membro. Aditivo e idempotente.
-- Portável (prod schema internal.* + develop jwt_*): usa só DDL + jwt_* helpers.
-- ============================================================

-- 1) Telefone + consentimento no membro (PII, já isolado por client_id na RLS de members)
alter table public.members
  add column if not exists phone text,                         -- E.164: +5511999999999
  add column if not exists wa_opt_in boolean not null default false,
  add column if not exists wa_opt_in_at timestamptz;

-- 2) Add-on por cliente (padrão dos demais add-ons)
alter table public.clients
  add column if not exists whatsapp_enabled boolean not null default false;

-- 3) Trilha de entrega (espelha material_access_logs)
create table if not exists public.whatsapp_logs (
  id           uuid primary key default gen_random_uuid(),
  client_id    text not null,
  member_email text,
  phone        text,
  template     text,            -- nome do template Meta (ex: convocacao_reuniao)
  meeting_id   uuid,
  wam_id       text,            -- id da mensagem retornado pela Meta
  status       text,            -- sent | delivered | read | failed (via webhook)
  error        text,
  created_at   timestamptz not null default now()
);
create index if not exists whatsapp_logs_client_idx on public.whatsapp_logs (client_id, created_at desc);
create index if not exists whatsapp_logs_meeting_idx on public.whatsapp_logs (client_id, meeting_id);

alter table public.whatsapp_logs enable row level security;

-- Staff do tenant lê. INSERT só via Edge Function (service role, ignora RLS) — sem policy de insert.
drop policy if exists whatsapp_logs_read on public.whatsapp_logs;
create policy whatsapp_logs_read on public.whatsapp_logs for select to authenticated
  using (
    public.jwt_role() = 'SuperAdmin'
    or (public.jwt_role() in ('Administrador','Secretário')
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  );

-- MFA aal2 (RESTRICTIVE) para leitura, como as demais tabelas sensíveis (contém PII).
-- Só cria se o helper existir (migração 20260774 já aplicada nos 2 ambientes).
do $$ begin
  if to_regprocedure('public.mfa_satisfied()') is not null then
    execute 'drop policy if exists require_mfa_aal2 on public.whatsapp_logs';
    execute $p$
      create policy require_mfa_aal2 on public.whatsapp_logs as restrictive to authenticated
        using ((select public.mfa_satisfied())) with check (true)
    $p$;
  end if;
end $$;
