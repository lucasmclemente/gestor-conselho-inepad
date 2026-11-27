# SPEC / PLANO — Papéis por cliente (role per-tenant)

> Status: **planejamento. Nenhum código escrito ainda.** Documento para revisão antes de implementar.
> Escrito em 27/11/2026. Fazer **na develop**, testar, e só então levar à produção (com a variante `internal.*`).

## 1. Problema

Hoje o papel do usuário é **um valor único** (`app_metadata.role`, lido na JWT). O `secretary_clients`
só diz **em quais clientes** o usuário atua — mas **com o mesmo papel em todos**.

Consequência real: a equipe da INEPAD é `Administrador` (para administrar as contas dos clientes),
e esse papel vale também na própria INEPAD. Como **assinar ata, aprovar ata e votar em deliberações
são ações exclusivas do papel `Conselheiro`**, ninguém da INEPAD consegue atuar como conselheiro
na empresa deles mesmos.

**Objetivo:** um usuário poder ter **papéis diferentes por cliente**.
Ex.: Viviane Cunha = `Conselheiro` na INEPAD e `Secretário` na Hidrotube.

## 2. Modelo proposto

### 2.1 Fonte de verdade
- Novo campo **`client_roles`** (jsonb) = mapa `{ "<client_id>": "<papel>" }`, em DOIS lugares
  (como já é com `secretary_clients`):
  - `members.client_roles` (tabela);
  - `app_metadata.client_roles` (JWT — só o `service_role` grava; mantém a segurança do modelo atual).
- `role` / `client_id` **continuam existindo** como o **papel-casa / padrão** (o cliente de origem).

### 2.2 Papel efetivo (a regra central)
Para um cliente `X`:
```
papelEfetivo(X) = client_roles[X]            // se definido para esse cliente
               ?? (secretary_clients inclui X ? role : null)   // fallback: papel global
               ?? (X == client_id ? role : null)
```
- **Compatibilidade total:** com `client_roles = {}` (estado inicial de todo mundo), o papel efetivo
  é sempre o `role` global → **comportamento idêntico ao de hoje**. A migração não muda nada até
  alguém receber um papel específico por cliente.
- No front, "cliente X" = `activeClientId` (o seletor do topo, que já existe).
- No RLS, "cliente X" = o `client_id` **da linha** sendo lida/escrita.

### 2.3 Escopo dos papéis
Papéis por cliente valem para os papéis de **governança**:
`Administrador`, `Secretário`, `Conselheiro`, **`Conselheiro Consultivo`** (novo),
`Controller`, `Diretor`, `Assistente`.

Mantêm-se **globais / especiais** (não entram no mapa por cliente):
- `SuperAdmin` — cross-client por natureza (vê tudo). **Pode ter assento de conselheiro à parte (§2.5).**
- `Certificador` — papel INEPAD cross-client (só certificação).
- `Comercial` (SDR) — só CRM da INEPAD.

### 2.4 Papel novo: `Conselheiro Consultivo`
Tem **todas as funções do Conselheiro** (ver, materiais, participar, **aprovar ata com ressalvas**),
**exceto**: **não entra no bloco de assinaturas da ata** e **não vota em deliberações**.
Modela a diferença entre conselho **deliberativo** (vota/assina) e **consultivo** (assessora, não vota).
- Entra em `VALID_ROLES`, em `can_read_governance` (lê como Conselheiro) e nos menus como o Conselheiro.
- **Não** entra em `can_write_governance` (não é Adm/Sec).

### 2.5 Assento de conselheiro (board seat) — separado do papel de gestão
O que decide **assinar / aprovar / votar** não é o papel de gestão, e sim ter **assento no conselho
daquele cliente**. Hoje isso está grudado no papel único; o refactor **separa** os dois conceitos:

- **Papel de gestão** (`role` global + `client_roles[X]`): o que a pessoa pode **administrar** em X.
- **Assento de conselheiro** em X: `deliberativo` | `consultivo` | nenhum. Decide assinatura/voto/aprovação.

**Atributo novo `board_seats`** (jsonb) = `{ "<client_id>": "deliberativo" | "consultivo" }`, em
`members.board_seats` + `app_metadata.board_seats`. Usado principalmente para dar assento a quem tem
papel de gestão que **não** é de conselho (ex.: SuperAdmin, Administrador) **sem rebaixá-lo**.

