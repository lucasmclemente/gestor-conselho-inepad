# CLAUDE.md — GovCorp | INEPAD Consultoria
> Arquivo de contexto do projeto. Cole nas Project Instructions do Claude.
> Última atualização: 29/06/2026 (v3)

---

## 1. VISÃO GERAL DO PROJETO

**Nome:** GovCorp — Plataforma de Gestão de Conselhos  
**Cliente:** INEPAD Consultoria (Governança e Sucessão Empresarial)  
**Modelo:** Multi-tenant SaaS (múltiplas empresas clientes, dados isolados por `client_id`)  
**Status:** Segurança validada. Pronto para testes com clientes parceiros.  
**URL Produção:** conselho.inepadconsulting.com (Vercel → branch `main`)  
**URL Develop:** gestor-conselho-inepad-[hash].vercel.app (Vercel → branch `develop`)  
**Repositório:** github.com/lucasmclemente/gestor-conselho-inepad

### O que o sistema faz

Plataforma corporativa que gerencia o ciclo completo de reuniões de Conselhos Deliberativos e Consultivos:

- **Convocações oficiais** — disparo automático de e-mails com pauta e logística + anexo de calendário (`.ics` com RSVP)
- **Programação anual** — secretaria programa as reuniões do ano em lote (frequência mensal/bimestral/trimestral/semestral, lista de datas editável) e dispara convites de calendário (`.ics` multi-evento) para reservar a agenda dos conselheiros
- **Ordem do Dia** — controle de pautas com cronômetro em tempo real e alertas de estouro
- **Deliberações** — sistema formal de votação (Favor / Contra / Abstenção) com painel de votantes elegíveis
- **Plano de Ação Global** — consolidado de iniciativas entre reuniões, com filtros e atualizações em lote
- **Atas** — upload seguro com links assinados (7 dias) e disparo automático para participantes
- **Dashboard de governança** — KPIs clicáveis (drill-down) com barra de progresso, gráficos de status/produtividade, próximas reuniões programadas (contagem regressiva) e pendências prioritárias
- **Auditoria** — logs automáticos e imutáveis de todas as ações do sistema
- **Cadastro de Membros** — via Edge Function segura com criação no Auth + tabela members
- **Indicadores & Gatilhos (Semáforos)** — Conselho define indicadores estratégicos, registra leituras no tempo e configura gatilhos (limites). Ao romper, o indicador muda de semáforo (🟢/🟡/🔴), dispara alerta por e-mail e gera ação no Plano de Ação. Avaliação determinística no banco; efeitos colaterais na Edge Function `evaluate-triggers`

### Papéis de usuário

| Papel | Permissões |
|---|---|
| SuperAdmin | Acesso total a todos os clientes |
| Administrador | Gestão completa do próprio `client_id` |
| Secretário | Pode criar e editar reuniões |
| Conselheiro | Somente visualização e votação |
| Assistente | Apenas upload de materiais (sem acesso a reuniões, plano de ação, deliberações ou indicadores) |

> **Multi-empresa:** Administrador, Secretário e Conselheiro podem atuar em **vários clientes**. O SuperAdmin atribui as empresas pelo botão "Clientes" (Edge Function `set-secretary-clients` → grava `secretary_clients` no `user_metadata` e na tabela `members`). O usuário alterna pelo seletor de cliente no topo (precisa re-login após atribuição). RLS de leitura/escrita reconhece `secretary_clients`. SuperAdmin é o único papel cross-client nativo.

---

## 2. STACK TECNOLÓGICA

### Front-end
- **React** + **TypeScript**
- **Vite** — build e dev server
- **Tailwind CSS** — identidade visual: tons slate + amber, fonte bold/italic, estética premium corporativa
- **Recharts** — gráficos no Dashboard (PieChart, BarChart)
- **Lucide React** — ícones

### Back-end (Supabase)
- **PostgreSQL** via Supabase (Backend-as-a-Service)
- **Row Level Security (RLS)** — segurança em nível de banco de dados
- **Edge Functions** — lógica serverless (Deno/TypeScript)
- **Storage** — arquivos protegidos via Signed URLs (7 dias)
- **Auth nativo** — `signInWithPassword`, `getSession`, `onAuthStateChange`

### Infraestrutura
- **Vercel** — deploy automático por branch
- **Dois projetos Supabase separados** — `main` (produção) e `develop` (homologação)

---

## 3. ESTRUTURA DE PASTAS

