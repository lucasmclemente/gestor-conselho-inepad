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

const TELNYX = 'https://api.telnyx.com/v2';

serve(async (req) => {
  const headers = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...headers, 'Content-Type': 'application/json' } });

  // ── Autorização (usuário do CRM) ────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);
  const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const role = (user.app_metadata as any)?.role;
  if (!['SuperAdmin', 'Administrador', 'Comercial'].includes(role)) return json({ error: 'Forbidden' }, 403);

  const API_KEY = Deno.env.get('TELNYX_API_KEY') ?? '';
  const CONNECTION_ID = Deno.env.get('TELNYX_CONNECTION_ID') ?? '';
  const CALLER_ID = Deno.env.get('TELNYX_CALLER_ID') ?? '';
  const INBOUND_CRED = Deno.env.get('TELNYX_INBOUND_CREDENTIAL_ID') ?? '';
  if (!API_KEY || !CONNECTION_ID) return json({ error: 'Telnyx não configurado (API key/connection).' }, 400);

  const tnx = (path: string, body?: object, method = 'POST') => fetch(`${TELNYX}${path}`, {
    method,
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const mintToken = async (credId: string) => {
    const r = await tnx(`/telephony_credentials/${credId}/token`);
    const t = await r.text();
    return (r.ok && t) ? t.trim() : null;
  };

  const body = await req.json().catch(() => ({}));
  const action = body?.action || 'outbound';

  // ── SETUP (admin, 1x): cria a credencial COMPARTILHADA de entrada e devolve o sip_username ──
  // Todos os webfones registram sob ela → com "simultaneous ring" ligado, tocam juntos.
  if (action === 'inbound_setup') {
    if (!['SuperAdmin', 'Administrador'].includes(role)) return json({ error: 'Forbidden' }, 403);
    const expires_at = new Date(Date.now() + 3650 * 24 * 3600 * 1000).toISOString(); // ~10 anos
    const r = await tnx('/telephony_credentials', { connection_id: CONNECTION_ID, name: 'boardplan-inbound', expires_at });
    const b = await r.json().catch(() => ({}));
    const cred = b?.data;
    if (!r.ok || !cred?.id) return json({ error: 'Falha ao criar credencial de entrada.', detail: b?.errors || b }, 400);
    return json({ credential_id: cred.id, sip_username: cred.sip_username || null, note: 'Defina TELNYX_INBOUND_CREDENTIAL_ID com credential_id e use sip_username no TeXML.' });
  }

  // ── INBOUND: token da credencial COMPARTILHADA (mesma para todos) ──
  if (action === 'inbound') {
    if (!INBOUND_CRED) return json({ error: 'Recebimento não configurado (TELNYX_INBOUND_CREDENTIAL_ID ausente).' }, 400);
    const token = await mintToken(INBOUND_CRED);
    if (!token) return json({ error: 'Falha ao gerar o token de entrada.' }, 400);
    return json({ token, callerId: CALLER_ID });
  }

  // ── OUTBOUND (padrão): credencial efêmera por sessão (expira em ~2h) ──
  const expires_at = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  const credRes = await tnx('/telephony_credentials', {
    connection_id: CONNECTION_ID,
    name: `boardplan-${user.id.slice(0, 8)}`,
    expires_at,
  });
  const credBody = await credRes.json().catch(() => ({}));
  const credId = credBody?.data?.id;
  if (!credRes.ok || !credId) return json({ error: 'Falha ao criar credencial Telnyx.', detail: credBody?.errors || credBody }, 400);

  const token = await mintToken(credId);
  if (!token) return json({ error: 'Falha ao gerar o token Telnyx.' }, 400);

  return json({ token, callerId: CALLER_ID });
});
