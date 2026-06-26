import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

const escapeHtml = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const PRIORITY_BY_SEVERITY: Record<string, string> = { attention: 'Importante', critical: 'Urgente' }
const OP_LABEL: Record<string, string> = {
  gt: '>', gte: '≥', lt: '<', lte: '≤', outside: 'fora de', inside: 'dentro de',
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
  if (!['Administrador', 'Secretário', 'SuperAdmin'].includes(role)) return json({ error: 'forbidden' }, 403)

  try {
    const { indicator_reading_id } = await req.json()
    if (!indicator_reading_id) return json({ error: 'missing indicator_reading_id' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })

    // Carrega a leitura + nome/unidade do indicador, e confere o tenant
    const { data: reading, error: rErr } = await admin
      .from('indicator_readings')
      .select('id, client_id, indicator_id, value, period, indicators(name, unit)')
      .eq('id', indicator_reading_id)
      .maybeSingle()
    if (rErr || !reading) return json({ error: 'reading not found' }, 404)
    const cid = reading.client_id
    const tenantOk = role === 'SuperAdmin' || cid === clientId || secClients.includes(cid)
    if (!tenantOk) return json({ error: 'tenant mismatch' }, 403)

    // Avaliação determinística no banco
    const { data: breached, error: bErr } = await admin.rpc('breached_triggers_for_reading', { p_reading_id: reading.id })
    if (bErr) return json({ error: bErr.message }, 500)

    const indicatorName = (reading as any).indicators?.name ?? 'Indicador'
    const indicatorUnit = (reading as any).indicators?.unit ?? ''
    const periodLabel = reading.period ? new Date(reading.period + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) : ''

    // Container de ações geradas por gatilho (reúso do padrão "container oculto")
    let containerId: string | null = null
    let containerAcoes: any[] = []
    const ensureContainer = async () => {
      if (containerId) return
      const { data: c } = await admin.from('meetings').select('id, acoes').eq('client_id', cid).eq('type', 'Indicadores').maybeSingle()
      if (c) { containerId = c.id; containerAcoes = Array.isArray(c.acoes) ? c.acoes : []; return }
      const { data: created, error: cErr } = await admin.from('meetings').insert([{
        title: 'Gatilhos de Indicadores', status: 'Indicadores', type: 'Indicadores',
        date: null, time: null, link: '', address: '',
        participants: [], pautas: [], materiais: [], deliberacoes: [], acoes: [], atas: [],
        client_id: cid,
      }]).select('id, acoes').single()
      if (cErr) throw new Error('container: ' + cErr.message)
      containerId = created.id; containerAcoes = []
    }

    const fired: any[] = []
    for (const t of (breached ?? [])) {
      // Idempotência: 1 evento por (trigger, reading). unique() evita duplicar.
      const { data: ev, error: evErr } = await admin
        .from('trigger_events')
        .insert({
          client_id: cid, trigger_id: t.id, indicator_reading_id: reading.id,
          observed_value: reading.value, severity: t.severity, status: 'open',
        })
        .select('id')
        .single()
      if (evErr || !ev) continue // já existia (disparo repetido) → ignora

      const limite = (t.operator === 'outside' || t.operator === 'inside')
        ? `${t.threshold_value}–${t.threshold_value_secondary}`
        : `${t.threshold_value}`
      const origemLabel = `Gatilho: ${indicatorName} ${OP_LABEL[t.operator] || t.operator} ${limite}`

      // Ação no Plano de Ação (mesmo formato de "deliberação vira ação")
      let generatedActionId: string | null = null
      if (t.create_action_on_breach) {
        await ensureContainer()
        // Resolve nome do responsável (se houver)
        let respName = ''
        if (t.assignee_member_id) {
          const { data: m } = await admin.from('members').select('name').eq('id', t.assignee_member_id).maybeSingle()
          respName = m?.name || ''
        }
        const actionId = Date.now() + Math.floor(Math.random() * 1000)
        const action = {
          id: actionId,
          title: `Tratar gatilho: ${indicatorName}`,
          resps: respName ? [respName] : [], resp: respName, date: '',
          obs: `${origemLabel}. Valor observado: ${reading.value}${indicatorUnit ? ' ' + indicatorUnit : ''}${periodLabel ? ' (' + periodLabel + ')' : ''}.`,
          status: 'Pendente', priority: PRIORITY_BY_SEVERITY[t.severity] || 'Importante', fromTrigger: true,
        }
        containerAcoes = [...containerAcoes, action]
        generatedActionId = String(actionId)
        await admin.from('meetings').update({ acoes: containerAcoes }).eq('id', containerId)
        await admin.from('trigger_events').update({ generated_action_id: generatedActionId }).eq('id', ev.id)
      }

      // Alerta por e-mail (Resend) — responsável do gatilho, senão Administradores do cliente
      if (t.notify_on_breach) {
        try {
          let recipients: string[] = []
          if (t.assignee_member_id) {
            const { data: m } = await admin.from('members').select('email').eq('id', t.assignee_member_id).maybeSingle()
            if (m?.email) recipients = [m.email]
          }
          if (recipients.length === 0) {
            const { data: admins } = await admin.from('members').select('email').eq('client_id', cid).in('role', ['Administrador', 'SuperAdmin'])
            recipients = (admins || []).map((a: any) => a.email).filter(Boolean)
          }
          if (recipients.length > 0) {
            await sendAlertEmail(recipients, {
              indicatorName, triggerName: t.name, value: reading.value,
              unit: indicatorUnit, severity: t.severity, origem: origemLabel, period: periodLabel,
            })
          }
        } catch (_) { /* e-mail é best-effort, não derruba o disparo */ }
      }

      // Trilha de auditoria (audit_logs do GovCorp: username/action/details/client_id)
      await admin.from('audit_logs').insert({
        username: 'Sistema (Gatilho)',
        action: 'trigger_fired',
        details: `${origemLabel} — valor ${reading.value}${indicatorUnit ? ' ' + indicatorUnit : ''} [${t.severity === 'critical' ? 'crítico' : 'atenção'}]`,
        client_id: cid,
      })

      fired.push({ trigger_id: t.id, severity: t.severity, event_id: ev.id, action_id: generatedActionId })
    }

    return json({ evaluated: (breached ?? []).length, fired })
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500)
  }
})

