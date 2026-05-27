import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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
    const { meetingData, recipients } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    // Geramos o HTML das Pautas (Ordem do Dia)
    const pautasHtml = meetingData.pautas && meetingData.pautas.length > 0
      ? meetingData.pautas.map((p: any, i: number) => `
          <div style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px;">
            <span style="color: #64748b; font-weight: bold;">${i + 1}.</span>
            <strong style="color: #1e293b;">${p.title}</strong>
            <br/><small style="color: #94a3b8;">Responsável: ${p.resp || 'N/D'} | Duração: ${p.dur}min</small>
          </div>
        `).join('')
      : '<p style="color: #94a3b8; font-style: italic;">Nenhuma pauta definida para esta sessão.</p>'

    // Geramos o HTML dos Materiais (se houver)
    const materiaisHtml = meetingData.materiais && meetingData.materiais.length > 0
      ? `
        <div style="margin-top: 25px; padding: 20px; background: #f8fafc; border-radius: 8px;">
          <h4 style="margin: 0 0 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase;">Documentação de Apoio</h4>
          ${meetingData.materiais.map((m: any) => `
            <div style="margin-bottom: 5px;">
              <a href="${m.url}" style="color: #b45309; text-decoration: underline; font-size: 13px;">${m.name}</a>
            </div>
          `).join('')}
        </div>
      ` : ''

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Governança INEPAD <conselho@inepadconsulting.com>',
        to: recipients,
        subject: `CONVOCAÇÃO OFICIAL: ${meetingData.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #0f172a; padding: 30px; text-align: center;">
              <img src="https://jrtrrubtjbinnddqdbta.supabase.co/storage/v1/object/public/meeting-files/logo-sidebar.jpg" style="height: 40px;" />
            </div>
            <div style="padding: 40px; color: #1e293b;">
              <h2 style="color: #b45309; font-style: italic; margin-bottom: 5px;">Convocação de Conselho</h2>
              <p style="font-size: 16px; font-weight: bold; margin-top: 0;">${meetingData.title}</p>

              <div style="display: flex; margin: 25px 0; gap: 20px;">
                <div style="flex: 1; background: #f8fafc; padding: 15px; border-radius: 8px;">
                  <small style="color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: bold;">Data e Hora</small>
                  <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 14px;">${meetingData.date || 'S/D'} às ${meetingData.time || 'S/H'}</p>
                </div>
                <div style="flex: 1; background: #f8fafc; padding: 15px; border-radius: 8px;">
                  <small style="color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: bold;">Local/Tipo</small>
                  <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 14px;">${meetingData.type}</p>
                </div>
              </div>

              <h4 style="text-transform: uppercase; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; margin-top: 30px;">Ordem do Dia</h4>
              ${pautasHtml}

              ${materiaisHtml}

              <div style="text-align: center; margin-top: 35px;">
                <a href="https://conselho.inepadconsulting.com" style="background: #b45309; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Acessar Portal de Governança</a>
              </div>
              <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 20px;">Sua presença é essencial para as deliberações do conselho.</p>
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
