-- ============================================================
-- Linter (0028/0029): crm_deals_changelog() é função de GATILHO e não deve ser
-- chamável via API (/rest/v1/rpc). Revoga EXECUTE de public/anon/authenticated.
-- O gatilho continua disparando normalmente (o mecanismo de trigger não checa
-- EXECUTE do papel que faz o INSERT/UPDATE). Aditiva e idempotente.
-- ============================================================

revoke execute on function public.crm_deals_changelog() from public, anon, authenticated;
