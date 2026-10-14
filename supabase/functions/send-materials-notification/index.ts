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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
const escapeHtml = (s: any) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const safeUrl = (url: any) => /^https?:\/\//i.test(String(url ?? '')) ? String(url) : '#'

serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  // Exige JWT válido (quem sobe materiais é Adm/Secretário do cliente)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  // Autorização: só Adm/Sec/Super, e apenas para reuniões do próprio tenant
  const role = (user.app_metadata as any)?.role ?? ''
  const homeClient = (user.app_metadata as any)?.client_id ?? null
  const secClients: string[] = Array.isArray((user.app_metadata as any)?.secretary_clients) ? (user.app_metadata as any).secretary_clients : []
  if (!['Administrador', 'Secretário', 'SuperAdmin'].includes(role)) return json({ error: 'Sem permissão.' }, 403)

  try {
    const { meetingData, recipients, organizer: organizerInput } = await req.json()
    if (!Array.isArray(recipients) || recipients.length === 0) return json({ error: 'Sem destinatários.' }, 400)
    const cid = meetingData?.client_id
    if (role !== 'SuperAdmin' && (!cid || (cid !== homeClient && !secClients.includes(cid)))) return json({ error: 'Sem permissão para esta empresa.' }, 403)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    const organizer = organizerInput?.email
      ? { name: organizerInput.name || organizerInput.email, email: organizerInput.email }
      : { name: 'Governança INEPAD', email: 'conselho@inepadconsulting.com' }

    const materiais = Array.isArray(meetingData?.materiais) ? meetingData.materiais : []
    const URLV = Deno.env.get('SUPABASE_URL') ?? ''
    const cid2 = meetingData?.client_id
    const meetingId = meetingData?.id
    const trackExp = Date.now() + 30 * 24 * 60 * 60 * 1000
    // nome por e-mail (para identificar quem abre, nos links rastreados)
    const nameByEmail = new Map<string, string>()
    for (const p of (meetingData?.participants || [])) { if (p?.email) nameByEmail.set(String(p.email).toLowerCase(), p.name || '') }

    // Monta a lista de materiais com LINKS RASTREADOS por destinatário (track-material)
    const materiaisHtmlFor = async (toEmail: string): Promise<string> => {
      if (materiais.length === 0) return '<p style="color: #94a3b8; font-style: italic;">Nenhum material anexado.</p>'
      const name = nameByEmail.get(String(toEmail).toLowerCase()) || ''
      const rows: string[] = []
      for (let i = 0; i < materiais.length; i++) {
        const m = materiais[i]
        let href = safeUrl(String(m?.url || ''))
        if (meetingId && cid2) {
          const token = await signToken({ k: 'matopen', c: cid2, m: meetingId, n: m?.name, u: name, e: toEmail, exp: trackExp })
          href = `${URLV}/functions/v1/track-material?t=${encodeURIComponent(token)}`
        }
        rows.push(`
          <div style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px;">
            <span style="color: #64748b; font-weight: bold;">${i + 1}.</span>
            <a href="${href}" style="color: #b45309; text-decoration: underline; font-weight: bold;">${escapeHtml(m.name)}</a>
          </div>`)
      }
      return rows.join('')
    }

    const htmlFor = (matsHtml: string) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0f172a; padding: 30px; text-align: center;">
          <img src="https://conselho.inepadconsulting.com/boardplan-logo-email.png" style="height: 40px;" />
        </div>
        <div style="padding: 40px; color: #1e293b;">
          <h2 style="color: #b45309; font-style: italic; margin-bottom: 5px;">Materiais da Reunião</h2>
          <p style="font-size: 16px; font-weight: bold; margin-top: 0;">${escapeHtml(meetingData?.title || 'Reunião do Conselho')}</p>
          <p style="font-size: 13px; color: #64748b;">Os materiais de apoio (subsídios) para esta reunião já estão disponíveis.</p>

          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <small style="color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: bold;">Data e Hora</small>
            <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 14px;">${escapeHtml(meetingData?.date || 'S/D')} às ${escapeHtml(meetingData?.time || 'S/H')}</p>
          </div>

          <h4 style="text-transform: uppercase; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px;">Documentos de Apoio</h4>
          ${matsHtml}

          <div style="text-align: center; margin-top: 35px;">
            <a href="https://conselho.inepadconsulting.com" style="background: #b45309; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Acessar Portal de Governança</a>
          </div>
          <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 20px;">Recomendamos a leitura prévia dos materiais para a reunião.</p>
        </div>
      </div>`

    // Envio INDIVIDUAL (links rastreados identificam quem abre)
    const subject = `MATERIAIS DISPONÍVEIS: ${String(meetingData?.title || 'Reunião do Conselho').replace(/[\r\n\t]+/g, ' ').trim()}`
    const sends = (recipients as string[]).map(async (to: string) => {
      const matsHtml = await materiaisHtmlFor(to)
      return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: 'Governança INEPAD <conselho@inepadconsulting.com>', to, reply_to: organizer.email, subject, html: htmlFor(matsHtml) }),
      })
    })
    const results = await Promise.allSettled(sends)
    const sent = results.filter((r) => r.status === 'fulfilled').length
    return json({ success: true, sent })
  } catch (error: any) {
    return json({ error: error.message }, 400)
  }
})