**Assento efetivo em X** (derivação, nesta ordem):
```
board_seats[X]                                   // atribuição explícita (ganha)
?? (papelEfetivo(X) == 'Conselheiro'           ? 'deliberativo' : null)
?? (papelEfetivo(X) == 'Conselheiro Consultivo'? 'consultivo'   : null)
?? nenhum
```
Capacidades por assento:
| Capacidade | deliberativo | consultivo | nenhum |
|---|---|---|---|
| Assinar a ata (bloco de assinaturas do PDF) | ✅ | ❌ | ❌ |
| Votar em deliberação | ✅ | ❌ | ❌ |
| Aprovar ata (aprovar / ressalvas / reprovar) | ✅ | ✅ | ❌ |

**Casos que isto resolve:**
- **Lucas (SuperAdmin):** `role` segue `SuperAdmin` (administra tudo, inclusive INEPAD) **+**
  `board_seats = { INEPAD: 'deliberativo' }` → assina/aprova/vota na INEPAD **sem perder o Super**.
- **Viviane:** `client_roles = { INEPAD:'Conselheiro', HIDROTUBE:'Secretário' }` → assento deliberativo
  na INEPAD vem do papel; na Hidrotube é Secretária (sem assento).
- **Conselheiro comum:** `role='Conselheiro'` → assento deliberativo inferido. **Inalterado vs. hoje.**
- **Consultivo:** `role='Conselheiro Consultivo'` (ou `board_seats[X]='consultivo'`) → só aprova.

## 3. Mudanças por camada

### 3.1 Banco / migração
- `alter table members add column client_roles jsonb not null default '{}'::jsonb`.
- `alter table members add column board_seats  jsonb not null default '{}'::jsonb` (§2.5).
- Backfill: nada a copiar (ambos começam vazios = comportamento atual; `Conselheiro` existente mantém
  assento deliberativo pela inferência). Opcional: validar que os `client_id` usados existem em `clients`.
- **Sem RESTRICTIVE nova de MFA aqui:** `mfa_satisfied()` é por tenant, não por papel → **não é afetada**.

### 3.2 RLS — develop (`jwt_*`)
Adicionar helpers (search_path travado, igual aos atuais):
```sql
jwt_client_roles() -> jsonb              -- app_metadata.client_roles (default '{}')
jwt_role_for(row_client_id text) -> text -- client_roles ->> row_client_id, senão jwt_role()
```
Tornar os helpers de governança **client-aware** (passam a receber o client da linha):
```sql
can_read_governance(row_client_id text)  -- jwt_role_for(X) in (SuperAdmin,Adm,Sec,Conselheiro,Controller,Diretor...)
can_write_governance(row_client_id text)  -- jwt_role_for(X) in (SuperAdmin,Adm,Sec)
```
- **Reescrever as policies** que hoje chamam `can_read_governance()` / `can_write_governance()` sem
  argumento → passar o `client_id` da linha. Tabelas afetadas: indicadores (`indicators`,
  `indicator_readings`, `indicator_targets`, `trigger_events`, `fca`, ...), estratégia
  (`objectives`, `perspectives`, `swot_items`, `okr_*`, ...), maturidade, QA, comitês.
- **Núcleo (meetings):** a policy `Apenas Adm e Sec gerem reuniões` usa `jwt_role()` → trocar por
  `jwt_role_for(client_id)`. A de SELECT (`gov_tenant_visible`/isolamento) não muda (é por tenant).
- **members:** a escrita (`Admins can manage their own client members`) hoje é por papel global.
  Decidir: a gestão de membros de um cliente passa a exigir `jwt_role_for(client_id_do_membro) = Administrador`
  (um Conselheiro@INEPAD **não** gerencia membros da INEPAD; um Admin@Hidrotube gerencia os da Hidrotube).

### 3.3 RLS — produção (`internal.*`) — a parte mais delicada
Prod usa `internal.is_super_admin()` / `internal.get_my_client_id()` (leem a tabela `members`,
papel único) em ~7 policies do núcleo (`meetings`, `members`, `audit_logs`, storage).
- Criar o equivalente per-client **lendo a JWT** (convergir com a develop), ex.:
  `internal.jwt_role_for(client_id)` a partir de `auth.jwt() -> 'app_metadata' -> 'client_roles'`,
  com fallback para `internal.get_my_client_id()`/membro.
