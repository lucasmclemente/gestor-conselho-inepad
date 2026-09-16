-- ============================================================
-- Boardplan CRM — Novo funil "Inepad" (paralelo ao "Comercial")
--
-- Espelha o funil "Inepad" (CATEGORY_ID 0) do Bitrix, com as etapas na mesma ordem.
-- O CRM já mostra o seletor de funil quando há mais de um (nada a programar).
-- Idempotente: cria o funil se não existir e semeia as etapas só se estiver vazio.
-- Rodar no cliente INEPAD.
-- ============================================================

do $$
declare
  v_pipe uuid;
  v_stages text[] := array[
    'Cadastro',
    'F1 - Pesquisa',
    'F2 - Call',
    'Agendadas',
    'Agendar Proposta',
    'Follow Up (Proposta enviada)',
    'Vendidos',
    'Nutrir',
    'NUTRIR Retomar com frequencia',
    'Descartados',
    'Finalizado',
    'Cancelado'
  ];
  v_name text;
  v_pos  int := 0;
begin
  select id into v_pipe from public.crm_pipelines
  where client_id = 'INEPAD' and name = 'Inepad' limit 1;

  if v_pipe is null then
    insert into public.crm_pipelines (client_id, name, position, is_default)
    values ('INEPAD', 'Inepad', 1, false)
    returning id into v_pipe;
  end if;

  if not exists (select 1 from public.crm_stages where pipeline_id = v_pipe) then
    foreach v_name in array v_stages loop
      insert into public.crm_stages (client_id, pipeline_id, name, position)
      values ('INEPAD', v_pipe, v_name, v_pos);
      v_pos := v_pos + 1;
    end loop;
  end if;
end $$;
