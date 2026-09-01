-- ============================================================
-- Maturidade — trava de VALIDAÇÃO (status='validado').
--
-- Contexto: a policy maturity_answers_write permite ao Administrador do cliente
-- gravar qualquer coluna das próprias respostas — inclusive status='validado' e
-- validated_by/validated_at. Mas "validado" é um selo de confiança que só o
-- CERTIFICADOR (equipe INEPAD) ou o SuperAdmin podem conceder. Sem esta trava,
-- um cliente poderia "auto-validar" a própria maturidade via API direta.
--
-- Solução: trigger BEFORE INSERT/UPDATE que, para quem NÃO é Certificador/SuperAdmin,
-- impede marcar 'validado' e escrever validated_by/validated_at — preservando uma
-- validação já existente do Certificador quando o cliente apenas re-salva (ex.: anexar
-- evidência sem tocar na resposta). Uniforme prod/develop (usa public.jwt_role()).
-- Aditiva e idempotente.
-- ============================================================

create or replace function public.maturity_answers_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text := public.jwt_role();
begin
  -- Certificador e SuperAdmin podem validar livremente
  if r = 'Certificador' or r = 'SuperAdmin' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Ninguém cria uma resposta já 'validada'
    if new.status = 'validado' then new.status := 'declarado'; end if;
    new.validated_by := null;
    new.validated_at := null;
    return new;
  end if;

  -- UPDATE por não-certificador:
  if new.status = 'validado' and old.status = 'validado' then
    -- Já era validada pelo Certificador e continua marcada como validada
    -- (ex.: upsert de evidência que não mexe no status): preserva a validação original,
    -- ignorando qualquer validated_by/at que o cliente tente enviar.
    new.validated_by := old.validated_by;
    new.validated_at := old.validated_at;
  else
    -- Cliente não pode elevar para 'validado'; qualquer tentativa vira 'declarado'.
    if new.status = 'validado' then new.status := 'declarado'; end if;
    new.validated_by := null;
    new.validated_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_maturity_answers_guard on public.maturity_answers;
create trigger trg_maturity_answers_guard
  before insert or update on public.maturity_answers
  for each row execute function public.maturity_answers_guard();

revoke execute on function public.maturity_answers_guard() from public, anon, authenticated;