- Reescrever só as policies de papel do núcleo. **Variante PROD separada** da migração (mesma disciplina
  do `20260774_..._PROD.sql`). **Não mergear a versão develop crua para prod.**
- Storage (`meeting-files`, `client-logos`): revisar as policies que checam papel por app_metadata.

### 3.4 Edge Functions
Toda função que hoje faz `const role = app_metadata.role` e autoriza por ele passa a calcular
o **papel relativo ao cliente-alvo** da operação:
```ts
roleFor(targetClient) = app_metadata.client_roles?.[targetClient] ?? app_metadata.role
```
Alcance (todas já leem `role`+`secretary_clients`): `create-user`, `update-member-role`,
`set-secretary-clients`, `approve-ata-inapp`, `assess-evidence`, `compile-materials`,
`collect-readings`, `add-action-comment`, `assistant-materials`, `cobrar-acoes-comite`,
`send-invitation`, `send-minute-notification`, `send-ata-approval`, etc.
- **Writers do mapa:**
  - `set-secretary-clients` passa a aceitar **papel por cliente** e **assento por cliente** (hoje recebe
    só `clientIds[]`; passar a receber `clientIds[]` + `roles{}` + `boardSeats{}`). Grava
    `members.client_roles`/`members.board_seats` **e** os espelhos em `app_metadata`.
  - `create-user` / `update-member-role` ganham a opção de definir papel e assento por cliente.
  - `update-member-role`: incluir **`Conselheiro Consultivo`** em `VALID_ROLES`.
  - **Assento efetivo** calculado no servidor onde importa (voto/aprovação): `seatFor(targetClient)`
    = `board_seats[target]` ?? (papel efetivo deliberativo/consultivo). Ver §2.5.

### 3.5 Frontend (App.tsx)
- **Ponto central** ([App.tsx:294-304](App.tsx:294)): hoje `isSuper/isAdm/isSec/isConselheiro/...`
  derivam de `currentUser?.role`. Introduzir:
  ```ts
  const effectiveRole = currentUser?.client_roles?.[activeClientId ?? ''] ?? currentUser?.role;
  ```
  e derivar **todas** as ~31 travas de `effectiveRole` (elas já leem os booleanos `isAdm` etc.,
  então muda num lugar só — mas revisar caso a caso).
- **Assinatura/aprovação/voto** (o objetivo do pedido): hoje casam `Conselheiro` **por e-mail** dentro
  dos membros do cliente ativo (`clientMembers`), usando `members.role` (global). Trocar para o
  **assento efetivo no cliente ativo** (§2.5), não o papel de gestão:
  - **Assinatura** (PDF, `services/generateAtaPDF.ts` + chamada no App.tsx) — assina quem tem assento
    **deliberativo** naquele cliente. (Super/Admin com `board_seats` deliberativo **passam a assinar**;
    Consultivo **não** assina.)
  - **Votantes elegíveis** (deliberações) — só assento **deliberativo**. Consultivo fica **fora** do
    painel de votação. Gatear **no front e no caminho de escrita do voto** (não só no front).
  - **Aprovadores de ata** — assento **deliberativo OU consultivo**. Revisar `send-ata-approval` e
    `approve-ata-inapp` (resolução/validação do aprovador no servidor) para usar o assento efetivo.
- **UI de atribuição:** no botão/modal "Clientes" (hoje só marca quais clientes), acrescentar, por
  cliente marcado, um **seletor de papel**. Só o SuperAdmin usa (igual hoje).

### 3.6 Tipos
- `types.ts`: `Member`/`currentUser` ganham `client_roles?: Record<string,string>` e
  `board_seats?: Record<string,'deliberativo'|'consultivo'>`. Papel `'Conselheiro Consultivo'` no union de roles.
- Derivados úteis no front: `effectiveRole` (gestão, cliente ativo) e `effectiveSeat`
  (`deliberativo`/`consultivo`/none, cliente ativo) → `canSign`/`canVote`/`canApproveAta`.

