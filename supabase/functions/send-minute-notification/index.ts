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

const escapeHtml = (str: string): string =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const safeUrl = (url: string): string =>
  /^https?:\/\//i.test(url ?? '') ? url : '#'

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Verifica autenticação — rejeita requisições sem JWT válido
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Autorização: só Adm/Sec/Super; o tenant é validado após carregar a reunião
  const role = (user.app_metadata as any)?.role ?? ''
  const homeClient = (user.app_metadata as any)?.client_id ?? null
  const secClients: string[] = Array.isArray((user.app_metadata as any)?.secretary_clients) ? (user.app_metadata as any).secretary_clients : []
  if (!['Administrador', 'Secretário', 'SuperAdmin'].includes(role)) {
    return new Response(JSON.stringify({ error: 'Sem permissão.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const { meetingTitle, minuteName, minuteUrl, actions, pendingSummary, meetingId, ataId, appOrigin } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const origin = (typeof appOrigin === 'string' && /^https?:\/\//.test(appOrigin)) ? appOrigin.replace(/\/$/, '') : 'https://conselho.inepadconsulting.com'
    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000

    // Blindagem: a ATA NUNCA vai para convidados externos (filtro no servidor). Também
    // carrega a ata alvo para (a) marcar os aprovadores e (b) embutir o link de aprovação.
    if (!meetingId) return new Response(JSON.stringify({ error: 'Parâmetro ausente (meetingId).' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const externalEmails = new Set<string>()
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: meeting } = await admin.from('meetings').select('client_id, participants, atas').eq('id', meetingId).maybeSingle()
    if (!meeting) return new Response(JSON.stringify({ error: 'Reunião não encontrada.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    // Isolamento de tenant: a reunião tem que ser do cliente do solicitante (ou multi-empresa/Super)
    if (role !== 'SuperAdmin' && meeting.client_id !== homeClient && !secClients.includes(meeting.client_id)) {
      return new Response(JSON.stringify({ error: 'Sem permissão para esta empresa.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    for (const p of (meeting.participants || [])) {
      if (p?.isExternal && p?.email) externalEmails.add(String(p.email).trim().toLowerCase())
    }
    const allAtas: any[] = [...(meeting.atas || [])]
    const ataIdx = (ataId != null) ? allAtas.findIndex((a: any) => a.id === ataId) : allAtas.length - 1
    const safeRecipients = (pendingSummary || []).filter(
      (u: any) => !externalEmails.has(String(u?.email || '').trim().toLowerCase())
    )

    // Marca os aprovadores (conselheiros internos) na ata alvo — base do painel de status
    let resolvedAtaId: any = null
    if (admin && ataIdx >= 0) {
      const ata = { ...allAtas[ataIdx] }
      if (ata.id == null) ata.id = Date.now()
      ata.approvers = safeRecipients.map((u: any) => u.name)
      ata.approvalSentAt = new Date().toISOString()
      ata.approvals = ata.approvals || {}
      ata.approvalNotes = ata.approvalNotes || {}
      ata.approvalAt = ata.approvalAt || {}
      allAtas[ataIdx] = ata
      resolvedAtaId = ata.id
      try { await admin.from('meetings').update({ atas: allAtas }).eq('id', meetingId) } catch (_) { /* não bloqueia o e-mail */ }
    }

    const emailPromises = safeRecipients.map(async (user: any) => {

      // Botão de aprovação individual (token assinado, sem login)
      let approveBtn = ''
      if (resolvedAtaId != null) {
        const token = await signToken({ m: meetingId, a: resolvedAtaId, v: user.name, e: user.email, exp, k: 'ata' })
        const approveUrl = `${origin}/?atatoken=${encodeURIComponent(token)}`
        approveBtn = `
          <div style="margin: 20px 0; padding: 18px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; text-align: center;">
            <p style="margin: 0 0 12px; font-size: 13px; color: #92400e; font-weight: bold;">Esta ata depende da sua aprovação.</p>
            <a href="${approveUrl}" style="background: #b45309; color: #fff; padding: 13px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">✍️ Aprovar a ata</a>
          </div>`
      }

      // Lista de ações específicas desta ata
      const currentActionsHtml = actions.length > 0
        ? actions.map((a: any) => `
            <li style="margin-bottom: 8px;">
              <strong>${escapeHtml(a.title)}</strong><br/>
              <small>Prazo: ${escapeHtml(a.date || 'N/D')}</small>
            </li>`).join('')
        : '<li>Nenhuma nova ação registrada nesta reunião.</li>'

      // Renderização robusta das pendências GLOBAIS (Plano Global)
      const totalPendingHtml = (user.pendingActions && user.pendingActions.length > 0)
        ? user.pendingActions.map((pa: any) => `
            <div style="background: #fff; border-left: 4px solid #b45309; padding: 12px; margin-bottom: 10px; border-radius: 6px; border: 1px solid #fed7aa; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              <p style="margin: 0; font-size: 13px; font-weight: bold; color: #1e293b;">${escapeHtml(pa.title)}</p>
              <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">
                <strong>Origem:</strong> ${escapeHtml(pa.meetingTitle)} | <strong>Prazo:</strong> ${escapeHtml(pa.date || 'S/D')}
              </p>
              ${pa.obs ? `<p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8; font-style: italic;">Obs: ${escapeHtml(pa.obs)}</p>` : ''}
            </div>
          `).join('')
        : '<div style="padding: 15px; background: #ecfdf5; border-radius: 8px; border: 1px solid #d1fae5; text-align: center;"><p style="margin: 0; font-size: 13px; color: #059669; font-weight: bold;">✅ Você não possui pendências em aberto no plano global.</p></div>'

      return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Governança INEPAD <conselho@inepadconsulting.com>',
          to: user.email,
          subject: (resolvedAtaId != null ? `✍️ Aprove a ata: ${meetingTitle}` : `ATA PUBLICADA E PENDÊNCIAS: ${meetingTitle}`).replace(/[\r\n\t]+/g, ' ').trim(),
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
              <div style="background: #0f172a; padding: 20px; text-align: center;">
                <img src="https://conselho.inepadconsulting.com/boardplan-logo-email.png" style="height: 35px;" />
              </div>

              <div style="padding: 30px; color: #1e293b;">
                <p style="font-size: 16px;">Olá, <strong>${escapeHtml(user.name)}</strong>,</p>
                <p style="font-size: 14px; line-height: 1.5;">A ata da reunião <strong>${escapeHtml(meetingTitle)}</strong> foi publicada e as pendências globais foram atualizadas.</p>

                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px dashed #cbd5e1; text-align: center;">
                  <p style="margin: 0; font-weight: bold; font-size: 14px; color: #1e293b;">${escapeHtml(minuteName)}</p>
                  <a href="${safeUrl(minuteUrl)}" style="color: #b45309; font-size: 13px; font-weight: bold; text-decoration: none;">⬇ Baixar Ata em PDF</a>
                </div>

                ${approveBtn}

                <h4 style="text-transform: uppercase; font-size: 11px; color: #64748b; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; letter-spacing: 1px; margin-top: 25px;">Plano de Ação (Desta Reunião)</h4>
                <ul style="padding-left: 20px; color: #334155; font-size: 13px;">
                  ${currentActionsHtml}
                </ul>

                <div style="margin-top: 30px; padding: 20px; background: #fff7ed; border-radius: 10px; border: 1px solid #ffedd5;">
                  <h4 style="margin: 0 0 15px; color: #9a3412; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">🚨 Seu Resumo de Pendências Globais</h4>
                  ${totalPendingHtml}
                </div>

                <div style="text-align: center; margin-top: 35px;">
                  <a href="https://conselho.inepadconsulting.com" style="background: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">Ver Painel Completo</a>
                </div>
              </div>
            </div>
          `,
        }),
      })
    })

    const results = await Promise.all(emailPromises)
    return new Response(JSON.stringify({ count: results.length, ataId: resolvedAtaId, approvers: safeRecipients.map((u: any) => u.name) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
