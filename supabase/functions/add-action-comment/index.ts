import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com', 'http://localhost:3000'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const preview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin);
  const allowed = ALLOWED_ORIGINS.includes(origin) || preview ? origin : ALLOWED_ORIGINS[0];
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Vary': 'Origin' };
}

// Acrescenta uma observação ATRIBUÍDA (append-only) a uma ação do plano.
// Qualquer membro interno de governança (Conselheiro incluído) pode comentar, sem
// alterar status/nota/prazo. O Conselheiro não tem escrita direta em meetings (RLS);
// esta função grava com service role, escopada ao tenant do solicitante.
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
  if (!['Administrador', 'Secretário', 'Conselheiro', 'SuperAdmin'].includes(role)) return json({ error: 'Sem permissão.' }, 403);

  try {
    const { meetingId, actionId, text } = await req.json();
    const clean = String(text || '').trim();
    if (!meetingId || actionId == null || !clean) return json({ error: 'Parâmetros ausentes.' }, 400);
    if (clean.length > 2000) return json({ error: 'Observação muito longa (máx. 2000 caracteres).' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: meeting } = await admin.from('meetings').select('id, client_id, title, acoes').eq('id', meetingId).maybeSingle();
    if (!meeting) return json({ error: 'Reunião não encontrada.' }, 404);

    const isSuper = role === 'SuperAdmin';
    const allowed = isSuper || meeting.client_id === homeClient || secClients.includes(meeting.client_id);
    if (!allowed) return json({ error: 'Sem permissão para esta empresa.' }, 403);

    const acoes = [...(meeting.acoes || [])];
    const idx = acoes.findIndex((a: any) => String(a.id) === String(actionId));
    if (idx < 0) return json({ error: 'Ação não encontrada.' }, 404);

    // Nome do autor (tabela members é a fonte confiável; app_metadata pode não ter o nome)
    let author = user.email || 'Membro';
    try { const { data: m } = await admin.from('members').select('name').eq('id', user.id).maybeSingle(); if (m?.name) author = m.name; } catch (_) { /* usa e-mail */ }

    const comment = {
      id: crypto.randomUUID(),
      author,
      authorId: user.id,
      text: clean,
      at: new Date().toISOString(),
    };
    acoes[idx] = { ...acoes[idx], comments: [...(acoes[idx].comments || []), comment] };
    const { error } = await admin.from('meetings').update({ acoes }).eq('id', meeting.id);
    if (error) return json({ error: 'Erro ao gravar a observação.' }, 400);

    try { await admin.from('audit_logs').insert([{ username: author, action: 'Plano de Ação', details: `Observação em: ${acoes[idx].title || 'ação'}`, client_id: meeting.client_id }]); } catch (_) { /* silencioso */ }

    return json({ ok: true, comment });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
});