## 4. Riscos e cuidados
- **Camada de segurança inteira.** O maior risco está no **RLS**, e dobrado pela divergência
  **prod (`internal.*`) × develop (`jwt_*`)**. Fazer, revisar e testar os dois separadamente.
- **Relogin obrigatório** após atribuir papéis (a JWT precisa trazer `client_roles`), igual foi com
  `app_metadata` (17/07) e `secretary_clients`.
- **Não quebrar o caso simples:** usuário mono-cliente e multi-cliente sem `client_roles` têm que
  continuar idênticos. Garantir isso com os fallbacks e testar explicitamente.
- **Gestão de membros por papel-de-cliente:** confirmar a regra desejada (um Admin num cliente gerencia
  os membros daquele cliente; não vira Admin global). Ver §3.2.
- **Tamanho da JWT:** `client_roles` é um mapa pequeno (poucos clientes por pessoa) — sem problema.
- **Auditoria:** registrar quem atribuiu qual papel em qual cliente (reusar `audit_logs`).

## 5. Matriz de teste (develop, antes da prod)
**Viviane** (`Conselheiro`@INEPAD + `Secretário`@Hidrotube):
1. Ativo = INEPAD: **aparece** nas assinaturas; é **aprovador** elegível; **vota**; **NÃO** cria/edita
   reunião nem gerencia membros da INEPAD.
2. Ativo = Hidrotube: **cria/edita** reunião; **NÃO** assina/aprova/vota (sem assento lá).
3. Troca de cliente no seletor reflete papel + assento na hora (sem recarregar além do fetch).

**Lucas** (`SuperAdmin` global + `board_seats={INEPAD:'deliberativo'}`):
4. Ativo = INEPAD: mantém **todo o SuperAdmin** (menu de Contas de Clientes etc.) **E** aparece nas
   assinaturas, aprova e vota na INEPAD.
5. Ativo = outro cliente qualquer: SuperAdmin normal; **sem** assinatura/voto (sem assento lá).

**Conselheiro Consultivo** (`role='Conselheiro Consultivo'`@INEPAD):
6. Vê tudo como Conselheiro e **pode aprovar ata**; **NÃO** aparece nas assinaturas e **NÃO** vota
   (nem no front, nem forçando o caminho de escrita do voto via API).

**Regressão / segurança:**
7. Usuário sem `client_roles`/`board_seats` (conselheiro ou admin comum): comportamento **inalterado**.
8. SuperAdmin sem assento: inalterado (vê tudo, não assina/vota).
9. **API direta** (PostgREST) com JWT de Conselheiro@INEPAD: não escreve onde o papel efetivo não
   permite — validar que o **RLS** segura, não só o front.
10. MFA: tenant com `mfa_required` continua exigindo aal2 (não regrediu).

## 6. Ordem de execução (quando aprovarmos o plano)
1. Migração `client_roles` + `board_seats` em `members` + helpers `jwt_client_roles`/`jwt_role_for`
   (e `jwt_board_seat_for`) na develop. Incluir `Conselheiro Consultivo` em `VALID_ROLES`/`can_read_governance`.
2. Governança: `can_read/write_governance(client_id)` + reescrita das policies de governança (develop).
3. Núcleo develop: policy de meetings/members por `jwt_role_for`.
4. Edge Functions: `roleFor(target)` nos gates + writers do mapa (`set-secretary-clients` etc.).
5. Frontend: `effectiveRole` + assinatura/aprovação/voto por papel efetivo + UI de atribuição.
6. Teste completo da matriz §5 na develop (caso Viviane).
7. **Variante PROD** das migrações de RLS (`internal.*`) — escrever, revisar, aplicar e testar na prod.
8. Deploy das Edge Functions nos dois ambientes; merge do front para `main`.
9. Atribuir os papéis/assentos reais: equipe INEPAD = Conselheiro na INEPAD; **Lucas = SuperAdmin +
   assento deliberativo na INEPAD**; consultivos onde aplicável. Pedir relogin.

## 7. Alternativa descartada (registro)
- **Conta separada só-conselheiro** por pessoa da INEPAD (segundo login, outro e-mail): zero código,
  mas duas contas e troca de login. Fica como paliativo de emergência, não como solução.
