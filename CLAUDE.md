# CLAUDE.md — GovCorp | INEPAD Consultoria
> Arquivo de contexto do projeto. Cole no início de qualquer sessão de desenvolvimento.
> Última atualização: 26/05/2026

---

## 1. VISÃO GERAL DO PROJETO

**Nome:** GovCorp — Plataforma de Gestão de Conselhos  
**Cliente:** INEPAD Consultoria (Governança e Sucessão Empresarial)  
**Modelo:** Multi-tenant SaaS (múltiplas empresas clientes, dados isolados por `client_id`)  
**Status:** Núcleo funcional em produção. Segurança validada. Pronto para testes com clientes parceiros.  
**URL Produção:** conselho.inepadconsulting.com (Vercel → branch `main`)  
**URL Develop:** gestor-conselho-inepad-[hash].vercel.app (Vercel → branch `develop`)

### O que o sistema faz

Plataforma corporativa que gerencia o ciclo completo de reuniões de Conselhos Deliberativos e Consultivos:

- **Convocações oficiais** — disparo automático de e-mails com pauta e logística
- **Ordem do Dia** — controle de pautas com cronômetro em tempo real e alertas de estouro
- **Deliberações** — sistema formal de votação (Favor / Contra / Abstenção) com painel de votantes elegíveis
- **Plano de Ação Global** — consolidado de iniciativas entre reuniões, com filtros e atualizações em lote
- **Atas** — upload seguro com links assinados (7 dias) e disparo automático para participantes
- **Auditoria** — logs automáticos e imutáveis de todas as ações do sistema
- **Cadastro de Membros** — via Edge Function segura com criação no Auth + tabela members

### Usuários do sistema

| Papel | Permissões |
|---|---|
| SuperAdmin | Acesso total a todos os clientes |
| Administrador | Gestão completa do próprio `client_id` |
| Secretário | Pode criar e editar reuniões |
| Conselheiro | Somente visualização e votação |

---

## 2. STACK TECNOLÓGICA

### Front-end
- **React** + **TypeScript** — tipagem estática
- **Vite** — build e dev server
- **Tailwind CSS** — estilização (identidade visual: tons slate + amber, fonte bold/italic, estética premium corporativa)
- **Recharts** — gráficos no Dashboard (PieChart, BarChart)
- **Lucide React** — ícones

### Back-end (Supabase)
- **PostgreSQL** via Supabase (Backend-as-a-Service)
- **Row Level Security (RLS)** — segurança em nível de banco de dados
- **Edge Functions** — lógica serverless para e-mails, notificações e cadastro de usuários
- **Storage** — arquivos protegidos via Signed URLs (7 dias de validade)
- **Auth nativo** — `supabase.auth.signInWithPassword()`, `getSession()`, `onAuthStateChange()`

### Infraestrutura
- **Vercel** — deploy automático por branch (main = produção, develop = homologação)
- **GitHub** — repositório `lucasmclemente/gestor-conselho-inepad`
- **Dois projetos Supabase separados** — um para `main` (produção) e outro para `develop`

---

## 3. ESTRUTURA DE PASTAS

```
GESTOR-CONSELHO-INEPAD/
├── .vscode/
├── components/        ← pasta existe mas ainda não utilizada (App.tsx é monolítico)
├── node_modules/
├── public/            ← logo-login.jpg, logo-sidebar.jpg, favicon.png
├── services/
├── supabase/
├── .env               ← VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
├── .gitignore
├── App.tsx            ← componente principal (~950 linhas)
├── CLAUDE.md          ← este arquivo
├── constants.ts
├── index.html
├── index.tsx
├── metadata.json
├── package.json
├── tsconfig.json
├── types.ts
├── vite-env.d.ts
└── vite.config.ts
```

---

## 4. BANCO DE DADOS — SCHEMA

### Tabela: `members`
| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid | FK para `auth.users` |
| name | text | Nome completo |
| email | text | E-mail corporativo — **UNIQUE constraint ativa** |
| role | text | Administrador / Secretário / Conselheiro / SuperAdmin |
| created_at | timestamptz | |
| client_id | text | Identificador do tenant (ex: "INEPAD") |

> ⚠️ A coluna `password` foi removida em 26/05/2026 — era uma vulnerabilidade crítica.

### Tabela: `meetings`
| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid | |
| title | text | |
| status | text | Agendada / Em Andamento / Concluída |
| date | date | |
| time | time | |
| type | text | Híbrida / Presencial / Online |
| link | text | Link da videochamada |
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
| username | text | Nome do usuário que executou a ação |
| action | text | Ex: Login, Salvamento, Upload, Convocação, Cadastro |
| details | text | Descrição da ação |
| client_id | text | Isolamento multi-tenant |

---

## 5. SEGURANÇA — STATUS ATUAL (26/05/2026)

### ✅ Implementado e validado

| Item | Detalhe |
|---|---|
| Coluna `password` removida | Vulnerabilidade crítica eliminada |
| Senhas redefinidas | Todos os usuários redefinidos após exposição |
| RLS ativa em todas as tabelas | Isolamento por client_id no banco |
| Auth nativo Supabase | Login via `signInWithPassword` |
| Storage protegido | Signed URLs de 7 dias |
| Logs imutáveis | Apenas INSERT permitido em audit_logs |
| Edge Function create-user | Cria usuário no Auth + members com upsert |
| Constraint UNIQUE em email | Adicionada em ambos os projetos |
| Dados sujos removidos | Registros órfãos deletados |
| RLS meetings consolidada | Políticas redundantes removidas |

### RLS Policies ativas — `members`
| Policy | Comando |
|---|---|
| Admins can manage their own client members | ALL |
| Members isolation by client_id | ALL |
| Privacidade de membros | SELECT |
| Users can view colleagues | SELECT |

