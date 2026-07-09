import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

  try {
    const { meetingData, recipients, organizer: organizerInput } = await req.json()
    if (!Array.isArray(recipients) || recipients.length === 0) return json({ error: 'Sem destinatários.' }, 400)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    const organizer = organizerInput?.email
      ? { name: organizerInput.name || organizerInput.email, email: organizerInput.email }
      : { name: 'Governança INEPAD', email: 'conselho@inepadconsulting.com' }

    const materiais = Array.isArray(meetingData?.materiais) ? meetingData.materiais : []
    const materiaisHtml = materiais.length > 0
      ? materiais.map((m: any, i: number) => `
          <div style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px;">
            <span style="color: #64748b; font-weight: bold;">${i + 1}.</span>
            <a href="${safeUrl(m.url)}" style="color: #b45309; text-decoration: underline; font-weight: bold;">${escapeHtml(m.name)}</a>
          </div>`).join('')
      : '<p style="color: #94a3b8; font-style: italic;">Nenhum material anexado.</p>'

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0f172a; padding: 30px; text-align: center;">
          <img src="https://jrtrrubtjbinnddqdbta.supabase.co/storage/v1/object/public/meeting-files/logo-sidebar.jpg" style="height: 40px;" />
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
          ${materiaisHtml}

          <div style="text-align: center; margin-top: 35px;">
            <a href="https://conselho.inepadconsulting.com" style="background: #b45309; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Acessar Portal de Governança</a>
          </div>
          <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 20px;">Recomendamos a leitura prévia dos materiais para a reunião.</p>
        </div>
      </div>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'Governança INEPAD <conselho@inepadconsulting.com>',
        to: recipients,
        reply_to: organizer.email,
        subject: `MATERIAIS DISPONÍVEIS: ${meetingData?.title || 'Reunião do Conselho'}`,
        html,
      }),
    })
    const data = await res.json()
    return json({ success: true, sent: recipients.length, resend: data })
  } catch (error: any) {
    return json({ error: error.message }, 400)
  }
})
