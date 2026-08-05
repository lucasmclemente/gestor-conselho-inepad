import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GRAPH, outlookToken, esc } from "../_shared/outlook.ts";

const ALLOWED_ORIGINS = [
  'https://conselho.inepadconsulting.com',
  'http://localhost:3000',
];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const isVercel = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin);
  const allowed = ALLOWED_ORIGINS.includes(origin) || isVercel ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const headers = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...headers, 'Content-Type': 'application/json' } });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);
  const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const role = (user.app_metadata as any)?.role;
  const cid = (user.app_metadata as any)?.client_id;
  if (!['SuperAdmin', 'Administrador', 'Comercial'].includes(role)) return json({ error: 'Forbidden' }, 403);

  const body = await req.json().catch(() => ({}));
  const to = String(body.to || '').trim();
  const subject = String(body.subject || '').trim();
  const text = String(body.body || '');
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: 'Destinatário (e-mail) inválido.' }, 400);
  if (!subject && !text) return json({ error: 'Escreva o assunto ou a mensagem.' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const { data: conn } = await admin.from('crm_outlook_connections').select('*').eq('member_id', user.id).maybeSingle();
  if (!conn) return json({ error: 'E-mail não conectado. Clique em "Conectar e-mail" primeiro.' }, 400);

  let token: string;
  try { token = await outlookToken(admin, conn); }
  catch (e) { return json({ error: String((e as any)?.message || e) }, 400); }

  const htmlBody = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#0f172a;white-space:pre-wrap">${esc(text)}</div>`;

  // 1) cria o rascunho (retorna id + internetMessageId para o histórico/threading)
  const draftRes = await fetch(`${GRAPH}/me/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject,
      body: { contentType: 'HTML', content: htmlBody },
      toRecipients: [{ emailAddress: { address: to } }],
    }),
  });
  const draft = await draftRes.json().catch(() => ({}));
  if (!draftRes.ok || !draft.id) return json({ error: 'Falha ao preparar o e-mail.', detail: draft?.error?.message || null }, 400);

  // 2) envia
  const sendRes = await fetch(`${GRAPH}/me/messages/${draft.id}/send`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
  });
  if (!sendRes.ok && sendRes.status !== 202) {
    const e = await sendRes.json().catch(() => ({}));
    return json({ error: 'Falha ao enviar o e-mail.', detail: e?.error?.message || null }, 400);
  }

  // 3) registra no histórico do negócio
  const snippet = text.length > 4000 ? text.slice(0, 4000) + '…' : text;
  const { data: act } = await admin.from('crm_activities').insert({
    client_id: cid, deal_id: body.dealId || null, contact_id: body.contactId || null, type: 'email',
    title: subject || '(sem assunto)', notes: snippet,
    owner_member_id: user.id, done: true, done_at: new Date().toISOString(),
    email_direction: 'out', email_msg_id: draft.internetMessageId || null,
  }).select().single();

  return json({ ok: true, activity: act });
});
