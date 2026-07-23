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

const RANK: Record<string, number> = { ouro: 3, prata: 2, bronze: 1 };

// Diretório PÚBLICO de conselhos certificados — sem login. Lista apenas empresas
// que TÊM selo válido E consentiram (clients.directory_opt_in). Devolve só dados
// não sensíveis: nome, logo, nível, datas e código de verificação. Nunca notas.
serve(async (req) => {
  const c = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: c });
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...c, 'Content-Type': 'application/json' } });

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: optedClients } = await admin.from('clients').select('client_id, name, logo_url').eq('directory_opt_in', true);
    const optedIds = (optedClients || []).map((c: any) => c.client_id);
    if (optedIds.length === 0) return json({ items: [] });
    const cmap = new Map((optedClients || []).map((c: any) => [c.client_id, c]));

    const nowIso = new Date().toISOString();
    const { data: seals } = await admin
      .from('governance_seals')
      .select('client_id, level, issued_at, valid_until, verification_code, status')
      .in('client_id', optedIds)
      .eq('status', 'valido')
      .gt('valid_until', nowIso)
      .order('issued_at', { ascending: false });

    // Um selo por empresa: o de maior nível; em empate, o mais recente (já ordenado desc).
    const best = new Map<string, any>();
    for (const s of (seals || [])) {
      const cur = best.get(s.client_id);
      if (!cur || (RANK[s.level] || 0) > (RANK[cur.level] || 0)) best.set(s.client_id, s);
    }

    const items = Array.from(best.values()).map((s: any) => {
      const cli: any = cmap.get(s.client_id) || {};
      return {
        name: cli.name || s.client_id,
        logo_url: cli.logo_url || null,
        level: s.level,
        issued_at: s.issued_at,
        valid_until: s.valid_until,
        code: s.verification_code,
      };
    }).sort((a, b) => (RANK[b.level] - RANK[a.level]) || a.name.localeCompare(b.name));

    return json({ items });
  } catch (e: any) {
    return json({ error: String(e?.message || e), items: [] }, 500);
  }
});
