-- ============================================================
-- Pilar Conselho: adiciona o item documental "Regimento do conselho" à rubrica
-- (avaliado por IA contra os requisitos mínimos). Os demais sinais do Conselho
-- (atas, deliberações votadas, plano de ação em dia) são calculados no app.
-- ============================================================

do $$
begin
  if not exists (select 1 from public.maturity_criteria where pillar = 'conselho' and dimension = 'Regimento do conselho') then
    insert into public.maturity_criteria (pillar, dimension, item, position, requires_evidence, instrument, requirements)
    values ('conselho', 'Regimento do conselho', 'Existe regimento interno do conselho formalizado', 10, true, 'Regimento interno do conselho',
      '["Responsabilidades do conselho e de seus membros","Atribuições e competências do conselho","Regras de funcionamento do órgão","Procedimentos e medidas para situações de conflito de interesses"]'::jsonb);
    raise notice 'Critério Regimento do conselho semeado.';
  end if;
end $$;