```
GESTOR-CONSELHO-INEPAD/
├── components/        ← existe mas não utilizada (App.tsx é monolítico — refatoração futura)
├── public/            ← logo-login.jpg, logo-sidebar.jpg, favicon.png
├── services/
├── supabase/
├── .env               ← VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (não commitar)
├── App.tsx            ← componente principal (~966 linhas)
├── CLAUDE.md          ← este arquivo
├── constants.ts
├── index.html
├── index.tsx
├── types.ts
└── vite.config.ts
```

---

## 4. BANCO DE DADOS — SCHEMA

### Tabela: `members`
| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid | FK para `auth.users` |
| name | text | Nome completo |
| email | text | **UNIQUE constraint ativa** |
| role | text | Administrador / Secretário / Conselheiro / SuperAdmin |
| created_at | timestamptz | |
| client_id | text | Identificador do tenant (ex: "INEPAD") |

### Tabela: `meetings`
| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid | |
| title | text | |
| status | text | Agendada / Em Andamento / Concluída |
| date | date | |
| time | time | |
| type | text | Híbrida / Presencial / Online |
| link | text | |
| address | text | |
| participants | jsonb | Array de {name, email, isExternal} |
| pautas | jsonb | Array de {title, resp, dur, realDur, completed} |
| materiais | jsonb | Array de {name, url, uploadedAt} |
| deliberacoes | jsonb | Array de {title, voters[], votes{}} |
| acoes | jsonb | Array de {id, title, resp, date, status, obs} |
| atas | jsonb | Array de {name, url, uploadedAt, clicksign_key?, clicksign_status?, clicksign_signed_url?, clicksign_signed_at?} |
| created_at | timestamptz | |
| client_id | text | Isolamento multi-tenant |

### Tabela: `clients`
| Coluna | Tipo | Observação |
|---|---|---|
| client_id | text | PK — identificador do tenant (ex: "INEPAD") |
| name | text | Nome comercial da empresa |
| logo_url | text | URL pública do logo (Storage bucket `client-logos`) |
| clicksign_enabled | boolean | Se o add-on de assinatura digital está ativo para este cliente |

### Tabela: `audit_logs`
| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid | |
| log_date | timestamptz | |
| username | text | |
| action | text | Login, Salvamento, Upload, Convocação, Cadastro etc. |
| details | text | |
| client_id | text | Isolamento multi-tenant |

### Módulo Indicadores & Gatilhos (Semáforos)

> Migração: `supabase/migrations/20260626_indicators_triggers.sql`. `client_id` é **text** (como no resto do sistema). RLS isola por `client_id` + reconhece `secretary_clients` (multi-empresa); Assistente sem acesso; Conselheiro só leitura. Helpers de JWT (`jwt_role`, `jwt_client_id`, `jwt_secretary_clients`, `can_read_governance`, `can_write_governance`, `gov_tenant_visible`) com `search_path` travado.

| Tabela | Colunas principais |
|---|---|
| `indicators` | id, client_id, name, unit, description, direction (`higher_is_better`/`lower_is_better`), category, active |
| `indicator_readings` | id, client_id, indicator_id, period (date, competência), value (numeric), source · **unique(indicator_id, period)** |
| `triggers` | id, client_id, indicator_id, name, operator (`gt`/`gte`/`lt`/`lte`/`outside`/`inside`), threshold_value, threshold_value_secondary, severity (`attention`/`critical`), **scenario** (default 'Base'), create_action_on_breach, notify_on_breach, assignee_member_id, active |
| `trigger_events` | id, client_id, trigger_id, indicator_reading_id, observed_value, severity, status (`open`/`acknowledged`/`resolved`), generated_action_id (text), fired_at · **unique(trigger_id, indicator_reading_id)** (idempotência) · **INSERT só via Edge Function (service role)** |
| `governance_settings` | client_id (PK), **active_scenario** (cenário ativo: Otimista/Base/Conservador/Trágico — texto livre), **reeval_frequency** (`off`/`daily`/`weekly`/`monthly`), last_reeval_at |

