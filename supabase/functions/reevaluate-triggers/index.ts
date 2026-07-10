import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { fireForReadingMeta, sendDigestEmail } from "../_shared/triggers.ts"

// Acionada por pg_cron (diariamente). Respeita a frequência por cliente
// (governance_settings.reeval_frequency) e o last_reeval_at. Protegida por segredo.

function isDue(s: any, now: number): boolean {
  const freq = s?.reeval_frequency || 'weekly'
  if (freq === 'off') return false
  const last = s?.last_reeval_at ? new Date(s.last_reeval_at).getTime() : 0
  const ageH = (now - last) / 3600000
  if (freq === 'daily') return ageH >= 23
  if (freq === 'weekly') return ageH >= 24 * 7 - 1
  if (freq === 'monthly') return ageH >= 24 * 28
  return false
}

serve(async (req) => {
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })
  const now = Date.now()
  const nowIso = new Date(now).toISOString()

  try {
    const { data: inds } = await admin.from('indicators').select('client_id').eq('active', true)
    const clientIds = [...new Set((inds || []).map((i: any) => i.client_id))]
    const { data: settings } = await admin.from('governance_settings').select('*')
    const sMap = new Map((settings || []).map((s: any) => [s.client_id, s]))
    const { data: clients } = await admin.from('clients').select('client_id, name')
    const cName = new Map((clients || []).map((c: any) => [c.client_id, c.name]))

    let processed = 0
    let totalFired = 0
    const skipped: string[] = []

    for (const cid of clientIds) {
      const s = sMap.get(cid)
      if (!isDue(s, now)) { skipped.push(cid); continue }
      processed++

      // Última leitura de cada indicador do cliente
      const { data: rows } = await admin
        .from('indicator_readings')
        .select('id, client_id, indicator_id, value, period, indicators(name, unit)')
        .eq('client_id', cid)
        .order('period', { ascending: false })
      const latest = new Map<string, any>()
      for (const r of (rows || [])) if (!latest.has(r.indicator_id)) latest.set(r.indicator_id, r)

      for (const r of latest.values()) {
        try {
          const res = await fireForReadingMeta(admin, {
            id: r.id, client_id: cid, indicator_id: r.indicator_id, value: r.value, period: r.period,
            indicatorName: (r as any).indicators?.name ?? 'Indicador',
            indicatorUnit: (r as any).indicators?.unit ?? '',
          })
          totalFired += res.fired.length
        } catch (_) { /* não derruba o lote */ }
      }

      // Lembrete-resumo dos alertas ainda abertos
      try {
        const { data: openEv } = await admin
          .from('trigger_events')
          .select('observed_value, severity, triggers(name, indicators(name, unit))')
          .eq('client_id', cid).eq('status', 'open')
        if (openEv && openEv.length > 0) {
          const { data: admins } = await admin.from('members').select('email').eq('client_id', cid).in('role', ['Administrador', 'SuperAdmin'])
          const recipients = (admins || []).map((a: any) => a.email).filter(Boolean)
          await sendDigestEmail(recipients, cName.get(cid) || cid, openEv)
        }
      } catch (_) { /* lembrete best-effort */ }

      await admin.from('governance_settings').upsert([{ client_id: cid, last_reeval_at: nowIso, updated_at: nowIso }], { onConflict: 'client_id' })
    }

    return json({ ok: true, processed, skipped: skipped.length, fired: totalFired })
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500)
  }
})
