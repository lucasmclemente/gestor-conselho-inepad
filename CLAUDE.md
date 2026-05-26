# CLAUDE.md — GovCorp | INEPAD Consultoria
> Arquivo de contexto do projeto. Injete este arquivo no início de qualquer sessão de desenvolvimento.

---

## 1. VISÃO GERAL DO PROJETO

**Nome:** GovCorp — Plataforma de Gestão de Conselhos  
**Cliente:** INEPAD Consultoria (Governança e Sucessão Empresarial)  
**Modelo:** Multi-tenant SaaS (múltiplas empresas clientes, dados isolados por `client_id`)  
**Status:** Núcleo funcional em produção. Em refinamento de segurança antes de testes com clientes reais.

### O que o sistema faz

Plataforma corporativa que gerencia o ciclo completo de reuniões de Conselhos Deliberativos e Consultivos:

- **Convocações oficiais** — disparo automático de e-mails com pauta e logística
- **Ordem do Dia** — controle de pautas com cronômetro em tempo real e alertas de estouro
- **Deliberações** — sistema formal de votação (Favor / Contra / Abstenção) com painel de votantes elegíveis
- **Plano de Ação Global** — consolidado de iniciativas entre reuniões, com filtros e atualizações em lote
- **Atas** — upload seguro com links assinados (7 dias) e disparo automático para participantes
- **Auditoria** — logs automáticos e imutáveis de todas as ações do sistema

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
- **Edge Functions** — lógica serverless para e-mails e notificações
- **Storage** — arquivos protegidos via Signed URLs (7 dias de validade)
- **Auth nativo** — `supabase.auth.signInWithPassword()`, `getSession()`, `onAuthStateChange()`

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
├── App.tsx            ← componente principal (700+ linhas — refatoração planejada)
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
| email | text | E-mail corporativo |
| password | text | ⚠️ COLUNA LEGADA — deve ser removida (ver Segurança) |
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
| action | text | Ex: Login, Salvamento, Upload, Convocação |
| details | text | Descrição da ação |
| client_id | text | Isolamento multi-tenant |

---

## 5. SEGURANÇA — RLS POLICIES ATIVAS

### Tabela `members`
| Policy | Comando | Descrição |
|---|---|---|
| Admins can manage their own client members | ALL | Admins só gerenciam membros do próprio client_id |
| Members isolation by client_id | ALL | Isolamento total por tenant |
| Privacidade de membros | SELECT | Restringe leitura |
| Users can view colleagues | SELECT | Usuário vê colegas do mesmo client_id |

### Tabela `meetings`
| Policy | Comando | Descrição |
|---|---|---|
| Apenas Adm e Sec gerem reuniões | ALL | Restringe criação/edição por papel |
| Meetings isolation | ALL | Isolamento geral |
| Meetings isolation by client_id | ALL | Isolamento por tenant |
| Membros veem reuniões da própria empresa | SELECT | Conselheiros só leem |
| Tenant Isolation Policy | ALL | Camada adicional de isolamento |

### Tabela `audit_logs`
| Policy | Comando | Descrição |
|---|---|---|
| Admins can view their logs | SELECT | |
| Audit logs isolation by client_id | ALL | Isolamento por tenant |
| Logs imutáveis | INSERT | Apenas inserção permitida — logs não podem ser editados |
| Ver logs da própria empresa | SELECT | |

### Tabela `server_audit_logs`
| Policy | Comando | Descrição |
|---|---|---|
| Admin can view logs | SELECT | Somente admins visualizam |

---

## 6. EDGE FUNCTIONS

| Função | Endpoint | Descrição |
|---|---|---|
| `send-invitation` | /functions/v1/send-invitation | Dispara convocação oficial por e-mail com pauta da reunião |
| `send-minute-notification` | /functions/v1/send-minute-notification | Envia ata publicada + relatório de pendências por responsável |
| `clicksign-flow` | /functions/v1/clicksign-flow | Integração com ClickSign (assinatura digital) |

---

## 7. VARIÁVEIS DE AMBIENTE

```env
VITE_SUPABASE_URL=https://[projeto].supabase.co
VITE_SUPABASE_ANON_KEY=[chave_anonima]
```

> ⚠️ Nunca commitar o arquivo `.env`. Confirmar que está no `.gitignore`.

---

## 8. LÓGICA DE AUTENTICAÇÃO

O sistema usa **exclusivamente** o auth nativo do Supabase:

```ts
// Login
supabase.auth.signInWithPassword({ email, password })

// Sessão atual
supabase.auth.getSession()

// Listener de mudança de estado
supabase.auth.onAuthStateChange((_event, session) => {
  if (session) fetchMemberProfile(session.user.id)
  else setCurrentUser(null)
})

// Perfil do usuário
supabase.from('members').select('id, name, email, role, client_id').eq('id', userId)
```

O `client_id` e o `role` são lidos da tabela `members` após autenticação. O isolamento multi-tenant depende da integridade desses campos.

---

## 9. PENDÊNCIAS DE SEGURANÇA (prioridade antes de clientes reais)

### 🔴 CRÍTICO — Executar imediatamente

| # | Tarefa | Como resolver |
|---|---|---|
| 1 | **Remover coluna `password`** da tabela `members` | Table Editor → members → deletar coluna `password` |
| 2 | **Trocar senhas de todos os usuários** cadastrados | Supabase Auth → Users → Send reset email |

### 🟡 IMPORTANTE — Antes dos testes com clientes

| # | Tarefa | Descrição |
|---|---|---|
| 3 | Migrar `role` e `client_id` para `auth.users.user_metadata` | Elimina dependência da tabela `members` para controle de acesso |
| 4 | Revisar políticas RLS duplicadas em `meetings` | Existem 5 políticas na tabela — consolidar para evitar conflitos |
| 5 | Confirmar que `.env` está no `.gitignore` | Nunca expor chaves no repositório |

### 🟢 MELHORIAS — Próxima sprint

| # | Tarefa | Descrição |
|---|---|---|
| 6 | Refatorar `App.tsx` em componentes | Mover para pasta `components/` já existente |
| 7 | Módulo de relatórios em PDF | Expansão do Dashboard |
| 8 | Integração ClickSign | Edge Function já existe (`clicksign-flow`) |

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
- Logs de auditoria são **imutáveis** — nunca permitir UPDATE ou DELETE na tabela `audit_logs`
- Signed URLs de arquivos expiram em **7 dias** (padrão definido em contrato)
- Votações só são permitidas para participantes internos (não convidados)

### Permissões por papel
```ts
const isSuper = currentUser?.role === 'SuperAdmin'
const isAdm = currentUser?.role === 'Administrador' || isSuper
const isSec = currentUser?.role === 'Secretário'
const canEdit = isAdm || isSec
```

---

## 11. COMANDOS ÚTEIS

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build
```

---

*Documento gerado em 25/05/2026. Atualizar sempre que houver mudanças estruturais no projeto.*