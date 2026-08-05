import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { syncMailbox } from "../_shared/outlook.ts";

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const headers = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...headers, 'Content-Type': 'application/json' } });

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

  // ── Modo CRON: sincroniza TODAS as caixas conectadas ────────
  const secret = Deno.env.get('GOTO_CRON_SECRET');
  if (secret && req.headers.get('x-cron-secret') === secret) {
    const { data: conns } = await admin.from('crm_outlook_connections').select('*');
    const ran: any[] = [];
    for (const conn of (conns || [])) {
      try { ran.push({ member_id: conn.member_id, ...(await syncMailbox(admin, conn)) }); }
      catch (e) { ran.push({ member_id: conn.member_id, error: String((e as any)?.message || e) }); }
    }
    return json({ ok: true, at: new Date().toISOString(), boxes: (conns || []).length, ran });
  }

  // ── Modo USUÁRIO: sincroniza a própria caixa ────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);
  const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const role = (user.app_metadata as any)?.role;
  if (!['SuperAdmin', 'Administrador', 'Comercial'].includes(role)) return json({ error: 'Forbidden' }, 403);

  const { data: conn } = await admin.from('crm_outlook_connections').select('*').eq('member_id', user.id).maybeSingle();
  if (!conn) return json({ error: 'E-mail não conectado. Clique em "Conectar e-mail" primeiro.' }, 400);

  // botão manual: revê 14 dias completos (idempotente via dedup) + diagnóstico
  try { return json({ ok: true, ...(await syncMailbox(admin, conn, { full: true, debug: true })) }); }
  catch (e) { return json({ error: String((e as any)?.message || e) }, 400); }
});
