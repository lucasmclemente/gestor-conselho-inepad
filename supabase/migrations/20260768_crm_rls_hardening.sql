-- ============================================================
-- Boardplan CRM — Endurecimento de RLS (pentest 03/11/2026)
--
-- Fecha os achados A2, M4 e M2 do relatório PENTEST-2026-11-03.md.
-- Deixa o CRM seguro por padrão para quando/se for reativado
-- (o desligamento operacional é via clients.crm_enabled = false).
--
-- A2  crm_activities: a policy FOR ALL "crm_activities_write" (20260735)
--     nunca foi dropada; sua USING também vale para SELECT e combina por OR
--     com o SELECT escopado (20260762/20260767), ANULANDO o escopo por dono.
--     → troca por policies por comando, escopadas ao dono/assignee/negócio.
--
-- M4  crm_organizations / crm_contacts: a policy FOR ALL "_write" permite
--     UPDATE/DELETE por qualquer usuário de CRM do tenant (sem escopo de dono).
--     → mantém leitura compartilhada (catálogo); escopar UPDATE/DELETE a
--       admin ou dono. INSERT segue liberado a quem acessa o CRM.
--
-- M2  bucket crm-attachments: as policies só checam o client_id do path,
--     sem can_access_crm → qualquer autenticado do tenant (Conselheiro,
--     Assistente, Secretário, Controller) lê/sobe/apaga gravações e anexos.
--     → adiciona public.can_access_crm() às 3 policies. Com o CRM desligado
--       (crm_enabled=false) o bucket TRANCA sozinho; religa junto com a flag.
--
-- Aditiva e idempotente. Rodar em develop, testar, depois produção.
-- service_role (Edge Functions) ignora RLS → migração/scripts seguem ok.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- A2 — crm_activities: remove o FOR ALL e cria escrita por comando
-- (o SELECT escopado de 20260767 permanece e volta a valer sozinho)
-- ─────────────────────────────────────────────────────────────
drop policy if exists crm_activities_write on public.crm_activities;

drop policy if exists crm_activities_insert on public.crm_activities;
create policy crm_activities_insert on public.crm_activities for insert to authenticated
  with check (
    public.can_access_crm(client_id) and (
      public.crm_is_admin()
      or owner_member_id = auth.uid()
      or (deal_id is not null and public.crm_owns_deal(deal_id))
    )
  );

drop policy if exists crm_activities_update on public.crm_activities;
create policy crm_activities_update on public.crm_activities for update to authenticated
  using (
    public.can_access_crm(client_id) and (
      public.crm_is_admin()
      or owner_member_id = auth.uid()
      or (deal_id is not null and public.crm_owns_deal(deal_id))
    )
  )
  with check (
    public.can_access_crm(client_id) and (
      public.crm_is_admin()
      or owner_member_id = auth.uid()
      or (deal_id is not null and public.crm_owns_deal(deal_id))
    )
  );

drop policy if exists crm_activities_delete on public.crm_activities;
create policy crm_activities_delete on public.crm_activities for delete to authenticated
  using (
    public.can_access_crm(client_id) and (
      public.crm_is_admin()
      or owner_member_id = auth.uid()
      or (deal_id is not null and public.crm_owns_deal(deal_id))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- M4 — crm_organizations: leitura compartilhada; escrita escopada
-- ─────────────────────────────────────────────────────────────
drop policy if exists crm_organizations_write on public.crm_organizations;

-- (crm_organizations_select de 20260735 permanece: can_access_crm — catálogo)
drop policy if exists crm_organizations_insert on public.crm_organizations;
create policy crm_organizations_insert on public.crm_organizations for insert to authenticated
  with check ( public.can_access_crm(client_id) );

drop policy if exists crm_organizations_update on public.crm_organizations;
create policy crm_organizations_update on public.crm_organizations for update to authenticated
  using ( public.can_access_crm(client_id) and ( public.crm_is_admin() or owner_member_id = auth.uid() ) )
  with check ( public.can_access_crm(client_id) and ( public.crm_is_admin() or owner_member_id = auth.uid() ) );

drop policy if exists crm_organizations_delete on public.crm_organizations;
create policy crm_organizations_delete on public.crm_organizations for delete to authenticated
  using ( public.can_access_crm(client_id) and ( public.crm_is_admin() or owner_member_id = auth.uid() ) );

-- ─────────────────────────────────────────────────────────────
-- M4 — crm_contacts: leitura compartilhada; escrita escopada
-- ─────────────────────────────────────────────────────────────
drop policy if exists crm_contacts_write on public.crm_contacts;

-- (crm_contacts_select de 20260735 permanece: can_access_crm — catálogo)
drop policy if exists crm_contacts_insert on public.crm_contacts;
create policy crm_contacts_insert on public.crm_contacts for insert to authenticated
  with check ( public.can_access_crm(client_id) );

drop policy if exists crm_contacts_update on public.crm_contacts;
create policy crm_contacts_update on public.crm_contacts for update to authenticated
  using ( public.can_access_crm(client_id) and ( public.crm_is_admin() or owner_member_id = auth.uid() ) )
  with check ( public.can_access_crm(client_id) and ( public.crm_is_admin() or owner_member_id = auth.uid() ) );

drop policy if exists crm_contacts_delete on public.crm_contacts;
create policy crm_contacts_delete on public.crm_contacts for delete to authenticated
  using ( public.can_access_crm(client_id) and ( public.crm_is_admin() or owner_member_id = auth.uid() ) );

-- ─────────────────────────────────────────────────────────────
-- M2 — bucket crm-attachments: adiciona o portão can_access_crm
-- (isola tenant E exige acesso ao CRM; tranca com crm_enabled=false)
-- ─────────────────────────────────────────────────────────────
drop policy if exists crm_att_read on storage.objects;
create policy crm_att_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'crm-attachments'
    and public.can_access_crm((storage.foldername(name))[1])
    and (
      (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'client_id')
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin'
      or ((auth.jwt() -> 'app_metadata' -> 'secretary_clients') ? ((storage.foldername(name))[1]))
    )
  );

drop policy if exists crm_att_insert on storage.objects;
create policy crm_att_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'crm-attachments'
    and public.can_access_crm((storage.foldername(name))[1])
    and (
      (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'client_id')
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin'
      or ((auth.jwt() -> 'app_metadata' -> 'secretary_clients') ? ((storage.foldername(name))[1]))
    )
  );

drop policy if exists crm_att_delete on storage.objects;
create policy crm_att_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'crm-attachments'
    and public.can_access_crm((storage.foldername(name))[1])
    and (
      (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'client_id')
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin'
      or ((auth.jwt() -> 'app_metadata' -> 'secretary_clients') ? ((storage.foldername(name))[1]))
    )
  );
