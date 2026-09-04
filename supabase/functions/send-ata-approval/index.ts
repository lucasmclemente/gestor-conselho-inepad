import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { signToken } from "../_shared/votetoken.ts"

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com', 'http://localhost:3000']
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const preview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || preview ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Vary': 'Origin' }
}
const escapeHtml = (s: string): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
const safeUrl = (url: string): string => /^https?:\/\//i.test(url ?? '') ? url : '#'

function buildEmail(name: string, meetingTitle: string, ataName: string, ataUrl: string, approveUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#0f172a;padding:24px 30px;text-align:center;">
        <img src="https://conselho.inepadconsulting.com/boardplan-logo-email.png" alt="Boardplan" style="height:32px;margin-bottom:10px;" />
        <p style="margin:0;color:#f59e0b;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;">Aprovação de Ata • Conselho</p>
      </div>
      <div style="padding:32px;">
        <p style="font-size:16px;color:#1e293b;margin:0 0 8px;">Olá, <strong>${escapeHtml(name)}</strong></p>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.6;">A ata da reunião <strong>${escapeHtml(meetingTitle)}</strong> foi publicada e depende da sua aprovação. Leia o documento e registre sua manifestação — é rápido e não precisa de senha.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #b45309;border-radius:8px;padding:16px;margin-bottom:20px;text-align:center;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#1e293b;font-style:italic;">${escapeHtml(ataName)}</p>
          <a href="${safeUrl(ataUrl)}" style="color:#b45309;font-size:12px;font-weight:bold;text-decoration:none;">⬇ Ver / baixar a ata</a>
        </div>
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${approveUrl}" style="background:#b45309;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px;display:inline-block;">✍️ Registrar minha aprovação</a>
        </div>
        <p style="font-size:10px;color:#94a3b8;text-align:center;line-height:1.6;">Este link é de uso individual e intransferível, e expira por segurança.<br/>Boardplan • INEPAD Governança e Sucessão</p>
      </div>
    </div>
  `
}

serve(async (req) => {
  const c = cors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: c })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...c, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  const authed = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: authErr } = await authed.auth.getUser()
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)
  const role = (user.app_metadata as any)?.role
  const clientId = (user.app_metadata as any)?.client_id
  const isSuper = role === 'SuperAdmin'
  if (!['Administrador', 'Secretário', 'SuperAdmin'].includes(role)) return json({ error: 'Apenas Administrador/Secretário podem solicitar aprovação.' }, 403)

  try {
    const { meetingId, ataId, appOrigin, onlyPending } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!meetingId) return json({ error: 'Parâmetros ausentes.' }, 400)

    const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', SECRET, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: meeting, error: mErr } = await admin.from('meetings').select('id, title, client_id, atas, participants').eq('id', meetingId).maybeSingle()
    if (mErr) throw new Error(mErr.message)
    if (!meeting) return json({ error: 'Reunião não encontrada.' }, 404)
    if (!isSuper && meeting.client_id !== clientId) return json({ error: 'Sem permissão.' }, 403)

    const atas = [...(meeting.atas || [])]
    if (atas.length === 0) return json({ error: 'Não há ata publicada nesta reunião.' }, 400)
    let idx = (ataId != null) ? atas.findIndex((a: any) => a.id === ataId) : atas.length - 1
    if (idx < 0) idx = atas.length - 1
    let ata = { ...atas[idx] }
    if (ata.id == null) ata.id = Date.now()

    // Não envia se as aprovações já foram encerradas
    if (ata.approvalClosed) return json({ error: 'As aprovações desta ata foram encerradas. Reabra para enviar de novo.' }, 400)

    // Aprovadores = participantes internos (não externos) com e-mail
    const internos = (meeting.participants || []).filter((p: any) => !p.isExternal && p?.email && p?.name)
    if (internos.length === 0) return json({ error: 'A reunião não tem conselheiros internos com e-mail.' }, 400)

    ata.approvals = ata.approvals || {}
    // Lembrete só para pendentes: mantém a lista de aprovadores e envia apenas aos que ainda não responderam
    const isReminder = onlyPending === true && Array.isArray(ata.approvers) && ata.approvers.length > 0
    let recipients: any[]
    if (isReminder) {
      const pend = new Set((ata.approvers as string[]).filter((n: string) => !ata.approvals[n]))
      recipients = internos.filter((p: any) => pend.has(p.name))
    } else {
      ata.approvers = internos.map((p: any) => p.name)
      recipients = internos
    }
    ata.approvalSentAt = new Date().toISOString()
    atas[idx] = ata
    await admin.from('meetings').update({ atas }).eq('id', meeting.id)

    if (recipients.length === 0) return json({ success: true, sent: 0, skipped: [], ataId: ata.id, approvers: ata.approvers, note: 'Nenhum conselheiro pendente.' })

    const origin = (typeof appOrigin === 'string' && /^https?:\/\//.test(appOrigin)) ? appOrigin.replace(/\/$/, '') : 'https://conselho.inepadconsulting.com'
    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000

    let sent = 0
    const skipped: string[] = []
    for (const p of recipients) {
      const token = await signToken({ m: meetingId, a: ata.id, v: p.name, e: p.email, exp, k: 'ata' })
      const approveUrl = `${origin}/?atatoken=${encodeURIComponent(token)}`
      if (RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'Governança INEPAD <conselho@inepadconsulting.com>',
            to: p.email,
            subject: `✍️ Aprovação da ata: ${String(meeting.title || 'Reunião do Conselho').replace(/[\r\n\t]+/g, ' ').trim().substring(0, 60)}`,
            html: buildEmail(p.name, meeting.title || 'Reunião do Conselho', ata.name || 'Ata da reunião', ata.url || '#', approveUrl),
          }),
        })
        sent++
      } else { skipped.push(p.name) }
    }

    return json({ success: true, sent, skipped, ataId: ata.id, approvers: ata.approvers })
  } catch (e: any) {
    return json({ error: e.message }, 400)
  }
})
