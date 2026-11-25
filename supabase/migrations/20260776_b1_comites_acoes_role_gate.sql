-- 20260776_b1_comites_acoes_role_gate.sql
-- Baixo B1 (auditoria 18/11/2026): a RPC comites_acoes() tinha gate
--   (can_supervise_comites() OR is_conselho_member())
-- e is_conselho_member() = coalesce(conselho_member, true) = TRUE por padrão →
-- Assistente / Controller / Diretor podiam enumerar o plano de ação de TODOS os
-- comitês do tenant (título/responsável/prazo/status). Acrescenta exigência de
-- papel com alçada de acompanhamento. Portável (prod schema internal.* + develop).
create or replace function public.comites_acoes()
returns table (
  comite_id      uuid,
  comite_nome    text,
  meeting_id     uuid,
  meeting_title  text,
  meeting_date   date,
  action_id      text,
  title          text,
  resps          jsonb,
  due_date       text,
  status         text,
  priority       text,
  subtasks_total int,
  subtasks_done  int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.nome,
    m.id,
    m.title,
    m.date,
    a->>'id',
    coalesce(a->>'title', ''),
    coalesce(
      a->'resps',
      case when a->>'resp' is not null and a->>'resp' <> ''
           then jsonb_build_array(a->>'resp')
           else '[]'::jsonb end
    ),
    coalesce(a->>'date', ''),
    coalesce(a->>'status', 'Pendente'),
    coalesce(a->>'priority', 'Média'),
    coalesce(jsonb_array_length(a->'subtasks'), 0),
    coalesce(
      (select count(*)::int
         from jsonb_array_elements(coalesce(a->'subtasks', '[]'::jsonb)) s
        where s->>'status' = 'Concluída'),
      0
    )
  from public.comites c
  join public.meetings m on m.comite_id = c.id
  cross join lateral jsonb_array_elements(coalesce(m.acoes, '[]'::jsonb)) a
  where c.ativo
    -- Só o Conselho enxerga (supervisor OU membro do Conselho). Gestor só-de-comitê não.
    and (public.can_supervise_comites() or public.is_conselho_member())
    -- B1: e só papéis com alçada de acompanhamento (exclui Assistente/Controller/Diretor,
    --     que são conselho_member=true por padrão e passariam no is_conselho_member()).
    and (auth.jwt() -> 'app_metadata' ->> 'role')
          in ('SuperAdmin', 'Administrador', 'Secretário', 'Conselheiro')
    -- Escopo do tenant (próprio client, multi-empresa via secretary_clients, ou SuperAdmin)
    and (
      c.client_id = (auth.jwt() -> 'app_metadata' ->> 'client_id')
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin'
      or ((auth.jwt() -> 'app_metadata' -> 'secretary_clients') ? c.client_id)
    );
$$;

revoke all on function public.comites_acoes() from public, anon;
grant execute on function public.comites_acoes() to authenticated;

comment on function public.comites_acoes() is
  'Comitês Fase 2: ações dos comitês para acompanhamento/cobrança do Conselho (read-only). Só campos de ação; gated a supervisor ou Conselheiro+ do tenant (B1: exclui Assistente/Controller/Diretor).';
