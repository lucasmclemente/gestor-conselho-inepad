-- ============================================================
-- Correção de vazamento cross-tenant em members (pentest 01/09/2026).
--
-- A policy "Users can view colleagues" tinha 5 condições OR; duas expunham a
-- linha-mãe de um usuário multi-empresa às empresas que ele atende:
--   (4) o secretary_clients DA LINHA contém o meu client_id
--   (5) o secretary_clients da linha cruza com o meu
-- Efeito: um Conselheiro de EMPRESA_TESTE via a linha INEPAD do consultor que a
-- atende (nome, e-mail, cargo). Removemos (4) e (5), mantendo o multi-empresa
-- legítimo: "eu vejo membros das empresas que ATENDO" (meu secretary_clients ? client_id).
--
-- Idêntica em develop e produção (a policy usa auth.jwt() direto nos dois).
-- Aplicar por SQL em ambos os ambientes. Aditiva/idempotente.
-- ============================================================

drop policy if exists "Users can view colleagues" on public.members;
create policy "Users can view colleagues" on public.members
  for select to authenticated
  using (
    client_id = ((auth.jwt() -> 'app_metadata') ->> 'client_id')
    or ((auth.jwt() -> 'app_metadata') ->> 'role') = 'SuperAdmin'
    or (coalesce((auth.jwt() -> 'app_metadata') -> 'secretary_clients', '[]'::jsonb) ? client_id)
  );
