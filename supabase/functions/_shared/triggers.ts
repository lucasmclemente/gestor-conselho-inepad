// Lógica compartilhada de disparo de gatilhos — usada por evaluate-triggers (no
// registro de leitura) e reevaluate-triggers (cron). Mantém a regra determinística
// no banco (RPC breached_triggers_for_reading) e só faz os efeitos colaterais.

export const escapeHtml = (s: any) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const PRIORITY_BY_SEVERITY: Record<string, string> = { attention: 'Importante', critical: 'Urgente' }
const OP_LABEL: Record<string, string> = { gt: '>', gte: '≥', lt: '<', lte: '≤', outside: 'fora de', inside: 'dentro de' }

const RESEND_FROM = 'Governança INEPAD <conselho@inepadconsulting.com>'

export interface ReadingCtx {
  id: string
  client_id: string
  value: number
  period: string | null
  indicatorName: string
  indicatorUnit: string
  indicator_id?: string
}

// Dispara alerta/ação/e-mail quando a leitura NÃO atinge a meta da competência.
// Idempotente (unique parcial meta por indicador+leitura). Fonte única desde que
// os gatilhos manuais foram aposentados.
export async function fireForReadingMeta(admin: any, reading: ReadingCtx): Promise<{ evaluated: number; fired: any[] }> {
  const cid = reading.client_id
  const indId = reading.indicator_id
  if (!indId) return { evaluated: 0, fired: [] }
  const periodLabel = reading.period ? new Date(reading.period + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) : ''

  const { data: tgt } = await admin.from('indicator_targets').select('target_value').eq('indicator_id', indId).eq('period', reading.period).maybeSingle()
  if (!tgt) return { evaluated: 0, fired: [] } // sem meta → sem alerta
  const meta = Number(tgt.target_value)
  const { data: ind } = await admin.from('indicators').select('direction, responsible_member_id, name, unit').eq('id', indId).maybeSingle()
  const higher = (ind?.direction ?? 'higher_is_better') !== 'lower_is_better'
  const v = Number(reading.value)
  const ach = higher ? (meta === 0 ? (v >= 0 ? 1 : 0) : v / meta) : (v === 0 ? 2 : meta / v)
  const severity = ach >= 1 ? null : ach >= 0.8 ? 'attention' : 'critical'
  if (!severity) return { evaluated: 1, fired: [] } // meta atingida

  const { data: ev, error: evErr } = await admin
    .from('trigger_events')
    .insert({ client_id: cid, trigger_id: null, indicator_id: indId, indicator_reading_id: reading.id, observed_value: v, severity, status: 'open', source: 'meta' })
    .select('id').single()
  if (evErr || !ev) return { evaluated: 1, fired: [] } // já existia → idempotente

  const iName = reading.indicatorName || ind?.name || 'Indicador'
  const iUnit = reading.indicatorUnit || ind?.unit || ''
  const origemLabel = `Meta não atingida: ${iName} (realizado ${v}${iUnit ? ' ' + iUnit : ''} × meta ${meta}${iUnit ? ' ' + iUnit : ''})`

  const container = await ensureContainer(admin, cid)
  let respName = ''
  if (ind?.responsible_member_id) {
    const { data: m } = await admin.from('members').select('name').eq('id', ind.responsible_member_id).maybeSingle()
    respName = m?.name || ''
  }
  const actionId = Date.now() + Math.floor(Math.random() * 1000)
  const action = {
    id: actionId, title: `Tratar meta não atingida: ${iName}`,
    resps: respName ? [respName] : [], resp: respName, date: '',
    obs: `${origemLabel}${periodLabel ? ' — ' + periodLabel : ''}.`,
    status: 'Pendente', priority: PRIORITY_BY_SEVERITY[severity] || 'Importante', fromTrigger: true,
  }
  await admin.from('meetings').update({ acoes: [...container.acoes, action] }).eq('id', container.id)
  const generatedActionId = String(actionId)
  await admin.from('trigger_events').update({ generated_action_id: generatedActionId }).eq('id', ev.id)

  try {
    let recipients: string[] = []
    if (ind?.responsible_member_id) {
      const { data: m } = await admin.from('members').select('email').eq('id', ind.responsible_member_id).maybeSingle()
      if (m?.email) recipients = [m.email]
    }
    if (recipients.length === 0) {
      const { data: admins } = await admin.from('members').select('email').eq('client_id', cid).in('role', ['Administrador', 'SuperAdmin'])
      recipients = (admins || []).map((a: any) => a.email).filter(Boolean)
    }
    if (recipients.length > 0) {
      await sendAlertEmail(recipients, { indicatorName: iName, triggerName: 'Meta do mês', value: v, unit: iUnit, severity, origem: origemLabel, period: periodLabel })
    }
  } catch (_) { /* e-mail best-effort */ }

  await admin.from('audit_logs').insert({
    username: 'Sistema (Meta)', action: 'meta_alert',
    details: `${origemLabel} [${severity === 'critical' ? 'crítico' : 'atenção'}]`,
    client_id: cid,
  })

  return { evaluated: 1, fired: [{ indicator_id: indId, severity, event_id: ev.id, action_id: generatedActionId }] }
}

