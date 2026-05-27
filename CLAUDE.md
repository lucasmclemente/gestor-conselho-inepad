# CLAUDE.md — GovCorp | INEPAD Consultoria
> Arquivo de contexto do projeto. Cole nas Project Instructions do Claude.
> Última atualização: 27/05/2026

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

- **Convocações oficiais** — disparo automático de e-mails com pauta e logística
- **Ordem do Dia** — controle de pautas com cronômetro em tempo real e alertas de estouro
- **Deliberações** — sistema formal de votação (Favor / Contra / Abstenção) com painel de votantes elegíveis
- **Plano de Ação Global** — consolidado de iniciativas entre reuniões, com filtros e atualizações em lote
- **Atas** — upload seguro com links assinados (7 dias) e disparo automático para participantes
- **Auditoria** — logs automáticos e imutáveis de todas as ações do sistema
- **Cadastro de Membros** — via Edge Function segura com criação no Auth + tabela members

### Papéis de usuário

| Papel | Permissões |
|---|---|
| SuperAdmin | Acesso total a todos os clientes |
| Administrador | Gestão completa do próprio `client_id` |
| Secretário | Pode criar e editar reuniões |
| Conselheiro | Somente visualização e votação |

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
| atas | jsonb | Array de {name, url, uploadedAt} |
| created_at | timestamptz | |
| client_id | text | Isolamento multi-tenant |

### Tabela: `audit_logs`
| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid | |
| log_date | timestamptz | |
| username | text | |
| action | text | Login, Salvamento, Upload, Convocação, Cadastro etc. |
| details | text | |
| client_id | text | Isolamento multi-tenant |

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
| Logs imutáveis | Apenas INSERT permitido em audit_logs |
| Edge Function `create-user` segura | Cria no Auth + upsert em members |
| Constraint UNIQUE em email | Ativa em ambos os projetos |
| Dados sujos removidos | Registros órfãos e usuários de teste deletados |
| RLS meetings consolidada | Políticas redundantes removidas |
| `process_audit_log` — SECURITY INVOKER | Warning do linter resolvido (pendente confirm) |
| JWT obrigatório em Edge Functions de email | `send-invitation` e `send-minute-notification` verificam autenticação |
| Chave Gemini removida do bundle JS | Movida para Edge Function `analyze-minutes` como Supabase secret |
| HTML injection eliminado nos e-mails | `escapeHtml()` e `safeUrl()` em todos os campos de usuário |

### RLS Policies ativas — `meetings`
| Policy | Comando | Descrição |
|---|---|---|
| SuperAdmin acessa tudo | ALL | SuperAdmin vê todos os clientes |
| Users can view own client meetings | ALL | Isolamento por client_id |
| Apenas Adm e Sec gerem reuniões | ALL | Restringe criação/edição por papel |

---

## 6. EDGE FUNCTIONS

| Função | Descrição | JWT Verify |
|---|---|---|
| `create-user` | Cria usuário no Auth + upsert em members + log | OFF (verifica Bearer token manualmente) |
| `send-invitation` | Convocação oficial por e-mail | ON (verificação em código + config.toml) |
| `send-minute-notification` | Ata + relatório de pendências por responsável | ON (verificação em código + config.toml) |
| `clicksign-flow` | Integração ClickSign (em desenvolvimento) | OFF |

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

---

## 12. PENDÊNCIAS — PRÓXIMA SPRINT

### 🟡 Segurança
- Confirmar resolução dos warnings do linter (`process_audit_log` SECURITY INVOKER)

### 🟢 Funcionalidades
- Módulo de relatórios em PDF (Dashboard)
- Integração ClickSign para assinatura digital de atas
- Refatorar `App.tsx` em componentes (pasta `components/` já existe)

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

*Atualizado em 26/05/2026 após sessão completa de segurança e homologação.*