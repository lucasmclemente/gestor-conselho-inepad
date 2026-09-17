-- ============================================================
-- Boardplan CRM — Assinatura de e-mail (por usuário)
--
-- Cada usuário configura um texto e/ou uma imagem que é anexada ao final de
-- todos os e-mails enviados pelo CRM (via outlook-send).
--
-- Imagem em bucket PÚBLICO (crm-signatures) para o cliente de e-mail conseguir
-- carregar por URL (assinaturas não são sensíveis).
-- Aditiva e idempotente. Rodar em develop, testar, depois produção.
-- ============================================================

create table if not exists public.crm_email_signatures (
  client_id  text not null,
  member_id  uuid not null primary key,
  sig_text   text,
  image_url  text,
  updated_at timestamptz not null default now()
);

alter table public.crm_email_signatures enable row level security;

-- cada um lê/gerencia a PRÓPRIA assinatura (outlook-send lê via service_role)
drop policy if exists crm_sig_own on public.crm_email_signatures;
create policy crm_sig_own on public.crm_email_signatures
  for all to authenticated
  using ( member_id = auth.uid() and public.can_access_crm(client_id) )
  with check ( member_id = auth.uid() and public.can_access_crm(client_id) );

grant select, insert, update, delete on public.crm_email_signatures to authenticated;

-- bucket público das imagens de assinatura
insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-signatures', 'crm-signatures', true, 5242880)
on conflict (id) do update set public = true, file_size_limit = 5242880;

-- upload/alteração/remoção só na própria pasta (1º segmento = id do usuário); leitura é pública
drop policy if exists crm_sig_insert on storage.objects;
create policy crm_sig_insert on storage.objects for insert to authenticated
  with check ( bucket_id = 'crm-signatures' and (storage.foldername(name))[1] = auth.uid()::text );
drop policy if exists crm_sig_update on storage.objects;
create policy crm_sig_update on storage.objects for update to authenticated
  using ( bucket_id = 'crm-signatures' and (storage.foldername(name))[1] = auth.uid()::text );
drop policy if exists crm_sig_delete on storage.objects;
create policy crm_sig_delete on storage.objects for delete to authenticated
  using ( bucket_id = 'crm-signatures' and (storage.foldername(name))[1] = auth.uid()::text );
