import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const AUTH_BASE = 'https://authentication.logmeininc.com/oauth';
const API = 'https://api.goto.com';

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

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const { data: conn } = await admin.from('crm_goto_connections').select('*').eq('member_id', user.id).maybeSingle();
  if (!conn) return json({ error: 'Telefonia não conectada. Clique em "Conectar telefonia" primeiro.' }, 400);

  // ── Token válido (refresh se expirado) ──────────────────────
  let accessToken = conn.access_token as string;
  if (new Date(conn.expires_at).getTime() < Date.now() + 60_000) {
    const basic = btoa(`${Deno.env.get('GOTO_CLIENT_ID')}:${Deno.env.get('GOTO_CLIENT_SECRET')}`);
    const r = await fetch(`${AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token }),
    });
    const t = await r.json().catch(() => ({}));
    if (!r.ok || !t.access_token) return json({ error: 'Sessão da GoTo expirou. Reconecte a telefonia.', detail: t }, 400);
    accessToken = t.access_token;
    await admin.from('crm_goto_connections').update({
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? conn.refresh_token,
      expires_at: new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('member_id', user.id);
  }
  const gget = (path: string) => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });

  // A linha do usuário vem de GET /users/v1/lines → items[]
  const findLines = async () => {
    const raw: any = {}; let cands: any[] = [];
    try {
      const r = await gget('/users/v1/lines');
      const b = await r.json().catch(() => null);
      raw['/users/v1/lines'] = { status: r.status, body: b };
      if (Array.isArray(b?.items)) cands = b.items.filter((i: any) => i?.id).map((i: any) => ({ id: i.id, number: i.number ?? null, name: i.name ?? null }));
    } catch (e) { raw['/users/v1/lines'] = { error: String(e) }; }
    const seen = new Set<string>(); const candidates = cands.filter(c => c.id && !seen.has(c.id) && seen.add(c.id));
    return { candidates, raw };
  };

  const body = await req.json().catch(() => ({}));
  const action = body.action || 'call';

  // ── Sondagem das gravações (endpoints CERTOS: call-events-report) ──
  if (action === 'recordings') {
    const out: any = {};
    const findFirst = (node: any, key: string): any => {
      if (!node || typeof node !== 'object') return null;
      if (Array.isArray(node)) { for (const n of node) { const f = findFirst(n, key); if (f) return f; } return null; }
      if (node[key]) return node[key];
      for (const k of Object.keys(node)) { const f = findFirst(node[k], key); if (f) return f; }
      return null;
    };
    let accountKey = '';
    try { const r = await gget('/users/v1/lines'); const b = await r.json().catch(() => null); accountKey = b?.items?.[0]?.organization?.accountKey || ''; } catch { /* */ }
    out.accountKey = accountKey;
    const end = new Date().toISOString();
    const start = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    try {
      const r = await gget(`/call-events-report/v1/report-summaries?accountKey=${accountKey}&startTime=${encodeURIComponent(start)}&endTime=${encodeURIComponent(end)}`);
      const b = await r.json().catch(() => null);
      out.summaries = { status: r.status, body: b };
      const first = findFirst(b, 'conversationSpaceId');
      if (first) {
        const rr = await gget(`/call-events-report/v1/reports/${first}`);
        out.sampleReport = { status: rr.status, body: await rr.json().catch(() => null) };
      }
    } catch (e) { out.summaries_error = String(e); }
    return json(out);
  }

  // ── Diagnóstico da linha ────────────────────────────────────
  if (action === 'lines') {
    const { candidates, raw } = await findLines();
    if (candidates.length === 1) await admin.from('crm_goto_connections').update({ goto_line_id: candidates[0].id, updated_at: new Date().toISOString() }).eq('member_id', user.id);
    return json({ candidates, stored: candidates.length === 1 ? candidates[0].id : null, raw });
  }

  // ── Resolve o lineId (usa o guardado; senão detecta) ────────
  let lineId = conn.goto_line_id as string | null;
  if (!lineId) {
    const { candidates, raw } = await findLines();
    if (candidates.length >= 1) {
      lineId = candidates[0].id;
      await admin.from('crm_goto_connections').update({ goto_line_id: lineId, updated_at: new Date().toISOString() }).eq('member_id', user.id);
    } else {
      return json({ error: 'Não consegui detectar sua linha na GoTo.', detail: raw }, 400);
    }
  }

  // ── Origina a chamada ───────────────────────────────────────
  const dial = String(body.dial || '').trim();
  if (!dial) return json({ error: 'Número não informado.' }, 400);
  const callRes = await fetch(`${API}/calls/v2/calls`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dialString: dial, from: { lineId } }),
  });
  const callBody = await callRes.json().catch(() => ({}));
  if (!callRes.ok) return json({ error: 'Falha ao iniciar a chamada na GoTo.', detail: callBody }, 400);

  // ── Registra a ligação como atividade no negócio ────────────
  if (body.dealId) {
    await admin.from('crm_activities').insert({
      client_id: cid, deal_id: body.dealId, type: 'call',
      title: `Ligação para ${body.contactName || dial}`,
      notes: 'Chamada iniciada pela telefonia (GoTo).',
      owner_member_id: user.id,
    });
  }
  return json({ ok: true, callId: callBody?.id ?? callBody?.callId ?? null });
});
