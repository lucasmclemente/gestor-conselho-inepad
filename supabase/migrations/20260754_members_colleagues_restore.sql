-- ============================================================
-- Reverte 20260753 (pentest) — restaura a visibilidade multi-empresa em members.
--
-- O ajuste do pentest removeu as condições que deixavam um cliente enxergar os
-- membros que o ATENDEM (consultores/secretários multi-empresa cujo cliente-mãe é
-- outro). Isso NÃO era vazamento: é funcionalidade — o cliente precisa vê-los para
-- atribuí-los como responsáveis/participantes (ex.: Grupo Ocupacional deixou de ver
-- os consultores da INEPAD que o atendem no dropdown do Plano de Ação).
--
-- A visibilidade é SEMPRE baseada em relação real (secretary_clients é atribuído pelo
-- SuperAdmin via set-secretary-clients), não expõe membros de empresas sem vínculo.
-- Restaura a policy original (5 condições). Idempotente.
-- ============================================================

drop policy if exists "Users can view colleagues" on public.members;
create policy "Users can view colleagues" on public.members
  for select to authenticated
  using (
    -- 1) colegas da minha empresa
    client_id = ((auth.jwt() -> 'app_metadata') ->> 'client_id')
    -- 2) SuperAdmin vê todos
    or ((auth.jwt() -> 'app_metadata') ->> 'role') = 'SuperAdmin'
    -- 3) multi-empresa: vejo membros das empresas que ATENDO
    or (coalesce((auth.jwt() -> 'app_metadata') -> 'secretary_clients', '[]'::jsonb) ? client_id)
    -- 4) vejo quem ATENDE a minha empresa (consultores/secretários atribuídos a ela)
    or (coalesce(secretary_clients, '[]'::jsonb) ? ((auth.jwt() -> 'app_metadata') ->> 'client_id'))
    -- 5) multi-empresa: vejo colegas cujo escopo de atendimento cruza com o meu
    or (coalesce(secretary_clients, '[]'::jsonb) ?| array(
          select jsonb_array_elements_text(coalesce((auth.jwt() -> 'app_metadata') -> 'secretary_clients', '[]'::jsonb))
       ))
  );