async function sendAlertEmail(
  to: string[],
  p: { indicatorName: string; triggerName: string; value: number; unit: string; severity: string; origem: string; period: string },
) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY) return
  const color = p.severity === 'critical' ? '#b91c1c' : '#b45309'
  const sevLabel = p.severity === 'critical' ? 'CRÍTICO 🔴' : 'ATENÇÃO 🟡'
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
      <h2 style="color:${color};margin-bottom:4px">⚠ Gatilho de governança disparado</h2>
      <p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-top:0">${sevLabel}</p>
      <p>O indicador <b>${escapeHtml(p.indicatorName)}</b> rompeu o limite definido em <b>${escapeHtml(p.triggerName)}</b>.</p>
      <table style="border-collapse:collapse;font-size:14px;margin:12px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Valor observado</td><td style="padding:4px 0"><b>${escapeHtml(String(p.value))}${p.unit ? ' ' + escapeHtml(p.unit) : ''}</b></td></tr>
        ${p.period ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Competência</td><td style="padding:4px 0">${escapeHtml(p.period)}</td></tr>` : ''}
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Regra</td><td style="padding:4px 0">${escapeHtml(p.origem)}</td></tr>
      </table>
      <p style="color:#64748b;font-size:12px">Uma ação foi registrada no Plano de Ação do GovCorp para tratamento.</p>
    </div>`
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Governança INEPAD <conselho@inepadconsulting.com>',
      to,
      subject: `[GovCorp] Gatilho disparado: ${p.indicatorName}`,
      html,
    }),
  })
}