- **`eval_breach(v, op, t1, t2)`** — função pura imutável: fonte única da regra de rompimento.
- **`breached_triggers_for_reading(reading_id)`** — `SECURITY DEFINER`, `EXECUTE` revogado de authenticated; só a Edge Function chama.
- **View `indicator_current_status`** (`security_invoker = on`) — semáforo em tempo real: `breach_level` 0 (verde) / 1 (amarelo) / 2 (vermelho) a partir da leitura mais recente.
- Ação gerada por gatilho vai num **container** `meetings` com `type='Indicadores'` (oculto na lista de reuniões; aparece no Plano de Ação global), mesmo formato de "deliberação vira ação". Severidade → prioridade: `attention`→Importante, `critical`→Urgente.
- **Cenários nomeados:** cada gatilho tem `scenario`; o cliente escolhe o **cenário ativo** (`governance_settings.active_scenario`). A view e a RPC só consideram gatilhos do cenário ativo (`active_scenario(client)`), então o semáforo/alertas mudam ao trocar de cenário. Frontend: seletor no topo do painel + chips por gatilho.
- **Reavaliação agendada (cron):** `_shared/triggers.ts` (`fireForReading`) é reusado por `evaluate-triggers` (no registro de leitura) e `reevaluate-triggers` (cron). O cron usa **pg_cron + pg_net** (`0 12 * * *` UTC) chamando `reevaluate-triggers` (protegida por `CRON_SECRET`, **distinto por ambiente**); reavalia a última leitura de cada indicador + manda lembrete-resumo dos alertas abertos, respeitando `reeval_frequency` por cliente. Detalhes em memória [[cron_reevaluate]].

---

## 5. SEGURANÇA — STATUS ATUAL (27/05/2026)

### ✅ Implementado e validado

| Item | Detalhe |
|---|---|
| Coluna `password` removida | Vulnerabilidade crítica eliminada |
| Auth nativo Supabase | Login via `signInWithPassword` |
| `role` e `client_id` no `user_metadata` | Migrado do Auth — todos os usuários atualizados |
| `fetchMemberProfile` lê do Auth | Elimina escalada de privilégios via tabela members |
| RLS ativa em todas as tabelas | Isolamento por client_id no banco |
| Storage protegido | Signed URLs de 7 dias |
| Logs imutáveis | Apenas INSERT permitido em audit_logs — policies ALL removidas |
| Edge Function `create-user` segura | Cria no Auth + upsert em members |
| Constraint UNIQUE em email | Ativa em ambos os projetos |
| Dados sujos removidos | Registros órfãos e usuários de teste deletados |
| RLS meetings consolidada | Policies reescritas — leitura do JWT, isolamento correto |
| `process_audit_log` — SECURITY INVOKER | Warning do linter resolvido (pendente confirm) |
| JWT obrigatório em Edge Functions de email | `send-invitation` e `send-minute-notification` verificam autenticação |
| Chave Gemini removida do bundle JS | Movida para Edge Function `analyze-minutes` como Supabase secret |
| HTML injection eliminado nos e-mails | `escapeHtml()` e `safeUrl()` em todos os campos de usuário |
| CORS restrito em todas as Edge Functions | Whitelist de origens — sem wildcard `*` |
| Autorização em `create-user` | Apenas Administrador/SuperAdmin podem criar usuários |
| Cadastro público desabilitado | "Allow new users to sign up" OFF em ambos os projetos |
| RLS members auditada e corrigida | Policies `public` corrigidas para `authenticated`; isolamento por client_id reforçado |
| RLS meetings reescrita (JWT) | `Apenas Adm e Sec` lê role do JWT — elimina escalada via tabela members |
| RLS audit_logs imutável | Policies ALL removidas — apenas SELECT (admins) e INSERT (autenticados) |
| RLS server_audit_logs configurada | SELECT para admins; INSERT via trigger SECURITY DEFINER (não exposto via API) |
| `process_audit_log` SECURITY DEFINER segura | `SET search_path = ''` + EXECUTE revogado de PUBLIC/anon/authenticated — zero warnings no linter |
| Plano de Ações (global e reuniões) | Múltiplos responsáveis (chips) + campo de observação inline — ambos os contextos |

### RLS Policies ativas — `meetings` (ambos os projetos)
| Policy | Comando | Descrição |
|---|---|---|
| Meetings isolation | SELECT | Qualquer autenticado vê reuniões do próprio client; SuperAdmin vê tudo |
| Apenas Adm e Sec gerem reuniões | ALL | Administrador/Secretário/SuperAdmin gerenciam — role lido do JWT |

### RLS Policies ativas — `members` (ambos os projetos)
| Policy | Comando | Descrição |
|---|---|---|
| Admins can manage their own client members | ALL | **Única política de escrita** — apenas Administrador/SuperAdmin gerenciam membros (Adm do próprio client; Super de todos). Role lido do JWT |
| Privacidade de membros / Members can view their own data | SELECT | Leitura isolada por client_id (lê JWT) |
| Users can view colleagues | SELECT | Membros veem colegas do mesmo client; SuperAdmin vê todos |

