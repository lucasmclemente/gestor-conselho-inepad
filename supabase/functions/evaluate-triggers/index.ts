import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { fireForReadingMeta } from "../_shared/triggers.ts"

const ALLOWED_ORIGINS = [
  'https://conselho.inepadconsulting.com',
  'https://app.boardplan.com.br',
  'http://localhost:3000',
]
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const isVercelPreview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || isVercelPreview ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  const authClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: authErr } = await authClient.auth.getUser()
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  const role = (user.user_metadata as any)?.role ?? ''
  const clientId = (user.user_metadata as any)?.client_id ?? null
  const secClients: string[] = Array.isArray((user.user_metadata as any)?.secretary_clients) ? (user.user_metadata as any).secretary_clients : []
  if (!['Administrador', 'Secretário', 'SuperAdmin', 'Controller'].includes(role)) return json({ error: 'forbidden' }, 403)

  try {
    const { indicator_reading_id } = await req.json()
    if (!indicator_reading_id) return json({ error: 'missing indicator_reading_id' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: reading, error: rErr } = await admin
      .from('indicator_readings')
      .select('id, client_id, indicator_id, value, period, indicators(name, unit)')
      .eq('id', indicator_reading_id)
      .maybeSingle()
    if (rErr || !reading) return json({ error: 'reading not found' }, 404)
    const cid = reading.client_id
    const tenantOk = role === 'SuperAdmin' || cid === clientId || secClients.includes(cid)
    if (!tenantOk) return json({ error: 'tenant mismatch' }, 403)

    const result = await fireForReadingMeta(admin, {
      id: reading.id, client_id: cid, indicator_id: reading.indicator_id, value: reading.value, period: reading.period,
      indicatorName: (reading as any).indicators?.name ?? 'Indicador',
      indicatorUnit: (reading as any).indicators?.unit ?? '',
    })
    return json(result)
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500)
  }
})
