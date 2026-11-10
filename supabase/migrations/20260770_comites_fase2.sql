-- ============================================================================
-- Comitês — Fase 2: acompanhamento dos planos de ação no Conselho
-- ----------------------------------------------------------------------------
-- A Fase 1 (20260769) isolou os comitês. A Fase 2 faz os PLANOS DE AÇÃO dos
-- comitês "subirem" para o Conselho em modo SOMENTE LEITURA / COBRANÇA.
-- Atas, deliberações e materiais dos comitês NUNCA sobem.
--
-- Exposição controlada por UMA função SECURITY DEFINER que devolve apenas
-- CAMPOS DE AÇÃO (impossível vazar ata/deliberação por ela), já achatados,
-- e só para quem é supervisor OU membro do Conselho do próprio tenant.
-- Reusa os helpers portáteis da Fase 1 (can_supervise_comites / is_conselho_member),
-- então roda igual em produção (schema internal.*) e na develop (jwt_*).
-- ============================================================================

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
  'Comitês Fase 2: ações dos comitês para acompanhamento/cobrança do Conselho (read-only). Só campos de ação; gated a supervisor ou membro do Conselho do tenant.';
