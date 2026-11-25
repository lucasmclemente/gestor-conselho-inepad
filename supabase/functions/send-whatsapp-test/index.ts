import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTemplate } from "../_shared/whatsapp.ts";

// Disparo manual de um template do WhatsApp para um número (teste do admin).
// Valida os secrets da Meta (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN) e o
// módulo _shared/whatsapp.ts. Só Adm/Sec/Super. Grava em whatsapp_logs.

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com', 'https://app.boardplan.com.br', 'http://localhost:3000'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const preview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin);
  const allowed = ALLOWED_ORIGINS.includes(origin) || preview ? origin : ALLOWED_ORIGINS[0];
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
}

serve(async (req) => {
  const c = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: c });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...c, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);
  const authed = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await authed.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);
  const role = (user.app_metadata as any)?.role;
  const clientId = (user.app_metadata as any)?.client_id ?? null;
  if (!['Administrador', 'Secretário', 'SuperAdmin'].includes(role)) return json({ error: 'Sem permissão.' }, 403);

  try {
    const { to, template, lang, bodyParams, urlButtonSuffix } = await req.json();
    if (!to) return json({ error: 'Número (to) é obrigatório.' }, 400);

    const r = await sendTemplate({
      to: String(to),
      template: String(template || 'hello_world'),
      lang: lang || 'en_US',
      bodyParams: Array.isArray(bodyParams) ? bodyParams.map(String) : [],
      urlButtonSuffix: urlButtonSuffix ? String(urlButtonSuffix) : undefined,
    });

    // Log best-effort (service role)
    try {
      const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } });
      await admin.from('whatsapp_logs').insert([{
        client_id: clientId || 'TESTE',
        member_email: user.email,
        phone: String(to),
        template: String(template || 'hello_world'),
        wam_id: r.wam_id ?? null,
        status: r.ok ? 'sent' : 'failed',
        error: r.error ?? null,
      }]);
    } catch (_) { /* silencioso */ }

    return json(r, r.ok ? 200 : 502);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
