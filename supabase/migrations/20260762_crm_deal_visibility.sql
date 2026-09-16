-- ============================================================
-- Boardplan CRM — Visibilidade por dono
--
-- Regra:
--   • Comercial (SDR) só VÊ / edita / apaga os negócios dos quais é dono.
--   • Administrador/SuperAdmin veem e gerenciam TODOS os negócios do cliente.
--   • Transferir dono continua só para Admin (gatilho 20260736 já garante).
--   • Atividades acompanham a visibilidade do negócio (não vaza histórico alheio).
--
-- service_role (Edge Functions / scripts) ignora RLS → inbound/voicemail/migração ok.
-- Aditiva e idempotente. Rodar em develop, testar com um usuário Comercial, depois produção.
-- ============================================================

-- É admin do CRM?
create or replace function public.crm_is_admin() returns boolean
  language sql stable set search_path = '' as $$
    select public.jwt_role() in ('SuperAdmin','Administrador')
$$;
revoke all on function public.crm_is_admin() from public, anon;
grant execute on function public.crm_is_admin() to authenticated;

-- O usuário atual é dono deste negócio? (SECURITY DEFINER: não sofre RLS na subconsulta)
create or replace function public.crm_owns_deal(p_deal uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
    select exists (
      select 1 from public.crm_deals d
      where d.id = p_deal and d.owner_member_id = auth.uid()
    )
$$;
revoke all on function public.crm_owns_deal(uuid) from public, anon;
grant execute on function public.crm_owns_deal(uuid) to authenticated;

-- ── crm_deals: visibilidade e escrita por dono ──────────────
drop policy if exists crm_deals_select on public.crm_deals;
create policy crm_deals_select on public.crm_deals for select to authenticated
  using ( public.can_access_crm(client_id) and ( public.crm_is_admin() or owner_member_id = auth.uid() ) );

-- substitui a policy "ALL" antiga por policies por comando (dono-scoped p/ não-admin)
drop policy if exists crm_deals_write on public.crm_deals;

drop policy if exists crm_deals_insert on public.crm_deals;
create policy crm_deals_insert on public.crm_deals for insert to authenticated
  with check ( public.can_access_crm(client_id) and ( public.crm_is_admin() or owner_member_id = auth.uid() ) );

drop policy if exists crm_deals_update on public.crm_deals;
create policy crm_deals_update on public.crm_deals for update to authenticated
  using ( public.can_access_crm(client_id) and ( public.crm_is_admin() or owner_member_id = auth.uid() ) )
  with check ( public.can_access_crm(client_id) and ( public.crm_is_admin() or owner_member_id = auth.uid() ) );

drop policy if exists crm_deals_delete on public.crm_deals;
create policy crm_deals_delete on public.crm_deals for delete to authenticated
  using ( public.can_access_crm(client_id) and ( public.crm_is_admin() or owner_member_id = auth.uid() ) );

-- ── crm_activities: leitura acompanha o negócio ─────────────
-- (mantém a escrita como estava — can_access_crm — via a policy crm_activities_write)
drop policy if exists crm_activities_select on public.crm_activities;
create policy crm_activities_select on public.crm_activities for select to authenticated
  using (
    public.can_access_crm(client_id) and (
      public.crm_is_admin()
      or owner_member_id = auth.uid()
      or (deal_id is not null and public.crm_owns_deal(deal_id))
    )
  );
