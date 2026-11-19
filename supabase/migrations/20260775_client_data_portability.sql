-- 20260775_client_data_portability.sql
-- Portabilidade e exclusão de dados por cliente (saída/cancelamento + LGPD).
--
-- Duas funções SECURITY DEFINER (só o service_role das Edge Functions chama):
--   • export_client_data(cid): devolve um jsonb com TODAS as linhas de um cliente,
--     varrendo automaticamente toda tabela do schema public que tenha coluna
--     client_id (via information_schema → inclui tabelas futuras sem manutenção).
--   • purge_client_data(cid): APAGA todas as linhas desse cliente nas mesmas tabelas,
--     exceto `clients` (apagada à parte pela Edge Function) e as trilhas de auditoria
--     `audit_logs`/`server_audit_logs` (imutáveis por design). Respeita FKs com
--     várias passadas (filhos saem antes dos pais) e devolve o que foi apagado.
--
-- Rodar em DEVELOP e PRODUÇÃO (o corpo é idêntico — não usa jwt_*/internal.*).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) EXPORTAÇÃO: dump completo de um cliente em jsonb { tabela: [linhas...] }
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.export_client_data(cid text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t      text;
  result jsonb := '{}'::jsonb;
  rows   jsonb;
begin
  if cid is null or length(trim(cid)) = 0 then
    raise exception 'client_id vazio';
  end if;

  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables ti
      on ti.table_schema = c.table_schema and ti.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'client_id'
      and ti.table_type = 'BASE TABLE'
    order by c.table_name
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.client_id = $1',
      t
    ) into rows using cid;
    result := result || jsonb_build_object(t, rows);
  end loop;

  return result;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) EXCLUSÃO: apaga todos os dados do cliente (menos clients + auditoria)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.purge_client_data(cid text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t          text;
  tbls       text[];
  pass       int := 0;
  progressed boolean := true;
  n          bigint;
  deleted    jsonb := '{}'::jsonb;
  remaining  text[] := array[]::text[];
begin
  if cid is null or length(trim(cid)) = 0 then
    raise exception 'client_id vazio';
  end if;

  -- Tabelas com client_id, exceto clients (apagada à parte) e auditoria (imutável).
  select array_agg(c.table_name order by c.table_name) into tbls
  from information_schema.columns c
  join information_schema.tables ti
    on ti.table_schema = c.table_schema and ti.table_name = c.table_name
  where c.table_schema = 'public'
    and c.column_name = 'client_id'
    and ti.table_type = 'BASE TABLE'
    and c.table_name not in ('clients', 'audit_logs', 'server_audit_logs');

  tbls := coalesce(tbls, array[]::text[]);

  -- Filhos SEM client_id que podem travar FK: qa_votes aponta p/ qa_questions.
  begin
    delete from public.qa_votes v
     using public.qa_questions q
     where v.question_id = q.id and q.client_id = cid;
  exception when undefined_table or undefined_column then null;
  end;

  -- Várias passadas: tabelas que falharem por FK são retentadas depois que os
  -- filhos saírem. Para quando uma passada inteira não apaga mais nada.
  while progressed and pass < 15 loop
    progressed := false;
    pass := pass + 1;
    foreach t in array tbls loop
      begin
        execute format('delete from public.%I where client_id = $1', t) using cid;
        get diagnostics n = row_count;
        if n > 0 then
          progressed := true;
          deleted := deleted || jsonb_build_object(
            t, coalesce((deleted ->> t)::bigint, 0) + n
          );
        end if;
      exception when foreign_key_violation then
        null; -- tenta de novo na próxima passada
      end;
    end loop;
  end loop;

  -- O que ainda restou com linhas (ajuda a diagnosticar FK não resolvida).
  foreach t in array tbls loop
    execute format('select count(*) from public.%I where client_id = $1', t)
      using cid into n;
    if n > 0 then
      remaining := array_append(remaining, t || ':' || n);
    end if;
  end loop;

  return jsonb_build_object('deleted', deleted, 'passes', pass, 'remaining', to_jsonb(remaining));
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Permissões: só o service_role (Edge Functions) pode chamar.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.export_client_data(text) from public, anon, authenticated;
revoke all on function public.purge_client_data(text)  from public, anon, authenticated;
grant execute on function public.export_client_data(text) to service_role;
grant execute on function public.purge_client_data(text)  to service_role;

comment on function public.export_client_data(text) is
  'Dump jsonb de todas as linhas de um cliente (toda tabela public com client_id). Usada pela Edge Function export-client (saída/portabilidade).';
comment on function public.purge_client_data(text) is
  'Apaga todas as linhas de um cliente (exceto clients + auditoria), respeitando FKs. Usada pela Edge Function delete-client (exclusão/LGPD).';

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK:
--   drop function if exists public.export_client_data(text);
--   drop function if exists public.purge_client_data(text);
-- ─────────────────────────────────────────────────────────────────────────────
