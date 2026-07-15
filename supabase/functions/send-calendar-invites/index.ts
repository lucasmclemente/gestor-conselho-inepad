import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildICS, icsToBase64, ICSEvent, ICSAttendee } from "../_shared/ics.ts"

const ALLOWED_ORIGINS = [
  'https://conselho.inepadconsulting.com',
  'https://app.boardplan.com.br',
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

// Monta o texto de localização a partir do tipo/local/link da reunião
function meetingLocation(m: any): string {
  const parts: string[] = []
  if (m.type) parts.push(String(m.type))
  if (m.address) parts.push(String(m.address))
  if (m.link) parts.push(String(m.link))
  return parts.join(' • ')
}

function formatBR(date: string, time?: string): string {
  if (!date) return 'Data a definir'
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}${time ? ` às ${time}` : ''}`
}

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
    const { meetings, recipients, clientName, organizer: organizerInput } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    if (!Array.isArray(meetings) || meetings.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma reunião informada.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum destinatário informado.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Organizador do convite: e-mail real de quem está programando as reuniões (recebe
    // as respostas RSVP). Fallback para a conta de envio caso não seja informado.
    const organizer = organizerInput?.email
      ? { name: organizerInput.name || organizerInput.email, email: organizerInput.email }
      : { name: 'Governança INEPAD', email: 'conselho@inepadconsulting.com' }

    // Destinatários como participantes (RSVP) do calendário
    const attendees: ICSAttendee[] = recipients.map((email: string) => ({ email }))

    // Um VEVENT por reunião, todas num único arquivo .ics
    const events: ICSEvent[] = meetings
      .filter((m: any) => m.date)
      .map((m: any) => ({
        uid: `${m.id || crypto.randomUUID()}@conselho.inepadconsulting.com`,
        title: m.title || 'Reunião do Conselho',
        date: m.date,
        time: m.time || '09:00',
        durationMin: 120,
        location: meetingLocation(m),
        description: 'Reunião programada do Conselho. Confirme sua presença respondendo a este convite.',
      }))

    const ics = buildICS(events, attendees, organizer, 'REQUEST')
    const icsBase64 = icsToBase64(ics)

    // Lista das datas para o corpo do e-mail
    const datesHtml = meetings
      .filter((m: any) => m.date)
      .sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''))
      .map((m: any) => `
        <div style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px;">
          <strong style="color: #1e293b;">${escapeHtml(m.title || 'Reunião do Conselho')}</strong>
          <br/><small style="color: #64748b;">${escapeHtml(formatBR(m.date, m.time))} — ${escapeHtml(meetingLocation(m) || 'Local a definir')}</small>
        </div>
      `).join('')

    const year = (meetings.find((m: any) => m.date)?.date || '').split('-')[0] || ''
    const orgLabel = clientName ? ` — ${escapeHtml(String(clientName))}` : ''

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Governança INEPAD <conselho@inepadconsulting.com>',
        to: recipients,
        reply_to: organizer.email,
        subject: `Agenda de Reuniões do Conselho${year ? ` — ${year}` : ''}`,
        attachments: [
          {
            filename: 'reunioes-conselho.ics',
            content: icsBase64,
            content_type: 'text/calendar; method=REQUEST; charset=UTF-8',
          },
        ],
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #0f172a; padding: 30px; text-align: center;">
              <img src="https://conselho.inepadconsulting.com/boardplan-logo-email.png" style="height: 40px;" />
            </div>
            <div style="padding: 40px; color: #1e293b;">
              <h2 style="color: #b45309; font-style: italic; margin-bottom: 5px;">Programação Anual do Conselho${orgLabel}</h2>
              <p style="font-size: 15px; margin-top: 0; color: #475569;">Prezado(a) conselheiro(a), seguem as reuniões programadas. Adicione-as à sua agenda usando o convite anexo (.ics) e confirme sua presença.</p>

              <h4 style="text-transform: uppercase; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; margin-top: 30px;">Reuniões Programadas</h4>
              ${datesHtml}

              <div style="margin-top: 25px; padding: 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
                <small style="color: #b45309; font-size: 13px;">📅 O arquivo de calendário anexo adiciona todas as datas de uma só vez à sua agenda (Google, Outlook, Apple).</small>
              </div>

              <div style="text-align: center; margin-top: 35px;">
                <a href="https://conselho.inepadconsulting.com" style="background: #b45309; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Acessar Portal de Governança</a>
              </div>
            </div>
          </div>
        `,
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
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
