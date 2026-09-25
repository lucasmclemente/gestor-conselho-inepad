-- ============================================================
-- CRM — Atividades planejadas: vários responsáveis + faixa de horário
--   assignees: array jsonb de member ids (além do owner_member_id, que segue como principal)
--   end_at:    fim da faixa de horário (due_at passa a ser o início)
-- Leitura: quem está em `assignees` também enxerga a atividade (para a Agenda "minhas tarefas").
-- Aditiva e idempotente. Rodar na develop, testar, depois produção.
-- ============================================================

alter table public.crm_activities
  add column if not exists assignees jsonb,
  add column if not exists end_at    timestamptz;

create index if not exists idx_crm_activities_assignees on public.crm_activities using gin (assignees);

-- RLS de leitura: admin, ou dono da atividade, ou está nos assignees, ou é dono do negócio
drop policy if exists crm_activities_select on public.crm_activities;
create policy crm_activities_select on public.crm_activities for select to authenticated
  using (
    public.can_access_crm(client_id) and (
      public.crm_is_admin()
      or owner_member_id = auth.uid()
      or (assignees is not null and assignees ? (auth.uid())::text)
      or (deal_id is not null and public.crm_owns_deal(deal_id))
    )
  );
