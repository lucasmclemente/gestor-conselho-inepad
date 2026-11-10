# SPEC — Comitês Fase 2: acompanhamento dos planos de ação no Conselho

> Continuação da Fase 1 (em produção 09/11/2026). Fase 1 isolou os comitês; a Fase 2
> faz os **planos de ação dos comitês "subirem" para o Conselho**, em modo **somente
> acompanhamento/cobrança** (sem editar). Atas e deliberações dos comitês **continuam
> no comitê** — nunca sobem.

## 1. Objetivo
Dar ao Conselho (Administração/Secretaria + Conselheiros) uma visão **consolidada e
read-only** das ações de todos os comitês do cliente: o que está em aberto, atrasado,
quem é responsável e o progresso das subtarefas — para **acompanhar e cobrar**, sem
interferir na gestão interna do comitê.

## 2. O que entra / não entra
**Entra:** lista consolidada das ações de cada comitê (título, responsáveis, prazo,
status, prioridade, progresso de subtarefas), agrupada por comitê; filtros (comitê,
status, atrasadas); um KPI no Dashboard do Conselho ("Comitês em Atraso"); e
**cobrança por e-mail** — o Conselho dispara um lembrete ao responsável de uma ação
(individual ou "cobrar todas as atrasadas"), consolidado em 1 e-mail por pessoa.
**NÃO entra (trava de design):** editar ações de comitê a partir do Conselho; ver
**atas**, **deliberações**, **materiais** ou a **ordem do dia** dos comitês; qualquer
escrita no plano. O Conselho só **lê** as ações (a cobrança não altera a ação; só
envia e-mail). **Quem acompanha/cobra:** supervisores (Adm/Sec/Super) **+ Conselheiros**.

## 3. Modelo de dados — sem tabelas novas
Reusa `meetings.acoes[]` dos comitês (Fase 1). Exposição controlada por **uma função
`SECURITY DEFINER`** que devolve **apenas campos de ação** (nunca atas/deliberações),
já achatados:

`public.comites_acoes()` → retorna linhas `{comite_id, comite_nome, meeting_id,
meeting_title, meeting_date, action_id, title, resps(jsonb), due_date, status,
priority, subtasks_total, subtasks_done}`.

Esboço (migração `20260770_comites_fase2.sql`):
```sql
create or replace function public.comites_acoes()
returns table(comite_id uuid, comite_nome text, meeting_id uuid, meeting_title text,
  meeting_date date, action_id text, title text, resps jsonb, due_date text,
  status text, priority text, subtasks_total int, subtasks_done int)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, m.id, m.title, m.date,
    a->>'id', a->>'title',
    coalesce(a->'resps', case when a->>'resp' is not null
      then jsonb_build_array(a->>'resp') else '[]'::jsonb end),
    coalesce(a->>'date',''), coalesce(a->>'status','Pendente'),
    coalesce(a->>'priority','Média'),
    coalesce(jsonb_array_length(a->'subtasks'),0),
    coalesce((select count(*) from jsonb_array_elements(coalesce(a->'subtasks','[]'::jsonb)) s
              where s->>'status'='Concluída'),0)
  from public.comites c
  join public.meetings m on m.comite_id = c.id
  cross join lateral jsonb_array_elements(coalesce(m.acoes,'[]'::jsonb)) a
  where c.ativo
    and (public.can_supervise_comites() or public.is_conselho_member())   -- só o Conselho
    and ( c.client_id = (auth.jwt() -> 'app_metadata' ->> 'client_id')     -- escopo do tenant
          or (auth.jwt() -> 'app_metadata' ->> 'role') = 'SuperAdmin'
          or ((auth.jwt() -> 'app_metadata' -> 'secretary_clients') ? c.client_id) );
$$;
revoke all on function public.comites_acoes() from public, anon;
grant execute on function public.comites_acoes() to authenticated;
```

## 4. Segurança / RLS
- A função roda como owner (ignora RLS), mas o `WHERE` só devolve linhas se o chamador
  for **supervisor** (`can_supervise_comites()`) **ou membro do Conselho**
  (`is_conselho_member()`), e só de comitês do **seu tenant**. **Gestor só-de-comitê**
  (`conselho_member=false`, não supervisor) **não recebe nada** — ele está "abaixo" do
  Conselho. Portável prod×develop (lê `app_metadata`, não toca o schema `internal`).
- Devolve **apenas campos de ação** — impossível vazar atas/deliberações por aqui.

## 5. Frontend (somente leitura + cobrança)
- **Menu "Comitês" no espaço Conselho** ganha visibilidade para **Conselheiros** também
  (flag `canSeeComitesMenu = committees_enabled && (supervisor || role==='Conselheiro')`).
  Para supervisor: duas abas — **Gestão** (Fase 1) e **Acompanhamento** (nova). Para
  Conselheiro: só **Acompanhamento**.
- **Acompanhamento** (`components/ComitesAcompanhamento.tsx`): chama `comites_acoes()`,
  agrupa por comitê; cada ação mostra título, responsáveis, prazo, status (chip),
  prioridade e **progresso das subtarefas** (ex.: 2/3). Tudo **read-only**. Filtros:
  comitê, status (Todas/Em aberto/Atrasadas/Concluídas). Badge de atraso quando
  `due_date < hoje` e status ≠ Concluída. Botão **"Cobrar"** por ação + **"Cobrar
  atrasadas (N)"** no topo → `cobrar-acoes-comite`.
- **Dashboard do Conselho:** card clicável **"Comitês em Atraso"** (contagem vinda de
  `comites_acoes()`) que abre o Acompanhamento filtrado em atrasadas. Só aparece quando
  `committees_enabled`, há ≥1 comitê e o usuário é do Conselho.

## 5.1 Cobrança por e-mail — `cobrar-acoes-comite` (Edge Function)
- **Quem dispara:** Conselho (Adm/Sec/Super **ou** Conselheiro). Controller/Diretor não.
- Recebe `items:[{meetingId, actionId, comiteNome}]`. Re-lê cada reunião (service role),
  valida **comitê + tenant**, pega os responsáveis da ação (por **NOME**) e resolve para
  **e-mail via `members`** do próprio cliente (o cliente nunca escolhe o destinatário).
  Consolida em **1 e-mail por pessoa** com todas as ações pendentes dela (Resend,
  remetente `governanca@boardplan.com.br`, `reply_to` = quem cobrou). Nunca envia ata.
  Ignora ações concluídas e responsáveis sem e-mail. Grava `audit_logs` (ação "Cobrança").

## 6. Fora de escopo (ficam para depois, se surgir demanda)
Cobrança **automática** (cron) das ações de comitê; editar ação de comitê pelo Conselho;
subir atas/deliberações; indicadores por comitê; app próprio do gestor de comitê.

## 7. Passos de implementação
1. Migração `20260770_comites_fase2.sql` (função `comites_acoes`) — develop → testar → prod.
2. Edge Function `cobrar-acoes-comite` (cobrança por e-mail) — deploy por ambiente.
3. Componente `components/ComitesAcompanhamento.tsx` (read-only + cobrança, chama a RPC).
4. Abas no menu Comitês (Gestão | Acompanhamento) + liberar "Comitês" para Conselheiro.
5. Card no Dashboard do Conselho + deep-link para o Acompanhamento filtrado.
6. Build, testar na develop (criar ação num comitê → confirmar que aparece no
   Acompanhamento do Conselho, que **não** aparece atas, e que a cobrança chega por
   e-mail), merge → prod + deploy da função + aplicar migração em prod.
