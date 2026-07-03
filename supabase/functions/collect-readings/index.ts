import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { signVoteToken, verifyVoteToken } from "../_shared/votetoken.ts"
import { fireForReading } from "../_shared/triggers.ts"

const ALLOWED_ORIGINS = [
  'https://conselho.inepadconsulting.com',
  'http://localhost:3000',
]
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const isVercelPreview = /^https:\/\/gestor-conselho-inepad[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || isVercelPreview ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
const nowSec = () => Math.floor(Date.now() / 1000)

serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', SECRET, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    const body = await req.json()
    const action = body.action

    // ---- mint: gera o token de coleta (requer Adm/Sec/Super do cliente) ----
    if (action === 'mint') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return json({ error: 'Unauthorized' }, 401)
      const authClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
      const { data: { user } } = await authClient.auth.getUser()
      if (!user) return json({ error: 'Unauthorized' }, 401)
      const role = (user.user_metadata as any)?.role ?? ''
      const home = (user.user_metadata as any)?.client_id ?? null
      const sec: string[] = Array.isArray((user.user_metadata as any)?.secretary_clients) ? (user.user_metadata as any).secretary_clients : []
      if (!['Administrador', 'Secretário', 'SuperAdmin'].includes(role)) return json({ error: 'forbidden' }, 403)
      const { client_id, period } = body
      if (!client_id || !period) return json({ error: 'missing client_id/period' }, 400)
      if (!(role === 'SuperAdmin' || client_id === home || sec.includes(client_id))) return json({ error: 'forbidden' }, 403)
      const per = /^\d{4}-\d{2}$/.test(String(period)) ? `${period}-01` : String(period)
      const exp = nowSec() + 45 * 24 * 3600 // 45 dias
      const token = await signVoteToken(SECRET, { p: 'collect', c: client_id, m: per, e: exp })
      return json({ token })
    }

    // ---- info / submit: públicos, validados por token ----
    const payload = await verifyVoteToken(SECRET, body.token || '')
    if (!payload || payload.p !== 'collect') return json({ error: 'Link inválido.' }, 401)
    if (!payload.e || payload.e < nowSec()) return json({ error: 'Link expirado. Solicite um novo à secretaria.' }, 401)
    const cid = payload.c
    const per = payload.m

    if (action === 'info') {
      const { data: client } = await admin.from('clients').select('name').eq('client_id', cid).maybeSingle()
      const { data: inds } = await admin.from('indicators').select('id, name, unit, category').eq('client_id', cid).eq('active', true).order('name')
      const { data: existing } = await admin.from('indicator_readings').select('indicator_id, value').eq('client_id', cid).eq('period', per)
      const exMap: Record<string, any> = {}
      ;(existing || []).forEach((r: any) => { exMap[r.indicator_id] = r.value })
      return json({ clientName: client?.name || cid, period: per, indicators: (inds || []).map((i: any) => ({ id: i.id, name: i.name, unit: i.unit, category: i.category, current: exMap[i.id] ?? null })) })
    }

    if (action === 'submit') {
      const values = Array.isArray(body.values) ? body.values : []
      const { data: inds } = await admin.from('indicators').select('id, name, unit').eq('client_id', cid).eq('active', true)
      const indMap = new Map((inds || []).map((i: any) => [i.id, i]))
      let ok = 0, fired = 0
      for (const v of values) {
        const ind: any = indMap.get(v.indicator_id)
        if (!ind) continue
        const num = Number(v.value)
        if (v.value === '' || v.value === null || v.value === undefined || isNaN(num)) continue
        const { data: reading, error } = await admin.from('indicator_readings')
          .upsert([{ client_id: cid, indicator_id: v.indicator_id, period: per, value: num, source: 'Coleta externa' }], { onConflict: 'indicator_id,period' })
          .select('id').single()
        if (error || !reading) continue
        ok++
        try {
          const res = await fireForReading(admin, { id: reading.id, client_id: cid, value: num, period: per, indicatorName: ind.name, indicatorUnit: ind.unit || '' })
          fired += res.fired.length
        } catch (_) { /* segue */ }
      }
      try { await admin.from('audit_logs').insert([{ username: 'Coleta externa', action: 'Coleta de indicadores', details: `${ok} leitura(s) via link de coleta (${String(per).slice(0, 7)}).`, client_id: cid }]) } catch (_) { /* silencioso */ }
      return json({ ok, fired })
    }

    return json({ error: 'ação inválida' }, 400)
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500)
  }
})