> ⚠️ A política `Members isolation by client_id` (ALL, sem checagem de role) foi **removida** em 10/06/2026 nos dois ambientes: por ser permissiva e OR-combinada, ela permitia que qualquer usuário do tenant (ex: Conselheiro) gravasse/apagasse membros do próprio client via API. Escrita de `members` agora exige Administrador/SuperAdmin. Criação de membros continua via Edge Function `create-user` (service role, ignora RLS).

### RLS Policies ativas — `audit_logs` (main)
| Policy | Comando | Descrição |
|---|---|---|
| Admins can view their logs | SELECT | Admins veem logs do próprio client |
| Audit logs isolation by client_id | SELECT | Isolamento por client_id via JWT |
| Logs imutáveis | INSERT | Qualquer autenticado pode inserir logs |
| Ver logs da própria empresa | SELECT | Membros veem logs do próprio client |

### RLS Policies ativas — `server_audit_logs` (ambos os projetos)
| Policy | Comando | Descrição |
|---|---|---|
| Admins can view server audit logs | SELECT | Admins veem logs do próprio client via JWT |
| (INSERT via trigger) | — | Inserção feita pelo trigger `process_audit_log` (SECURITY DEFINER) — não há policy INSERT exposta |

### Função `process_audit_log` — configuração final
- `SECURITY DEFINER` com `SET search_path = ''`
- `EXECUTE` revogado de `PUBLIC`, `anon` e `authenticated`
- Chamada exclusivamente por triggers internos do banco — não acessível via `/rest/v1/rpc/`

---

## 6. EDGE FUNCTIONS

| Função | Descrição | JWT Verify |
|---|---|---|
| `create-user` | Cria usuário no Auth + upsert em members + log | OFF (verifica Bearer token manualmente) |
| `send-invitation` | Convocação oficial por e-mail + anexa convite de calendário (`.ics` RSVP) | ON (verificação em código + config.toml) |
| `send-calendar-invites` | Envia 1 e-mail com `.ics` multi-evento (todas as reuniões do ano) para reservar a agenda dos participantes (RSVP) | ON (verificação em código + config.toml) |
| `send-minute-notification` | Ata + relatório de pendências por responsável | ON (verificação em código + config.toml) |
| `clicksign-flow` | Envia ata para assinatura digital no ClickSign + adiciona signatários | OFF |
| `clicksign-check` | Verifica status da assinatura + baixa PDF assinado + atualiza banco | OFF (verifica Bearer token manualmente) |
| `clicksign-webhook` | Recebe notificação do ClickSign ao concluir assinaturas + atualiza ata automaticamente | — (público, sem auth) |
| `set-secretary-clients` | SuperAdmin atribui empresas a um usuário multi-empresa (`secretary_clients` no Auth + members) | OFF (valida SuperAdmin em código) |
| `evaluate-triggers` | Avalia os gatilhos de uma leitura (RPC `breached_triggers_for_reading`); cria evento idempotente, ação no Plano de Ação, alerta Resend e log. Usa `_shared/triggers.ts` | OFF (valida JWT + papel write em código) |
| `reevaluate-triggers` | Cron (pg_cron diário): reavalia a última leitura de cada indicador + lembrete-resumo dos alertas abertos; respeita `reeval_frequency` por cliente | OFF (valida header `x-cron-secret` == `CRON_SECRET`) |

> **Código compartilhado:** `supabase/functions/_shared/ics.ts` — gerador de `.ics` (iCalendar/RFC 5545) com RSVP, usado por `send-invitation` e `send-calendar-invites`. Converte horário de Brasília (UTC−3) para UTC. Empacotado automaticamente no deploy de cada função que o importa.

### Programação anual de reuniões — fluxo
```
Secretária clica "Programar Ano" (lista de reuniões)
        ↓
Modal: título base + 1ª data + horário + tipo + frequência + quantidade
        ↓
"Gerar prévia" → lista de datas EDITÁVEL (ajusta/remove cada uma)
        ↓
Seleciona participantes (pré-preenchidos com membros do cliente)
        ↓
Confirmar → insert em lote na tabela meetings (status 'Agendada')
        ↓
[se "Enviar convites" marcado] send-calendar-invites → e-mail com .ics multi-evento
        ↓
Dashboard: seção "Próximas Reuniões Programadas" reflete as novas datas
```