### RLS Policies ativas — `meetings`
| Policy | Comando | Descrição |
|---|---|---|
| SuperAdmin acessa tudo | ALL | SuperAdmin vê todos os clientes |
| Users can view own client meetings / Meetings isolation | ALL | Isolamento por client_id |
| Apenas Adm e Sec gerem reuniões | ALL | Restringe criação/edição por papel |

### RLS Policies ativas — `audit_logs`
| Policy | Comando |
|---|---|
| Admins can view their logs | SELECT |
| Audit logs isolation by client_id | ALL |
| Logs imutáveis | INSERT |
| Ver logs da própria empresa | SELECT |

---

## 6. EDGE FUNCTIONS

| Função | Descrição |
|---|---|
| `create-user` | Cria usuário no Auth + grava em members (upsert por email) + log de auditoria |
| `send-invitation` | Dispara convocação oficial por e-mail com pauta da reunião |
| `send-minute-notification` | Envia ata publicada + relatório de pendências por responsável |
| `clicksign-flow` | Integração com ClickSign (assinatura digital) — em desenvolvimento |

### Configuração das Edge Functions
- **JWT verification:** DESATIVADO em todas as funções (autenticação feita via header Authorization)
- As funções usam `SUPABASE_SERVICE_ROLE_KEY` para operações administrativas

---

## 7. VARIÁVEIS DE AMBIENTE

### Projeto local (.env)
```env
VITE_SUPABASE_URL=https://[projeto-develop].supabase.co
VITE_SUPABASE_ANON_KEY=[chave_anonima_develop]
```

### Vercel — Environment Variables
| Variável | Ambiente |
|---|---|
| VITE_SUPABASE_URL | Production and Preview → aponta para Supabase main |
| VITE_SUPABASE_ANON_KEY | Production and Preview → aponta para Supabase main |
| VITE_SUPABASE_URL | Preview + develop → aponta para Supabase develop |
| VITE_SUPABASE_ANON_KEY | Preview + develop → aponta para Supabase develop |

> ⚠️ Nunca commitar o arquivo `.env`. Confirmado que está no `.gitignore`.

---

## 8. LÓGICA DE AUTENTICAÇÃO

```typescript
// Login
supabase.auth.signInWithPassword({ email, password })

// Sessão atual
supabase.auth.getSession()

// Listener de mudança de estado
supabase.auth.onAuthStateChange((_event, session) => {
  if (session) fetchMemberProfile(session.user.id)
  else setCurrentUser(null)
})

// Perfil do usuário — lê da tabela members
supabase.from('members').select('id, name, email, role, client_id').eq('id', userId)
```

> 📌 **Pendência futura:** migrar `fetchMemberProfile` para ler `role` e `client_id` do `user_metadata` do Auth em vez da tabela `members`. Isso elimina o último vetor de escalada de privilégios.

---

## 9. FLUXO DE CADASTRO DE MEMBROS

```
Admin preenche formulário no sistema
        ↓
Front-end chama supabase.functions.invoke('create-user') com Bearer token
        ↓
Edge Function cria usuário no Supabase Auth (com email_confirm: true)
        ↓
Edge Function faz upsert em members (onConflict: 'email')
        ↓
Edge Function grava log em audit_logs (silencioso se falhar)
        ↓
Front-end verifica diretamente em members se o usuário foi criado
        ↓
Exibe sucesso ou erro
```

---

## 10. PADRÕES DE DESENVOLVIMENTO

### Identidade visual (não alterar)
- Cores: `slate-900` (fundo sidebar), `amber-600` (destaque/ação), `white` (cards)
- Tipografia: `font-bold italic uppercase tracking-widest` nos labels
- Cards: `rounded-xl border border-slate-200 shadow-sm`
- Botões primários: `bg-amber-600 hover:bg-amber-700 text-white`
- Botões secundários: `bg-slate-900 text-amber-500`

### Regras de negócio críticas
- Todo dado gravado deve incluir `client_id: currentUser.client_id`
- Convidados externos (`isExternal: true`) não podem assumir ações no Plano de Ação
- Logs de auditoria são **imutáveis** — nunca permitir UPDATE ou DELETE em `audit_logs`
- Signed URLs de arquivos expiram em **7 dias**
- Votações só são permitidas para participantes internos (não convidados)
- Cadastro de membros sempre via Edge Function `create-user` — nunca inserção direta

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
Desenvolve e testa no localhost (npm run dev)
        ↓
Commit + push para branch develop
        ↓
Vercel faz deploy automático na URL de develop
        ↓
Testa na URL de develop (aponta para Supabase develop)
        ↓
git checkout main && git merge develop && git push origin main
        ↓
Vercel faz deploy automático na URL de produção
        ↓
git checkout develop (sempre trabalhar na develop)
```

---

## 12. PENDÊNCIAS — PRÓXIMA SPRINT

### 🟡 Segurança
- Migrar `fetchMemberProfile` para ler `role` e `client_id` do `user_metadata` do Auth
- Isso elimina o risco de escalada de privilégios via edição direta da tabela `members`

### 🟢 Funcionalidades
- Módulo avançado de relatórios em PDF (Dashboard)
- Integração ClickSign para assinatura digital de atas (`clicksign-flow` já existe)
- Refatorar `App.tsx` em componentes na pasta `components/`

---

## 13. COMANDOS ÚTEIS

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build

# Deploy para develop
git add . && git commit -m "mensagem" && git push origin develop

# Merge para produção
git checkout main && git merge develop && git push origin main && git checkout develop
```

---

*Documento atualizado em 26/05/2026 após sessão de segurança e homologação.*