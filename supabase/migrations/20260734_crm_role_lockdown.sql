-- ============================================================
-- Boardplan — Blindagem do futuro papel "Comercial" (CRM interno)
--
-- OBJETIVO: preparar o terreno para um módulo de CRM de uso interno da
-- INEPAD, onde SDRs (papel novo 'Comercial') poderão ver APENAS o CRM e
-- NUNCA dados de governança (atas, deliberações, materiais, auditoria).
--
-- DESCOBERTA QUE MOTIVA ESTA MIGRAÇÃO: as tabelas do NÚCLEO antigo
-- (meetings, members, audit_logs) e o STORAGE (bucket meeting-files) têm
-- políticas de LEITURA permissivas que liberam "qualquer autenticado do
-- client_id", SEM filtro de papel. Um usuário 'Comercial' do tenant INEPAD
-- passaria nessas políticas e leria dados de conselho.
--   (As tabelas dos módulos novos — indicadores, estratégia, OKR, SWOT,
--   FCA, maturidade — já passam por can_read_governance()/
--   can_write_governance(), que são LISTA-BRANCA de papéis; logo excluem
--   'Comercial' automaticamente. Nada a fazer nelas.)
--
-- ESTRATÉGIA (segura e à prova dos dois ambientes prod/develop):
--   Em vez de reescrever as políticas permissivas legadas (cujos NOMES
--   divergem entre prod e develop e não estão versionadas), adicionamos
--   políticas RESTRICTIVE. No Postgres, políticas restritivas são
--   combinadas por AND com as permissivas — ou seja, só podem SUBTRAIR
--   acesso, nunca conceder. Impossível vazar por engano.
--
--   O predicado é uma DENYLIST do papel 'Comercial' (null-safe). Como o
--   papel 'Comercial' ainda NÃO existe, esta migração é um NO-OP para o
--   comportamento atual de TODOS os usuários de hoje — risco zero para o
--   sistema em produção. É pura defesa antecipada.
--
-- Aditiva e idempotente. Aplicar em develop e em produção.
-- ============================================================

-- ── Denylist central: papéis que só podem usar o CRM ────────
-- Null-safe (coalesce → false): tokens sem 'role' (ex.: service_role) não
-- são bloqueados. Para futuros papéis exclusivos de CRM, basta estender o
-- array AQUI — as 4 políticas abaixo passam a valer para eles também.
create or replace function public.is_crm_only_role() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(public.jwt_role() = any (array['Comercial']), false)
$$;

-- ── 1) meetings — bloqueia LEITURA para papel CRM-only ──────
-- (atas, deliberações, pautas, ações, materiais). Escrita já exige
-- Adm/Sec/Super, então 'Comercial' também não grava.
drop policy if exists meetings_block_crm_role on public.meetings;
create policy meetings_block_crm_role on public.meetings
  as restrictive for select to authenticated
  using ( not public.is_crm_only_role() );

-- ── 2) audit_logs — bloqueia LEITURA para papel CRM-only ────
drop policy if exists audit_logs_block_crm_role on public.audit_logs;
create policy audit_logs_block_crm_role on public.audit_logs
  as restrictive for select to authenticated
  using ( not public.is_crm_only_role() );

-- ── 3) members — papel CRM-only só enxerga a PRÓPRIA linha ──
-- Preserva o fallback de login (fetchMemberProfile lê a própria linha em
-- members) e bloqueia enumerar colegas/conselheiros. Quando o CRM for
-- construído e precisar listar vendedores, adicionamos uma policy
-- específica liberando 'Comercial' ver outros 'Comercial'.
drop policy if exists members_block_crm_role on public.members;
create policy members_block_crm_role on public.members
  as restrictive for select to authenticated
  using ( id = auth.uid() or not public.is_crm_only_role() );

-- ── 4) storage (bucket meeting-files) — bloqueia DOWNLOAD ───
-- Sem isto, 'Comercial' baixaria os PDFs de atas/materiais direto pela API,
-- mesmo sem ver na tela. Restrição escopada só ao bucket sensível.
drop policy if exists meeting_files_block_crm_role on storage.objects;
create policy meeting_files_block_crm_role on storage.objects
  as restrictive for select to authenticated
  using ( bucket_id is distinct from 'meeting-files' or not public.is_crm_only_role() );
