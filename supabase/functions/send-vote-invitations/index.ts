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
    'Vary': 'Origin',
  }
}

const escapeHtml = (s: string): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')

function buildVoteEmail(name: string, title: string, voteUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#0f172a;padding:24px 30px;text-align:center;">
        <img src="https://jrtrrubtjbinnddqdbta.supabase.co/storage/v1/object/public/meeting-files/logo-sidebar.jpg" alt="INEPAD" style="height:32px;margin-bottom:10px;" />
        <p style="margin:0;color:#f59e0b;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;">Votação de Deliberação • Conselho</p>
      </div>
      <div style="padding:32px;">
        <p style="font-size:16px;color:#1e293b;margin:0 0 8px;">Olá, <strong>${escapeHtml(name)}</strong></p>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.6;">Você foi convidado a registrar seu voto na deliberação abaixo. Clique no botão para acessar a plataforma com segurança e votar.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #b45309;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;font-weight:bold;color:#1e293b;font-style:italic;">"${escapeHtml(title)}"</p>
        </div>
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${voteUrl}" style="background:#b45309;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px;display:inline-block;">🗳️ Acessar e Votar</a>
        </div>
        <p style="font-size:10px;color:#94a3b8;text-align:center;line-height:1.6;">Este link é de uso individual e intransferível, e expira por segurança.<br/>GovCorp • INEPAD Consultoria</p>
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

  const role = (user.user_metadata as any)?.role
  const clientId = (user.user_metadata as any)?.client_id
  const isSuper = role === 'SuperAdmin'
  if (!['Administrador', 'Secretário', 'SuperAdmin'].includes(role)) {
    return new Response(JSON.stringify({ error: 'Apenas Administrador/Secretário podem enviar convites de voto.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const { meetingId, delibId, appOrigin } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!meetingId || delibId == null) return new Response(JSON.stringify({ error: 'Parâmetros ausentes.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: meeting, error: mErr } = await admin.from('meetings').select('id, client_id, deliberacoes').eq('id', meetingId).maybeSingle()
    if (mErr) throw new Error(mErr.message)
    if (!meeting) return new Response(JSON.stringify({ error: 'Deliberação não encontrada.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (!isSuper && meeting.client_id !== clientId) return new Response(JSON.stringify({ error: 'Sem permissão.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const delib = (meeting.deliberacoes || []).find((d: any) => d.id === delibId)
    if (!delib) return new Response(JSON.stringify({ error: 'Deliberação não encontrada.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const voterNames: string[] = delib.voters || []
    if (voterNames.length === 0) return new Response(JSON.stringify({ error: 'A deliberação não tem votantes.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Mapeia nomes dos votantes -> e-mails dos membros
    const { data: members } = await admin.from('members').select('name, email').eq('client_id', meeting.client_id)
    const emailByName = new Map((members || []).map((m: any) => [m.name, m.email]))

    const origin = (typeof appOrigin === 'string' && /^https?:\/\//.test(appOrigin)) ? appOrigin.replace(/\/$/, '') : 'https://conselho.inepadconsulting.com'
    const redirectTo = `${origin}/?vote=${delibId}`

    let sent = 0
    const skipped: string[] = []
    for (const name of voterNames) {
      const email = emailByName.get(name)
      if (!email) { skipped.push(name); continue }
      // Gera o magic link (login sem senha) que redireciona direto para a votação
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink', email, options: { redirectTo },
      })
      const actionLink = (linkData as any)?.properties?.action_link
      if (linkErr || !actionLink) { skipped.push(name); continue }

      if (RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'Governança INEPAD <conselho@inepadconsulting.com>',
            to: email,
            subject: `🗳️ Sua votação: ${delib.title?.substring(0, 60) || 'Deliberação do Conselho'}`,
            html: buildVoteEmail(name, delib.title || 'Deliberação do Conselho', actionLink),
          }),
        })
        sent++
      }
    }

    return new Response(JSON.stringify({ success: true, sent, skipped }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
