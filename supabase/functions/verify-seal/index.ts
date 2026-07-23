import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com', 'http://localhost:3000']
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const preview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || preview ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
}

// Verificação PÚBLICA de selo — sem login. Devolve apenas dados não sensíveis.
serve(async (req) => {
  const c = cors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: c })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...c, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  try {
    const { code } = await req.json()
    const clean = String(code || '').trim()
    if (!clean) return json({ found: false })

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: seal } = await admin.from('governance_seals').select('client_id, level, issued_at, valid_until, status, verification_code').eq('verification_code', clean).maybeSingle()
    if (!seal) return json({ found: false })

    const { data: cli } = await admin.from('clients').select('name').eq('client_id', seal.client_id).maybeSingle()
    const expired = new Date(seal.valid_until) < new Date()
    const valid = seal.status === 'valido' && !expired

    return json({
      found: true,
      valid,
      client_name: cli?.name || seal.client_id,
      level: seal.level,
      issued_at: seal.issued_at,
      valid_until: seal.valid_until,
      status: seal.status === 'revogado' ? 'revogado' : (expired ? 'expirado' : 'valido'),
      code: seal.verification_code,
    })
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500)
  }
})