async function ensureContainer(admin: any, cid: string): Promise<{ id: string; acoes: any[] }> {
  const { data: c } = await admin.from('meetings').select('id, acoes').eq('client_id', cid).eq('type', 'Indicadores').maybeSingle()
  if (c) return { id: c.id, acoes: Array.isArray(c.acoes) ? c.acoes : [] }
  const { data: created, error } = await admin.from('meetings').insert([{
    title: 'Gatilhos de Indicadores', status: 'Indicadores', type: 'Indicadores',
    date: null, time: null, link: '', address: '',
    participants: [], pautas: [], materiais: [], deliberacoes: [], acoes: [], atas: [],
    client_id: cid,
  }]).select('id, acoes').single()
  if (error) throw new Error('container: ' + error.message)
  return { id: created.id, acoes: [] }
}

// Avalia e dispara os gatilhos rompidos por uma leitura. Idempotente (unique trigger+reading).
export async function fireForReading(admin: any, reading: ReadingCtx): Promise<{ evaluated: number; fired: any[] }> {
  const cid = reading.client_id
  const periodLabel = reading.period ? new Date(reading.period + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) : ''
  const { data: breached, error } = await admin.rpc('breached_triggers_for_reading', { p_reading_id: reading.id })
  if (error) throw new Error(error.message)

  const fired: any[] = []
  for (const t of (breached ?? [])) {
    const { data: ev, error: evErr } = await admin
      .from('trigger_events')
      .insert({ client_id: cid, trigger_id: t.id, indicator_reading_id: reading.id, observed_value: reading.value, severity: t.severity, status: 'open' })
      .select('id').single()
    if (evErr || !ev) continue // já existia → idempotente

    const limite = (t.operator === 'outside' || t.operator === 'inside')
      ? `${t.threshold_value}–${t.threshold_value_secondary}` : `${t.threshold_value}`
    const origemLabel = `Gatilho: ${reading.indicatorName} ${OP_LABEL[t.operator] || t.operator} ${limite}`

    let generatedActionId: string | null = null
    if (t.create_action_on_breach) {
      const container = await ensureContainer(admin, cid)
      let respName = ''
      if (t.assignee_member_id) {
        const { data: m } = await admin.from('members').select('name').eq('id', t.assignee_member_id).maybeSingle()
        respName = m?.name || ''
      }
      const actionId = Date.now() + Math.floor(Math.random() * 1000)
      const action = {
        id: actionId, title: `Tratar gatilho: ${reading.indicatorName}`,
        resps: respName ? [respName] : [], resp: respName, date: '',
        obs: `${origemLabel} [${t.scenario || 'Base'}]. Valor observado: ${reading.value}${reading.indicatorUnit ? ' ' + reading.indicatorUnit : ''}${periodLabel ? ' (' + periodLabel + ')' : ''}.`,
        status: 'Pendente', priority: PRIORITY_BY_SEVERITY[t.severity] || 'Importante', fromTrigger: true,
      }
      const acoes = [...container.acoes, action]
      generatedActionId = String(actionId)
      await admin.from('meetings').update({ acoes }).eq('id', container.id)
      await admin.from('trigger_events').update({ generated_action_id: generatedActionId }).eq('id', ev.id)
    }

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
          await sendAlertEmail(recipients, { indicatorName: reading.indicatorName, triggerName: t.name, value: reading.value, unit: reading.indicatorUnit, severity: t.severity, origem: origemLabel, period: periodLabel })
        }
      } catch (_) { /* e-mail best-effort */ }
    }

    await admin.from('audit_logs').insert({
      username: 'Sistema (Gatilho)', action: 'trigger_fired',
      details: `${origemLabel} — valor ${reading.value}${reading.indicatorUnit ? ' ' + reading.indicatorUnit : ''} [${t.severity === 'critical' ? 'crítico' : 'atenção'}]`,
      client_id: cid,
    })
    fired.push({ trigger_id: t.id, severity: t.severity, event_id: ev.id, action_id: generatedActionId })
  }
  return { evaluated: (breached ?? []).length, fired }
}

export async function sendAlertEmail(to: string[], p: { indicatorName: string; triggerName: string; value: number; unit: string; severity: string; origem: string; period: string }) {
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
    body: JSON.stringify({ from: RESEND_FROM, to, subject: `[GovCorp] Gatilho disparado: ${p.indicatorName}`, html }),
  })
}

// Lembrete-resumo dos alertas ainda abertos (cron)
export async function sendDigestEmail(to: string[], clientName: string, alerts: any[]) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY || to.length === 0 || alerts.length === 0) return
  const linhas = alerts.map((a: any) => {
    const crit = a.severity === 'critical'
    const ind = a.triggers?.indicators?.name || 'Indicador'
    const unit = a.triggers?.indicators?.unit || ''
    const trig = a.triggers?.name || ''
    return `<tr>
      <td style="padding:6px 12px 6px 0">${crit ? '🔴' : '🟡'}</td>
      <td style="padding:6px 12px 6px 0"><b>${escapeHtml(ind)}</b> ${trig ? '— ' + escapeHtml(trig) : ''}</td>
      <td style="padding:6px 0">${escapeHtml(String(a.observed_value))}${unit ? ' ' + escapeHtml(unit) : ''}</td>
    </tr>`
  }).join('')
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a">
      <h2 style="color:#b45309;margin-bottom:4px">🔔 Indicadores em alerta — ${escapeHtml(clientName)}</h2>
      <p style="color:#64748b;font-size:13px">Há <b>${alerts.length}</b> gatilho(s) ainda em aberto. Resumo:</p>
      <table style="border-collapse:collapse;font-size:14px;margin:12px 0">${linhas}</table>
      <p style="color:#94a3b8;font-size:12px">Acompanhe e resolva no menu Indicadores do GovCorp.</p>
    </div>`
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to, subject: `[GovCorp] Indicadores em alerta — ${clientName} (${alerts.length})`, html }),
  })
}
