import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS (mesmo padrão das outras funções) ──────────────────
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const AUTH_BASE = 'https://authentication.logmeininc.com/oauth';
const enc = new TextEncoder();
const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return b64url(String.fromCharCode(...new Uint8Array(sig)));
}
async function makeState(secret: string, payload: object): Promise<string> {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${await hmac(secret, body)}`;
}
async function readState(secret: string, state: string): Promise<any | null> {
  const [body, sig] = (state || '').split('.');
  if (!body || !sig || (await hmac(secret, body)) !== sig) return null;
  try {
    const json = JSON.parse(b64urlDecode(body));
    if (json.exp && Date.now() > json.exp) return null;
    return json;
  } catch { return null; }
}

serve(async (req) => {
  const headers = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...headers, 'Content-Type': 'application/json' } });

  const url = new URL(req.url);
  const CLIENT_ID = Deno.env.get('GOTO_CLIENT_ID') ?? '';
  const CLIENT_SECRET = Deno.env.get('GOTO_CLIENT_SECRET') ?? '';
  const STATE_SECRET = Deno.env.get('GOTO_STATE_SECRET') ?? '';
  const REDIRECT_URI = Deno.env.get('GOTO_REDIRECT_URI') ?? '';
  const APP_URL = Deno.env.get('GOTO_APP_URL') ?? ALLOWED_ORIGINS[0];
  const SCOPES = Deno.env.get('GOTO_SCOPES') ?? '';

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

  // ── CALLBACK: GoTo redireciona para cá com ?code&state ──────
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  if (code && stateParam) {
    const st = await readState(STATE_SECRET, stateParam);
    if (!st?.sub) return new Response('Estado inválido ou expirado.', { status: 400, headers });

    const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    const res = await fetch(`${AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
    });
    const tok = await res.json().catch(() => ({}));
    if (!res.ok || !tok.access_token) {
      // redireciona ao app com erro visível (facilita o teste)
      const msg = encodeURIComponent(tok.error_description || tok.error || 'falha_token');
      return new Response(null, { status: 302, headers: { ...headers, Location: `${APP_URL}/?goto=erro&msg=${msg}` } });
    }
    const expires_at = new Date(Date.now() + (Number(tok.expires_in) || 3600) * 1000).toISOString();
    await admin.from('crm_goto_connections').upsert({
      member_id: st.sub, client_id: st.cid,
      access_token: tok.access_token, refresh_token: tok.refresh_token ?? '',
      expires_at, scope: tok.scope ?? SCOPES, updated_at: new Date().toISOString(),
    }, { onConflict: 'member_id' });

    return new Response(null, { status: 302, headers: { ...headers, Location: `${APP_URL}/?goto=connected` } });
  }

  // ── AÇÕES AUTENTICADAS (start / status / disconnect) ────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);
  const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const role = (user.app_metadata as any)?.role;
  const cid = (user.app_metadata as any)?.client_id;
  if (!['SuperAdmin', 'Administrador', 'Comercial'].includes(role)) return json({ error: 'Forbidden' }, 403);

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const action = body.action || url.searchParams.get('action');

  if (action === 'start') {
    const state = await makeState(STATE_SECRET, { sub: user.id, cid, exp: Date.now() + 10 * 60 * 1000 });
    const params = new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI, state });
    if (SCOPES) params.set('scope', SCOPES);
    params.set('prompt', 'consent'); // força re-consentimento (pega novos escopos ao reconectar)
    return json({ url: `${AUTH_BASE}/authorize?${params}` });
  }

  if (action === 'status') {
    const { data } = await admin.from('crm_goto_connections').select('member_id, goto_line_id, expires_at').eq('member_id', user.id).maybeSingle();
    return json({ connected: !!data, line: data?.goto_line_id ?? null });
  }

  if (action === 'disconnect') {
    await admin.from('crm_goto_connections').delete().eq('member_id', user.id);
    return json({ ok: true });
  }

  return json({ error: 'Ação desconhecida' }, 400);
});
