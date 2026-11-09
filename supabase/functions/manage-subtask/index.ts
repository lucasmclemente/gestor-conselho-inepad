import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com', 'https://app.boardplan.com.br', 'http://localhost:3000'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const preview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin);
  const allowed = ALLOWED_ORIGINS.includes(origin) || preview ? origin : ALLOWED_ORIGINS[0];
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Vary': 'Origin' };
}

const STATUSES = ['Pendente', 'Em andamento', 'Concluída'];

// Gerencia SUBTAREFAS de uma ação do plano (meetings.acoes[i].subtasks[]).
// Pode mutar: supervisor do tenant (Administrador/Secretário/SuperAdmin) OU o(s)
// responsável(is) da ação-mãe (ex.: um Controller/Diretor na sua própria tarefa).
// Esses papéis não têm escrita direta em meetings (RLS); esta função grava com
// service role, escopada ao tenant do solicitante. op: 'add' | 'update' | 'remove'.
serve(async (req) => {
  const c = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: c });
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...c, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);
  const authed = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await authed.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  const role = (user.app_metadata as any)?.role;
  const homeClient = (user.app_metadata as any)?.client_id;
  const secClients = Array.isArray((user.app_metadata as any)?.secretary_clients) ? (user.app_metadata as any).secretary_clients : [];
  if (!['Administrador', 'Secretário', 'Conselheiro', 'SuperAdmin', 'Controller', 'Diretor'].includes(role)) return json({ error: 'Sem permissão.' }, 403);

  try {
    const { meetingId, actionId, op, subtask, subtaskId, patch } = await req.json();
    if (!meetingId || actionId == null || !op) return json({ error: 'Parâmetros ausentes.' }, 400);
    if (!['add', 'update', 'remove'].includes(op)) return json({ error: 'Operação inválida.' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: meeting } = await admin.from('meetings').select('id, client_id, title, acoes').eq('id', meetingId).maybeSingle();
    if (!meeting) return json({ error: 'Reunião não encontrada.' }, 404);

    const isSuper = role === 'SuperAdmin';
    const tenantOk = isSuper || meeting.client_id === homeClient || secClients.includes(meeting.client_id);
    if (!tenantOk) return json({ error: 'Sem permissão para esta empresa.' }, 403);

    const acoes = [...(meeting.acoes || [])];
    const idx = acoes.findIndex((a: any) => String(a.id) === String(actionId));
    if (idx < 0) return json({ error: 'Ação não encontrada.' }, 404);

    // Nome confiável do solicitante (vínculo por NOME, como no resto do sistema)
    let myName = user.email || '';
    try { const { data: m } = await admin.from('members').select('name').eq('id', user.id).maybeSingle(); if (m?.name) myName = m.name; } catch (_) { /* usa e-mail */ }

    // Autorização de mutação: supervisor do tenant OU responsável da ação-mãe
    const isSupervisor = isSuper || role === 'Administrador' || role === 'Secretário';
    const respList: string[] = acoes[idx].resps?.length > 0 ? acoes[idx].resps : (acoes[idx].resp ? [acoes[idx].resp] : []);
    const isResp = !!myName && respList.includes(myName);
    if (!isSupervisor && !isResp) return json({ error: 'Só o responsável pela ação ou a secretaria podem alterar as subtarefas.' }, 403);

    const subs = [...(acoes[idx].subtasks || [])];

    const cleanStatus = (s: any) => STATUSES.includes(String(s)) ? String(s) : 'Pendente';
    const cleanTitle = (t: any) => String(t || '').trim().slice(0, 300);
    const cleanResp = (r: any) => String(r || '').trim().slice(0, 200);
    const cleanDate = (d: any) => { const v = String(d || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; };

    if (op === 'add') {
      const title = cleanTitle(subtask?.title);
      if (!title) return json({ error: 'Informe o título da subtarefa.' }, 400);
      if (subs.length >= 50) return json({ error: 'Limite de 50 subtarefas por ação.' }, 400);
      const st = {
        id: crypto.randomUUID(),
        title,
        resp: cleanResp(subtask?.resp),
        date: cleanDate(subtask?.date),
        status: cleanStatus(subtask?.status),
        createdBy: myName,
        createdAt: new Date().toISOString(),
      };
      subs.push(st);
    } else if (op === 'update') {
      const si = subs.findIndex((s: any) => String(s.id) === String(subtaskId));
      if (si < 0) return json({ error: 'Subtarefa não encontrada.' }, 404);
      const p = patch || {};
      const next = { ...subs[si] };
      if (p.title != null) { const t = cleanTitle(p.title); if (!t) return json({ error: 'Título inválido.' }, 400); next.title = t; }
      if (p.resp != null) next.resp = cleanResp(p.resp);
      if (p.date != null) next.date = cleanDate(p.date);
      if (p.status != null) next.status = cleanStatus(p.status);
      subs[si] = next;
    } else { // remove
      const si = subs.findIndex((s: any) => String(s.id) === String(subtaskId));
      if (si < 0) return json({ error: 'Subtarefa não encontrada.' }, 404);
      subs.splice(si, 1);
    }

    acoes[idx] = { ...acoes[idx], subtasks: subs };
    const { error } = await admin.from('meetings').update({ acoes }).eq('id', meeting.id);
    if (error) return json({ error: 'Erro ao gravar a subtarefa.' }, 400);

    try { await admin.from('audit_logs').insert([{ username: myName || 'Membro', action: 'Plano de Ação', details: `Subtarefa (${op}) em: ${acoes[idx].title || 'ação'}`, client_id: meeting.client_id }]); } catch (_) { /* silencioso */ }

    return json({ ok: true, action: acoes[idx] });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
});
