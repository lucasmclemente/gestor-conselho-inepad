import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com', 'http://localhost:3000'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const preview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin);
  const allowed = ALLOWED_ORIGINS.includes(origin) || preview ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// Grava o consentimento de listagem pública (clients.directory_opt_in). Escopado:
// só o Adm da própria empresa (ou multi-empresa) e o SuperAdmin. Service role
// atualiza APENAS essa coluna — a tabela clients não é aberta a escrita ampla.
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

  const role = user.app_metadata?.role;
  const homeClient = user.app_metadata?.client_id;
  const secClients = Array.isArray(user.app_metadata?.secretary_clients) ? user.app_metadata.secretary_clients : [];

  try {
    const { client_id, opt_in } = await req.json();
    if (!client_id || typeof opt_in !== 'boolean') return json({ error: 'Parâmetros inválidos.' }, 400);

    const isSuper = role === 'SuperAdmin';
    const isAdmOfClient = role === 'Administrador' && (client_id === homeClient || secClients.includes(client_id));
    if (!isSuper && !isAdmOfClient) return json({ error: 'Sem permissão para esta empresa.' }, 403);

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await admin.from('clients').update({ directory_opt_in: opt_in }).eq('client_id', client_id);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, client_id, directory_opt_in: opt_in });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
