-- ============================================================
-- Maturidade de Governança — Fase 1: fundação do diagnóstico (pilares
-- estruturais: Propriedade, Controle, Conduta). Os pilares comportamentais
-- (Conselho, Gestão) continuam calculados no app a partir da rotina.
--
--  maturity_criteria : a RUBRICA (metodologia INEPAD) — global, editável só
--                      pelo SuperAdmin; leitura por qualquer autenticado.
--  maturity_answers  : respostas por cliente/critério (nível 0..4, N/A, nota,
--                      status declarado/validado). Escrita por Admin/Super do
--                      cliente; leitura por Admin/Sec/Super do cliente.
-- Fonte de segurança: app_metadata via helpers jwt_*.
-- ============================================================

create table if not exists public.maturity_criteria (
  id         uuid primary key default gen_random_uuid(),
  pillar     text not null,                 -- 'propriedade' | 'controle' | 'conduta'
  dimension  text not null,                 -- agrupador dentro do pilar
  item       text not null,                 -- o critério/pergunta
  weight     numeric not null default 1,
  position   int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.maturity_criteria enable row level security;
drop policy if exists maturity_criteria_read on public.maturity_criteria;
create policy maturity_criteria_read on public.maturity_criteria
  for select to authenticated using (true);
drop policy if exists maturity_criteria_write on public.maturity_criteria;
create policy maturity_criteria_write on public.maturity_criteria
  for all to authenticated
  using (public.jwt_role() = 'SuperAdmin')
  with check (public.jwt_role() = 'SuperAdmin');

create table if not exists public.maturity_answers (
  id           uuid primary key default gen_random_uuid(),
  client_id    text not null,
  criterion_id uuid not null references public.maturity_criteria(id) on delete cascade,
  level        int,                          -- 0..4 (Inexistente..Referência); null = não avaliado
  na           boolean not null default false,  -- não se aplica a este cliente
  note         text,
  status       text not null default 'declarado',  -- 'declarado' | 'validado'
  updated_by   text,
  updated_at   timestamptz not null default now(),
  validated_by text,
  validated_at timestamptz,
  unique (client_id, criterion_id)
);
create index if not exists maturity_answers_client_idx on public.maturity_answers (client_id);
alter table public.maturity_answers enable row level security;
drop policy if exists maturity_answers_read on public.maturity_answers;
create policy maturity_answers_read on public.maturity_answers
  for select to authenticated using (
    public.jwt_role() = 'SuperAdmin'
    or (public.jwt_role() in ('Administrador', 'Secretário')
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  );
drop policy if exists maturity_answers_write on public.maturity_answers;
create policy maturity_answers_write on public.maturity_answers
  for all to authenticated
  using (
    public.jwt_role() = 'SuperAdmin'
    or (public.jwt_role() = 'Administrador'
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  )
  with check (
    public.jwt_role() = 'SuperAdmin'
    or (public.jwt_role() = 'Administrador'
        and (client_id = public.jwt_client_id() or (public.jwt_secretary_clients() ? client_id)))
  );

-- Semente da rubrica (rascunho INEPAD) — só se a tabela estiver vazia
do $$
begin
  if not exists (select 1 from public.maturity_criteria) then
    insert into public.maturity_criteria (pillar, dimension, item, position) values
      -- PROPRIEDADE
      ('propriedade','Acordo de sócios','Existe acordo de sócios/acionistas formalizado',10),
      ('propriedade','Acordo de sócios','O acordo cobre compra/venda de participação, saída, impasses e tag/drag along',20),
      ('propriedade','Acordo de sócios','O acordo foi revisado nos últimos 3 anos',30),
      ('propriedade','Protocolo familiar','Existe protocolo/constituição familiar formalizado',40),
      ('propriedade','Protocolo familiar','Há política definida de emprego de familiares na empresa',50),
      ('propriedade','Protocolo familiar','Há conselho de família em funcionamento',60),
      ('propriedade','Estrutura & sucessão','A estrutura societária está organizada e documentada (ex.: holding)',70),
      ('propriedade','Estrutura & sucessão','Existe planejamento sucessório patrimonial dos sócios',80),
      ('propriedade','Dividendos & liquidez','Existe política de dividendos formal',90),
      ('propriedade','Dividendos & liquidez','Há mecanismos de liquidez/saída para sócios',100),
      -- CONTROLE
      ('controle','Controladoria','Existe uma controladoria estruturada',110),
      ('controle','Controladoria','Há fechamento contábil mensal tempestivo e confiável',120),
      ('controle','Controladoria','Relatórios gerenciais chegam ao conselho com regularidade',130),
      ('controle','Auditoria','Há auditoria independente das demonstrações financeiras',140),
      ('controle','Auditoria','Há auditoria interna / controles internos avaliados',150),
      ('controle','Fiscalização','Há conselho fiscal ou comitê de auditoria em funcionamento',160),
      ('controle','Riscos & compliance','Existe mapa de riscos e política de gestão de riscos',170),
      ('controle','Riscos & compliance','Há programa de compliance / controles anticorrupção',180),
      -- CONDUTA
      ('conduta','Ética & conduta','Existe código de conduta formalizado e comunicado',190),
      ('conduta','Ética & conduta','Há política de conflito de interesses e transações com partes relacionadas',200),
      ('conduta','Ética & conduta','Existe canal de denúncias com tratamento estruturado',210);
    raise notice 'Rubrica de maturidade semeada.';
  end if;
end $$;
