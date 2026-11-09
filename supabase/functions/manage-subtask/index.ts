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
const BUCKET = 'meeting-files';

// Gerencia SUBTAREFAS de uma ação do plano (meetings.acoes[i].subtasks[]) e seus anexos.
// Papéis sem escrita direta em meetings (RLS) operam via service role, escopados ao tenant.
// Permissões:
//   • supervisor (Administrador/Secretário/SuperAdmin): tudo
//   • responsável da AÇÃO-mãe: tudo nas subtarefas dela
//   • responsável da SUBTAREFA: muda status e sobe/remove anexos da sua subtarefa (não apaga a subtarefa nem troca título/resp/prazo)
// ops: add | update | remove | signUpload | attach | detach | signDownload
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
    const body = await req.json();
    const { meetingId, actionId, op, subtaskId, subtask, patch, name, path, attId } = body;
    if (!meetingId || actionId == null || !op) return json({ error: 'Parâmetros ausentes.' }, 400);
    const OPS = ['add', 'update', 'remove', 'signUpload', 'attach', 'detach', 'signDownload'];
    if (!OPS.includes(op)) return json({ error: 'Operação inválida.' }, 400);

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

    const isSupervisor = isSuper || role === 'Administrador' || role === 'Secretário';
    const respList: string[] = acoes[idx].resps?.length > 0 ? acoes[idx].resps : (acoes[idx].resp ? [acoes[idx].resp] : []);
    const isParentResp = !!myName && respList.includes(myName);

    const subs = [...(acoes[idx].subtasks || [])];
    const si = subtaskId != null ? subs.findIndex((s: any) => String(s.id) === String(subtaskId)) : -1;
    const isSubResp = si >= 0 && !!myName && subs[si]?.resp === myName;

    const cleanStatus = (s: any) => STATUSES.includes(String(s)) ? String(s) : 'Pendente';
    const cleanTitle = (t: any) => String(t || '').trim().slice(0, 300);
    const cleanResp = (r: any) => String(r || '').trim().slice(0, 200);
    const cleanDate = (d: any) => { const v = String(d || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; };
    const safeName = (n: string) => String(n || 'arquivo').replace(/[^\w.\-]+/g, '_').slice(-120);

    const save = async () => {
      acoes[idx] = { ...acoes[idx], subtasks: subs };
      const { error } = await admin.from('meetings').update({ acoes }).eq('id', meeting.id);
      if (error) throw new Error('Erro ao gravar.');
      try { await admin.from('audit_logs').insert([{ username: myName || 'Membro', action: 'Plano de Ação', details: `Subtarefa (${op}) em: ${acoes[idx].title || 'ação'}`, client_id: meeting.client_id }]); } catch (_) { /* silencioso */ }
    };

    // Toda operação exceto 'add' e 'signDownload' atua sobre uma subtarefa existente
    if (['update', 'remove', 'signUpload', 'attach', 'detach'].includes(op) && si < 0) return json({ error: 'Subtarefa não encontrada.' }, 404);

    if (op === 'add') {
      if (!(isSupervisor || isParentResp)) return json({ error: 'Só o responsável pela ação ou a secretaria criam subtarefas.' }, 403);
      const title = cleanTitle(subtask?.title);
      if (!title) return json({ error: 'Informe o título da subtarefa.' }, 400);
      if (subs.length >= 50) return json({ error: 'Limite de 50 subtarefas por ação.' }, 400);
      subs.push({ id: crypto.randomUUID(), title, resp: cleanResp(subtask?.resp), date: cleanDate(subtask?.date), status: cleanStatus(subtask?.status), materiais: [], createdBy: myName, createdAt: new Date().toISOString() });
      await save();
      return json({ ok: true, action: acoes[idx] });
    }

    if (op === 'update') {
      const p = patch || {};
      const keys = Object.keys(p);
      const onlyStatus = keys.length > 0 && keys.every(k => k === 'status');
      const allowed = isSupervisor || isParentResp || (isSubResp && onlyStatus);
      if (!allowed) return json({ error: 'Sem permissão para editar esta subtarefa.' }, 403);
      const next = { ...subs[si] };
      if (p.title != null) { const t = cleanTitle(p.title); if (!t) return json({ error: 'Título inválido.' }, 400); next.title = t; }
      if (p.resp != null) next.resp = cleanResp(p.resp);
      if (p.date != null) next.date = cleanDate(p.date);
      if (p.status != null) next.status = cleanStatus(p.status);
      subs[si] = next;
      await save();
      return json({ ok: true, action: acoes[idx] });
    }

    if (op === 'remove') {
      if (!(isSupervisor || isParentResp)) return json({ error: 'Só o responsável pela ação ou a secretaria removem subtarefas.' }, 403);
      subs.splice(si, 1);
      await save();
      return json({ ok: true, action: acoes[idx] });
    }

    if (op === 'signUpload') {
      if (!(isSupervisor || isParentResp || isSubResp)) return json({ error: 'Sem permissão para anexar nesta subtarefa.' }, 403);
      const stPath = `${meeting.client_id}/subtasks/${String(actionId)}/${String(subtaskId)}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${safeName(name)}`;
      const { data: su, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(stPath);
      if (error || !su) return json({ error: 'Não foi possível preparar o upload.' }, 400);
      return json({ ok: true, path: su.path, token: su.token });
    }

    if (op === 'attach') {
      if (!(isSupervisor || isParentResp || isSubResp)) return json({ error: 'Sem permissão para anexar nesta subtarefa.' }, 403);
      if (!path || !String(path).startsWith(`${meeting.client_id}/subtasks/${String(actionId)}/${String(subtaskId)}/`)) return json({ error: 'Caminho de anexo inválido.' }, 400);
      const mats = [...(subs[si].materiais || [])];
      if (mats.length >= 20) return json({ error: 'Limite de 20 anexos por subtarefa.' }, 400);
      mats.push({ id: crypto.randomUUID(), name: cleanTitle(name) || 'arquivo', path: String(path), uploadedAt: new Date().toISOString(), uploadedBy: myName });
      subs[si] = { ...subs[si], materiais: mats };
      await save();
      return json({ ok: true, action: acoes[idx] });
    }

    if (op === 'detach') {
      if (!(isSupervisor || isParentResp || isSubResp)) return json({ error: 'Sem permissão para remover o anexo.' }, 403);
      const mats = [...(subs[si].materiais || [])];
      const mi = mats.findIndex((x: any) => String(x.id) === String(attId));
      if (mi < 0) return json({ error: 'Anexo não encontrado.' }, 404);
      const removed = mats.splice(mi, 1)[0];
      subs[si] = { ...subs[si], materiais: mats };
      await save();
      try { await admin.storage.from(BUCKET).remove([removed.path]); } catch (_) { /* arquivo já pode ter sumido */ }
      return json({ ok: true, action: acoes[idx] });
    }

    if (op === 'signDownload') {
      // Qualquer membro do tenant com acesso à reunião pode abrir um anexo de contexto
      if (!path || !String(path).startsWith(`${meeting.client_id}/subtasks/`)) return json({ error: 'Caminho inválido.' }, 400);
      const { data: dl, error } = await admin.storage.from(BUCKET).createSignedUrl(String(path), 60 * 60 * 24 * 7);
      if (error || !dl) return json({ error: 'Não foi possível abrir o anexo.' }, 400);
      return json({ ok: true, url: dl.signedUrl });
    }

    return json({ error: 'Operação inválida.' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
});
