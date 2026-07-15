import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildICS, icsToBase64, ICSAttendee } from "../_shared/ics.ts"

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

  try {
    const { meetingData, recipients, organizer: organizerInput } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    // Organizador do convite: e-mail real de quem está convocando (recebe as respostas
    // RSVP). Fallback para a conta de envio caso não seja informado.
    const organizer = organizerInput?.email
      ? { name: organizerInput.name || organizerInput.email, email: organizerInput.email }
      : { name: 'Governança INEPAD', email: 'conselho@inepadconsulting.com' }

    // Renderiza uma lista de pautas (Ordem do Dia) — usada tanto para a agenda completa
    // (participantes internos) quanto para o recorte por responsável (participantes externos)
    const renderPautas = (pautas: any[], emptyMsg: string) =>
      (pautas && pautas.length > 0)
        ? pautas.map((p: any, i: number) => `
          <div style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px;">
            <span style="color: #64748b; font-weight: bold;">${i + 1}.</span>
            <strong style="color: #1e293b;">${escapeHtml(p.title)}</strong>
            <br/><small style="color: #94a3b8;">Responsável: ${escapeHtml(p.resp || 'N/D')} | Duração: ${escapeHtml(String(p.dur))}min</small>
          </div>
        `).join('')
        : `<p style="color: #94a3b8; font-style: italic;">${escapeHtml(emptyMsg)}</p>`
    const pautasHtml = renderPautas(meetingData.pautas, 'Nenhuma pauta definida para esta sessão.')

    // Geramos o HTML dos Materiais (se houver)
    const materiaisHtml = meetingData.materiais && meetingData.materiais.length > 0
      ? `
        <div style="margin-top: 25px; padding: 20px; background: #f8fafc; border-radius: 8px;">
          <h4 style="margin: 0 0 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase;">Documentação de Apoio</h4>
          ${meetingData.materiais.map((m: any) => `
            <div style="margin-bottom: 5px;">
              <a href="${safeUrl(m.url)}" style="color: #b45309; text-decoration: underline; font-size: 13px;">${escapeHtml(m.name)}</a>
            </div>
          `).join('')}
        </div>
      ` : ''

    // Gera o convite de calendário (.ics com RSVP) para os e-mails informados
    const buildIcsAttachments = (attendeeEmails: string[]): any[] | undefined => {
      if (!meetingData.date) return undefined
      const locationParts = [meetingData.type, meetingData.address, meetingData.link].filter(Boolean)
      const attendees: ICSAttendee[] = attendeeEmails.map((email: string) => ({ email }))
      const ics = buildICS(
        [{
          uid: `${meetingData.id || crypto.randomUUID()}@conselho.inepadconsulting.com`,
          title: meetingData.title || 'Reunião do Conselho',
          date: meetingData.date,
          time: meetingData.time || '09:00',
          durationMin: 120,
          location: locationParts.join(' • '),
          description: 'Convocação oficial do Conselho. Confirme sua presença respondendo a este convite.',
        }],
        attendees,
        organizer,
        'REQUEST',
      )
      return [{
        filename: 'convocacao.ics',
        content: icsToBase64(ics),
        content_type: 'text/calendar; method=REQUEST; charset=UTF-8',
      }]
    }

    const buildEmailBody = (pautas: string) => `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #0f172a; padding: 30px; text-align: center;">
              <img src="https://conselho.inepadconsulting.com/boardplan-logo-email.png" style="height: 40px;" />
            </div>
            <div style="padding: 40px; color: #1e293b;">
              <h2 style="color: #b45309; font-style: italic; margin-bottom: 5px;">Convocação de Conselho</h2>
              <p style="font-size: 16px; font-weight: bold; margin-top: 0;">${escapeHtml(meetingData.title)}</p>

              <div style="display: flex; margin: 25px 0; gap: 20px;">
                <div style="flex: 1; background: #f8fafc; padding: 15px; border-radius: 8px;">
                  <small style="color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: bold;">Data e Hora</small>
                  <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 14px;">${escapeHtml(meetingData.date || 'S/D')} às ${escapeHtml(meetingData.time || 'S/H')}</p>
                </div>
                <div style="flex: 1; background: #f8fafc; padding: 15px; border-radius: 8px;">
                  <small style="color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: bold;">Local/Tipo</small>
                  <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 14px;">${escapeHtml(meetingData.type)}</p>
                </div>
              </div>

              <h4 style="text-transform: uppercase; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; margin-top: 30px;">Ordem do Dia</h4>
              ${pautas}

              ${materiaisHtml}

              <div style="text-align: center; margin-top: 35px;">
                <a href="https://conselho.inepadconsulting.com" style="background: #b45309; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Acessar Portal de Governança</a>
              </div>
              <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 20px;">Sua presença é essencial para as deliberações do conselho.</p>
            </div>
          </div>
        `

    const sendEmail = (to: string[], pautas: string, attendeeEmails: string[]) => {
      const attachments = buildIcsAttachments(attendeeEmails)
      return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'Governança INEPAD <conselho@inepadconsulting.com>',
          to,
          reply_to: organizer.email,
          subject: `CONVOCAÇÃO OFICIAL: ${meetingData.title}`,
          ...(attachments ? { attachments } : {}),
          html: buildEmailBody(pautas),
        }),
      })
    }

    // Internos: agenda completa em um único e-mail. Externos: e-mail individual, só
    // com as pautas em que ele é o responsável (não recebem a pauta toda).
    const participants = Array.isArray(meetingData.participants) ? meetingData.participants : []
    const byEmail = new Map<string, any>()
    participants.forEach((p: any) => { if (p?.email) byEmail.set(String(p.email).toLowerCase(), p) })
    const norm = (s: any) => String(s || '').trim().toLowerCase()
    const isExt = (e: string) => byEmail.get(String(e).toLowerCase())?.isExternal === true
    const external = (recipients || []).filter((e: string) => isExt(e))
    const internal = (recipients || []).filter((e: string) => !isExt(e))

    const sends: Promise<any>[] = []
    if (internal.length > 0) sends.push(sendEmail(internal, pautasHtml, internal))
    for (const email of external) {
      const p = byEmail.get(String(email).toLowerCase())
      const mine = (meetingData.pautas || []).filter((pt: any) => norm(pt.resp) === norm(p?.name))
      sends.push(sendEmail([email], renderPautas(mine, 'Você não tem pautas específicas atribuídas nesta reunião.'), [email]))
    }

    const results = await Promise.allSettled(sends)
    const sent = results.filter((r) => r.status === 'fulfilled').length
    return new Response(JSON.stringify({ success: true, sent, internal: internal.length, external: external.length }), {
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
