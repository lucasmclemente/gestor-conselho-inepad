import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { signToken } from "../_shared/votetoken.ts"

const ALLOWED_ORIGINS = [
  'https://conselho.inepadconsulting.com',
  'http://localhost:3000',
]

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const isVercelPreview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || isVercelPreview ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

const escapeHtml = (s: string): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')

function buildVoteEmail(name: string, title: string, voteUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#0f172a;padding:24px 30px;text-align:center;">
        <img src="https://conselho.inepadconsulting.com/boardplan-logo-email.png" alt="Boardplan" style="height:32px;margin-bottom:10px;" />
        <p style="margin:0;color:#f59e0b;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;">Votação de Deliberação • Conselho</p>
      </div>
      <div style="padding:32px;">
        <p style="font-size:16px;color:#1e293b;margin:0 0 8px;">Olá, <strong>${escapeHtml(name)}</strong></p>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.6;">Você foi convidado a registrar seu voto na deliberação abaixo. Clique no botão para abrir a página de votação e registrar seu voto — é rápido e não precisa de senha.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #b45309;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;font-weight:bold;color:#1e293b;font-style:italic;">"${escapeHtml(title)}"</p>
        </div>
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${voteUrl}" style="background:#b45309;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px;display:inline-block;">🗳️ Registrar meu voto</a>
        </div>
        <p style="font-size:10px;color:#94a3b8;text-align:center;line-height:1.6;">Este link é de uso individual e intransferível, e expira por segurança.<br/>Boardplan • INEPAD Governança e Sucessão</p>
      </div>
    </div>
  `
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const role = (user.app_metadata as any)?.role
  const clientId = (user.app_metadata as any)?.client_id
  const isSuper = role === 'SuperAdmin'
  if (!['Administrador', 'Secretário', 'SuperAdmin'].includes(role)) {
    return new Response(JSON.stringify({ error: 'Apenas Administrador/Secretário podem enviar convites de voto.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const { meetingId, delibId, delibIndex, appOrigin } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!meetingId || (delibId == null && delibIndex == null)) return new Response(JSON.stringify({ error: 'Parâmetros ausentes.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: meeting, error: mErr } = await admin.from('meetings').select('id, client_id, deliberacoes, participants').eq('id', meetingId).maybeSingle()
    if (mErr) throw new Error(mErr.message)
    if (!meeting) return new Response(JSON.stringify({ error: 'Deliberação não encontrada.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (!isSuper && meeting.client_id !== clientId) return new Response(JSON.stringify({ error: 'Sem permissão.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const delibs = meeting.deliberacoes || []
    const delib = (delibId != null) ? delibs.find((d: any) => d.id === delibId) : delibs[delibIndex]
    if (!delib) return new Response(JSON.stringify({ error: 'Deliberação não encontrada.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const voterNames: string[] = delib.voters || []
    if (voterNames.length === 0) return new Response(JSON.stringify({ error: 'A deliberação não tem votantes.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Mapeia nomes dos votantes -> e-mails. Primeiro pelos participantes da reunião
    // (que já guardam o e-mail), depois pela tabela members do cliente como reforço.
    const emailByName = new Map<string, string>()
    for (const p of (meeting.participants || [])) { if (p?.name && p?.email) emailByName.set(p.name, p.email) }
    const { data: members } = await admin.from('members').select('name, email').eq('client_id', meeting.client_id)
    for (const m of (members || [])) { if (m?.name && m?.email && !emailByName.has(m.name)) emailByName.set(m.name, m.email) }

    // Voto direto por e-mail: link com token assinado para a página de votação DENTRO do app
    const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const origin = (typeof appOrigin === 'string' && /^https?:\/\//.test(appOrigin)) ? appOrigin.replace(/\/$/, '') : 'https://conselho.inepadconsulting.com'
    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000 // token válido por 7 dias

    // O assunto do e-mail NÃO pode conter quebra de linha/tab (Resend rejeita com HTTP 422).
    // Títulos de deliberação às vezes vêm com \n colado — normaliza para espaço.
    const cleanTitle = (String(delib.title || 'Deliberação do Conselho').replace(/[\r\n\t]+/g, ' ').trim()) || 'Deliberação do Conselho'

    let sent = 0
    const skipped: string[] = []
    const failed: string[] = []
    for (const name of voterNames) {
      const email = emailByName.get(name)
      if (!email) { skipped.push(name); continue }
      const tokenPayload: Record<string, unknown> = { m: meetingId, v: name, e: email, exp }
      if (delibId != null) tokenPayload.d = delibId; else tokenPayload.di = delibIndex
      const token = await signToken(tokenPayload)
      const voteUrl = `${origin}/?votetoken=${encodeURIComponent(token)}`

      if (RESEND_API_KEY) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'Governança INEPAD <conselho@inepadconsulting.com>',
            to: email,
            subject: `🗳️ Sua votação: ${cleanTitle.substring(0, 60)}`,
            html: buildVoteEmail(name, cleanTitle, voteUrl),
          }),
        })
        if (res.ok) { sent++ }
        else {
          const body = await res.text().catch(() => '')
          console.error('[send-vote-invitations] Resend recusou', res.status, email, body.slice(0, 300))
          failed.push(`${name} (HTTP ${res.status})`)
        }
      } else { skipped.push(name) }
    }

    return new Response(JSON.stringify({ success: true, sent, skipped, failed }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
