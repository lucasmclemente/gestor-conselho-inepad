import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendText, sendTemplate } from "../_shared/whatsapp.ts";

// Disparo manual de um WhatsApp de teste para um número (teste do admin).
// Valida os secrets da Twilio (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN) e o
// módulo _shared/whatsapp.ts. Manda TEXTO livre (Sandbox). Só Adm/Sec/Super.
// Grava em whatsapp_logs.

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
    const { to, body, contentSid, variables } = await req.json();
    if (!to) return json({ error: 'Número (to) é obrigatório.' }, 400);

    // Se vier contentSid (ou nenhum body) → manda TEMPLATE (caminho de produção,
    // não exige janela de 24h). Default: template de exemplo da Twilio (lembrete).
    // Se vier body explícito → manda TEXTO livre (só funciona com janela aberta).
    let r;
    if (typeof body === 'string' && body.trim()) {
      r = await sendText({ to: String(to), body: body.trim() });
    } else {
      const cs = (typeof contentSid === 'string' && contentSid) ? contentSid : 'HXb5b62575e6e4ff6129ad7c8efe1f983e';
      const vars = (variables && typeof variables === 'object') ? variables : { '1': '26/11', '2': '15h' };
      r = await sendTemplate({ to: String(to), contentSid: cs, variables: vars });
    }

    // Log best-effort (service role)
    try {
      const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } });
      await admin.from('whatsapp_logs').insert([{
        client_id: clientId || 'TESTE',
        member_email: user.email,
        phone: String(to),
        template: 'teste-texto',
        wam_id: r.wam_id ?? null,
        status: r.ok ? 'sent' : 'failed',
        error: r.error ?? null,
      }]);
    } catch (_) { /* silencioso */ }

    // Sempre 200: o app lê data.error e mostra o motivo exato da Twilio no alerta.
    return json(r, 200);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