> Duração assumida no `.ics`: **120 min** por reunião (não há campo de duração no cadastro). Convite vai como **anexo** `.ics` (método REQUEST) — RSVP nativo no corpo do e-mail não é suportado pelo Resend.

### Integração ClickSign — fluxo completo
```
Admin clica "Enviar para Assinatura Digital"
        ↓
clicksign-flow: cria documento + lista de assinatura + adiciona signatários
        ↓
Banco atualizado: ata.clicksign_key, ata.clicksign_status = 'pending'
        ↓
[ClickSign notifica via webhook quando todos assinam]
        ↓
clicksign-webhook: baixa PDF assinado → upload Storage → atualiza ata no banco
        OU
Admin clica "Verificar Status da Assinatura"
        ↓
clicksign-check: consulta ClickSign → se 'closed', baixa PDF → atualiza banco
        ↓
Frontend: atualiza estado local imediatamente (sem depender só do re-fetch)
```

### Campos ClickSign na ata (jsonb)
| Campo | Descrição |
|---|---|
| `clicksign_key` | UUID do documento no ClickSign |
| `clicksign_status` | `'pending'` (aguardando) ou `'signed'` (concluído) |
| `clicksign_signed_url` | URL do PDF assinado no Supabase Storage |
| `clicksign_signed_at` | ISO timestamp da conclusão |

### Add-on ClickSign por cliente
- Controlado pelo campo `clicksign_enabled` na tabela `clients`
- Configurado individualmente por cliente pelo SuperAdmin (em "Contas de Clientes")
- Clientes sem o add-on não veem o botão de assinatura digital nas atas

### Código atual da `create-user` (versão com upsert)
```typescript
// upsert com onConflict: 'email' para evitar falha por registro duplicado
await supabaseAdmin.from("members").upsert([{
  id: authData.user.id, name, email, role, client_id
}], { onConflict: 'email' });
```

---

## 7. VARIÁVEIS DE AMBIENTE

### Vercel — Environment Variables
| Variável | Ambiente |
|---|---|
| VITE_SUPABASE_URL + ANON_KEY | Production and Preview → Supabase `main` |
| VITE_SUPABASE_URL + ANON_KEY | Preview + develop → Supabase `develop` |

---

## 8. LÓGICA DE AUTENTICAÇÃO (ATUAL)

```typescript
// fetchMemberProfile — lê do user_metadata do Auth (seguro)
const { data: authData } = await supabase.auth.getUser();
const user = authData?.user;
const meta = user?.user_metadata;
if (meta?.role && meta?.client_id) {
  setCurrentUser({
    id: userId,
    name: meta.name || user?.email || '',
    email: user?.email ?? '',
    role: meta.role,
    client_id: meta.client_id
  });
} else {
  // Fallback para tabela members (compatibilidade)
  const { data } = await supabase.from('members')
    .select('id, name, email, role, client_id')
    .eq('id', userId).single();
  if (data) setCurrentUser(data);
}
```

---

## 9. FLUXO DE CADASTRO DE MEMBROS

```
Admin preenche formulário
        ↓
Front-end chama create-user com Bearer token
        ↓
Edge Function cria no Auth (email_confirm: true)
        ↓
Edge Function faz upsert em members (onConflict: 'email')
        ↓
Edge Function grava em audit_logs (silencioso se falhar)
        ↓
Front-end verifica em members se usuário foi criado
        ↓
Exibe sucesso ou erro
```

---

## 10. PADRÕES DE DESENVOLVIMENTO

### Identidade visual (não alterar)
- Cores: `slate-900` (sidebar), `amber-600` (destaque), `white` (cards)
- Tipografia: `font-bold italic uppercase tracking-widest`
- Cards: `rounded-xl border border-slate-200 shadow-sm`
- Botões primários: `bg-amber-600 hover:bg-amber-700 text-white`
- Botões secundários: `bg-slate-900 text-amber-500`

### Regras de negócio críticas
- Todo dado gravado deve incluir `client_id: currentUser.client_id`
- Convidados externos (`isExternal: true`) não assumem ações no Plano de Ação
- Logs de auditoria são imutáveis — nunca UPDATE ou DELETE em `audit_logs`
- Signed URLs expiram em 7 dias
- Votações só para participantes internos
- Cadastro de membros sempre via Edge Function — nunca inserção direta

