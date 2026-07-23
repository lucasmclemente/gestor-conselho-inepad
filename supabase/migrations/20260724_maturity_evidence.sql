-- ============================================================
-- Maturidade — Fase 4 (backend): evidência + avaliação por IA.
-- Itens documentais passam a exigir upload; a IA (Edge Function assess-evidence)
-- lê o PDF, confere contra os REQUISITOS MÍNIMOS do instrumento e propõe o nível.
-- A INEPAD valida (status 'validado') — é o que conta para o selo.
-- ============================================================

alter table public.maturity_criteria
  add column if not exists requires_evidence boolean not null default false,
  add column if not exists instrument text,
  add column if not exists requirements jsonb not null default '[]'::jsonb;

alter table public.maturity_answers
  add column if not exists evidence_url text,
  add column if not exists evidence_name text,
  add column if not exists ai_level int,
  add column if not exists ai_findings jsonb,
  add column if not exists ai_justification text,
  add column if not exists ai_assessed_at timestamptz;

-- Marca os itens documentais e semeia os requisitos mínimos (rascunho INEPAD)
update public.maturity_criteria set requires_evidence = true,
  instrument = 'Acordo de sócios/acionistas',
  requirements = '["Regras de compra e venda de participação","Direito de preferência","Tag along / drag along","Resolução de impasses (deadlock)","Saída de sócio (morte, retirada, exclusão)","Política de distribuição de dividendos","Regras de governança (composição e quóruns de conselho/diretoria)","Revisão/atualização nos últimos 3 anos"]'::jsonb
  where pillar = 'propriedade' and item = 'Existe acordo de sócios/acionistas formalizado';

update public.maturity_criteria set requires_evidence = true,
  instrument = 'Protocolo/constituição familiar',
  requirements = '["Valores e visão da família","Política de emprego de familiares na empresa","Regras de entrada e saída de sócios familiares","Conselho de família (composição e funcionamento)","Diretrizes de sucessão","Mecanismos de resolução de conflitos familiares"]'::jsonb
  where pillar = 'propriedade' and item = 'Existe protocolo/constituição familiar formalizado';

update public.maturity_criteria set requires_evidence = true,
  instrument = 'Política de gestão de riscos',
  requirements = '["Identificação e mapa de riscos","Matriz de probabilidade e impacto","Donos de risco (responsáveis)","Planos de mitigação","Periodicidade de revisão","Reporte ao conselho"]'::jsonb
  where pillar = 'controle' and item = 'Existe mapa de riscos e política de gestão de riscos';

update public.maturity_criteria set requires_evidence = true,
  instrument = 'Código de conduta/ética',
  requirements = '["Princípios e valores éticos","Conflito de interesses e transações com partes relacionadas","Canal de denúncias","Medidas disciplinares","Diretrizes anticorrupção (brindes, presentes, relações com o poder público)","Abrangência (a quem se aplica)","Aprovação e vigência"]'::jsonb
  where pillar = 'conduta' and item = 'Existe código de conduta formalizado e comunicado';
