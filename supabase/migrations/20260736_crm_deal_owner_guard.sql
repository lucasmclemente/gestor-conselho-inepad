-- ============================================================
-- Boardplan — CRM: dono do negócio é fixo; só Admin reatribui
--
-- Regra: um negócio tem UM dono (crm_deals.owner_member_id). Um usuário
-- 'Comercial' (SDR) pode trabalhar o negócio (mudar etapa, valor, etapa no
-- kanban, atividades...) mas NÃO pode trocar o dono. Só Administrador/
-- SuperAdmin reatribuem.
--
-- RLS é por LINHA, não por COLUNA — então isso vai num gatilho BEFORE UPDATE.
-- O gatilho também mantém updated_at.
--
-- Nota: service_role (Edge Functions) tem jwt_role() nulo → não é bloqueado.
-- Só 'Comercial' é barrado, de forma explícita e null-safe.
-- Aditiva e idempotente.
-- ============================================================

create or replace function public.crm_deals_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- bloqueia troca de dono feita por 'Comercial'
  if new.owner_member_id is distinct from old.owner_member_id
     and public.jwt_role() = 'Comercial' then
    raise exception 'Somente Administrador pode alterar o dono do negócio';
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_crm_deals_before_update on public.crm_deals;
create trigger trg_crm_deals_before_update
  before update on public.crm_deals
  for each row execute function public.crm_deals_before_update();
