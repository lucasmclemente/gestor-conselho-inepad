import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// E-mail específico do perfil Controller: envia SOMENTE o plano de ação dele.
// Nunca inclui a ata nem link de aprovação (diferente de send-minute-notification).
// Disparado na publicação da ata, em paralelo ao e-mail dos conselheiros.

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

const escapeHtml = (str: string): string =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const role = (user.app_metadata as any)?.role ?? ''
  const homeClient = (user.app_metadata as any)?.client_id ?? null
  const secClients: string[] = Array.isArray((user.app_metadata as any)?.secretary_clients) ? (user.app_metadata as any).secretary_clients : []
  if (!['Administrador', 'Secretário', 'SuperAdmin'].includes(role)) return json({ error: 'Sem permissão.' }, 403)

  try {
    const { meetingTitle, meetingId, recipients, appOrigin } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const origin = (typeof appOrigin === 'string' && /^https?:\/\//.test(appOrigin)) ? appOrigin.replace(/\/$/, '') : 'https://conselho.inepadconsulting.com'
    if (!meetingId) return json({ error: 'Parâmetro ausente (meetingId).' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: meeting } = await admin.from('meetings').select('client_id, participants').eq('id', meetingId).maybeSingle()
    if (!meeting) return json({ error: 'Reunião não encontrada.' }, 404)
    if (role !== 'SuperAdmin' && meeting.client_id !== homeClient && !secClients.includes(meeting.client_id)) {
      return json({ error: 'Sem permissão para esta empresa.' }, 403)
    }

    // Só membros Controller internos deste cliente podem receber (defesa em profundidade)
    const { data: members } = await admin.from('members').select('email, role').eq('client_id', meeting.client_id)
    const controllerEmails = new Set<string>((members || []).filter((m: any) => m.role === 'Controller').map((m: any) => String(m.email || '').trim().toLowerCase()))
    const externalEmails = new Set<string>((meeting.participants || []).filter((p: any) => p?.isExternal && p?.email).map((p: any) => String(p.email).trim().toLowerCase()))

    const safe = (recipients || []).filter((u: any) => {
      const e = String(u?.email || '').trim().toLowerCase()
      return e && controllerEmails.has(e) && !externalEmails.has(e)
    })

    const emailPromises = safe.map((u: any) => {
      const actions = Array.isArray(u.pendingActions) ? u.pendingActions : []
      const actionsHtml = actions.length > 0
        ? actions.map((pa: any) => `
            <div style="background: #fff; border-left: 4px solid #b45309; padding: 12px; margin-bottom: 10px; border-radius: 6px; border: 1px solid #fed7aa;">
              <p style="margin: 0; font-size: 13px; font-weight: bold; color: #1e293b;">${escapeHtml(pa.title)}</p>
              <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;"><strong>Origem:</strong> ${escapeHtml(pa.meetingTitle || meetingTitle || '')} | <strong>Prazo:</strong> ${escapeHtml(pa.date || 'S/D')}${pa.status ? ` | <strong>Status:</strong> ${escapeHtml(pa.status)}` : ''}</p>
              ${pa.obs ? `<p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8; font-style: italic;">Obs: ${escapeHtml(pa.obs)}</p>` : ''}
            </div>`).join('')
        : '<div style="padding: 15px; background: #ecfdf5; border-radius: 8px; border: 1px solid #d1fae5; text-align: center;"><p style="margin: 0; font-size: 13px; color: #059669; font-weight: bold;">✅ Você não possui pendências em aberto.</p></div>'

      return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'Governança INEPAD <conselho@inepadconsulting.com>',
          to: u.email,
          subject: `SEU PLANO DE AÇÃO: ${String(meetingTitle || 'Reunião').replace(/[\r\n\t]+/g, ' ').trim()}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
              <div style="background: #0f172a; padding: 20px; text-align: center;">
                <img src="https://conselho.inepadconsulting.com/boardplan-logo-email.png" style="height: 35px;" />
              </div>
              <div style="padding: 30px; color: #1e293b;">
                <p style="font-size: 16px;">Olá, <strong>${escapeHtml(u.name || '')}</strong>,</p>
                <p style="font-size: 14px; line-height: 1.5;">Segue o seu plano de ação referente à reunião <strong>${escapeHtml(meetingTitle || '')}</strong>.</p>
                <div style="margin-top: 20px; padding: 20px; background: #fff7ed; border-radius: 10px; border: 1px solid #ffedd5;">
                  <h4 style="margin: 0 0 15px; color: #9a3412; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">📋 Suas Ações</h4>
                  ${actionsHtml}
                </div>
                <div style="text-align: center; margin-top: 35px;">
                  <a href="${origin}" style="background: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">Acessar o Portal</a>
                </div>
              </div>
            </div>
          `,
        }),
      })
    })

    const results = await Promise.allSettled(emailPromises)
    const sent = results.filter((r) => r.status === 'fulfilled').length
    return json({ ok: true, sent, skipped: (recipients || []).length - safe.length })
  } catch (error: any) {
    return json({ error: error?.message || 'Erro inesperado.' }, 400)
  }
})
