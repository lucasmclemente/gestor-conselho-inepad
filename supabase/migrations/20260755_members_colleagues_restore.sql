-- ============================================================
-- Restaura a policy ORIGINAL de members (reverte o ajuste do pentest 20260753).
--
-- O pentest removeu as condições #4/#5, tratando como "vazamento" o que era, na
-- verdade, a visibilidade multi-empresa RELACIONAL. Confirmado com dados (08/09):
-- a usuária Viviane (atende GO/Hidrotube/Agrária/Piatex) não conseguia atribuir
-- responsável ao Gabriel (cliente-mãe EQUIPE_INEPAD, atende os MESMOS clientes),
-- porque a condição #5 (escopos de atendimento se cruzam) tinha sido removida.
--
-- A visibilidade é sempre baseada em RELAÇÃO REAL (secretary_clients, atribuído
-- pelo SuperAdmin via set-secretary-clients) — não expõe membros sem vínculo.
-- Restaura as 5 condições originais. Idempotente.
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
    -- 4) vejo quem ATENDE a minha empresa
    or (coalesce(secretary_clients, '[]'::jsonb) ? ((auth.jwt() -> 'app_metadata') ->> 'client_id'))
    -- 5) colegas multi-empresa cujo escopo de atendimento cruza com o meu
    or (coalesce(secretary_clients, '[]'::jsonb) ?| array(
          select jsonb_array_elements_text(coalesce((auth.jwt() -> 'app_metadata') -> 'secretary_clients', '[]'::jsonb))
       ))
  );