### Permissões por papel
```typescript
const isSuper = currentUser?.role === 'SuperAdmin'
const isAdm = currentUser?.role === 'Administrador' || isSuper
const isSec = currentUser?.role === 'Secretário'
const canEdit = isAdm || isSec
```

---

## 11. FLUXO DE DEPLOY

```
localhost (npm run dev) → commit → push develop
        ↓
Vercel deploy automático na URL develop
        ↓
Testa na develop
        ↓
git checkout main && git merge develop && git push origin main
        ↓
Vercel deploy automático em produção
        ↓
git checkout develop
```

> ⚠️ **Edge Functions NÃO sobem com a Vercel.** O merge para `main` só publica o frontend. Quando uma Edge Function muda, é preciso deployá-la manualmente no Supabase de cada ambiente:
> ```bash
> supabase login            # uma vez (abre o navegador)
> supabase functions deploy <nome> --project-ref <ref>
> ```
> Refs: produção = `jrtrrubtjbinnddqdbta` (GovCorp-INEPAD); develop = projeto de homologação (ver memória do projeto). Funções que importam `_shared/` empacotam o compartilhado automaticamente. Não requer Docker.

---

## 12. PENDÊNCIAS — PRÓXIMA SPRINT

### 🟡 Segurança
- ✅ Todos os warnings do linter Supabase resolvidos — zero warnings em produção e develop

### 🟢 Funcionalidades
- Módulo de relatórios em PDF (Dashboard)
- ✅ Integração ClickSign para assinatura digital de atas (implementada e funcionando em develop)
- ✅ Gestão de clientes individuais pelo SuperAdmin (logo e ClickSign por cliente)
- ✅ Programação anual de reuniões em lote + convites de calendário (`.ics` RSVP) — em produção
- ✅ Melhorias de UX no dashboard (KPIs clicáveis, progresso, próximas reuniões, empty states) — em produção
- Refatorar `App.tsx` em componentes (pasta `components/` já existe)

### 🟣 Programação anual de reuniões (implementado em 08/06/2026)
- Botão "Programar Ano" na lista de reuniões (apenas Adm/Sec/SuperAdmin)
- Modal: título base, frequência (mensal/bimestral/trimestral/semestral), quantidade, prévia de datas editável, seleção de participantes
- Cria reuniões em lote (`status: 'Agendada'`) e opcionalmente envia convites `.ics` (RSVP) via `send-calendar-invites`
- Dashboard ganhou seção "Próximas Reuniões Programadas" (contagem regressiva, clique abre a reunião)
- Convocação individual (`send-invitation`) passou a anexar `.ics` também

### 🔵 SuperAdmin — Gestão de Clientes (implementado em 08/06/2026)
- SuperAdmin vê grid com todos os clientes na aba "Contas de Clientes"
- Clicar em um cliente abre painel para editar nome, logo e toggle ClickSign individualmente
- Admins comuns continuam vendo apenas o próprio perfil (sem mudança)

---

## 13. COMANDOS ÚTEIS

```bash
npm run dev                          # rodar localmente
npm run build                        # build de produção
git add . && git commit -m "msg" && git push origin develop
git checkout main && git merge develop && git push origin main && git checkout develop
```

---

## 14. CONTEXTO DO DESENVOLVEDOR

- Lucas Clemente — INEPAD Consultoria
- Perfil: leigo em programação, desenvolve com apoio de IA
- Decisões de arquitetura tomadas ao longo do desenvolvimento devem ser respeitadas
- Sempre entregar código completo para evitar erros de edição parcial
- Sempre testar na `develop` antes de mergear para `main`
- Ao propor alterações no App.tsx, sempre entregar o arquivo completo

---

*Atualizado em 29/06/2026 (v3) — módulo Indicadores & Gatilhos (Semáforos): tabelas `indicators`/`indicator_readings`/`triggers`/`trigger_events`/`governance_settings`, view `indicator_current_status`, Edge Functions `evaluate-triggers` e `reevaluate-triggers` (+ `_shared/triggers.ts`); painel + cadastro + tela de detalhe (sparkline/histórico) + KPI no Dashboard; **cenários nomeados** (cenário ativo por cliente) e **reavaliação agendada** (pg_cron diário, frequência por cliente, lembrete-resumo). Multi-empresa generalizado para Administrador/Secretário/Conselheiro via `secretary_clients` + `set-secretary-clients`. Papel Assistente (só upload). Versão anterior (v2): programação anual de reuniões em lote; convites `.ics` (RSVP); melhorias de UX no dashboard; deploy manual de Edge Functions.*