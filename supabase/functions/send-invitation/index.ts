import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { meetingData, recipients } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Conselho INEPAD <conselho@inepadconsulting.com>',
        to: recipients,
        subject: `CONVOCAÇÃO OFICIAL: ${meetingData.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #0f172a; padding: 30px; text-align: center;">
               <img src="https://jrtrrubtjbinnddqdbta.supabase.co/storage/v1/object/public/meeting-files/logo-sidebar.jpg" style="height: 40px;" />
            </div>
            <div style="padding: 40px; color: #1e293b;">
              <h2 style="color: #b45309; font-style: italic; margin-bottom: 20px;">${meetingData.title}</h2>
              <p>Prezado(a) Conselheiro(a), comunicamos a convocação oficial para a próxima sessão:</p>
              
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <p style="margin: 5px 0;"><strong>📅 Data:</strong> ${meetingData.date || 'S/D'}</p>
                <p style="margin: 5px 0;"><strong>⏰ Horário:</strong> ${meetingData.time || 'S/H'}</p>
                <p style="margin: 5px 0;"><strong>📍 Formato:</strong> ${meetingData.type || 'Híbrida'}</p>
              </div>

              <h3 style="text-transform: uppercase; font-size: 13px; color: #64748b; letter-spacing: 1px; margin-top: 25px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px;">Ordem do Dia</h3>
              <ul style="padding-left: 20px; color: #334155; line-height: 1.6;">
                ${(meetingData.pautas || []).map((p: any, i: number) => `
                  <li style="margin-bottom: 10px;">
                    <strong>${i + 1}. ${p.title}</strong> 
                    ${p.dur ? `<span style="color: #94a3b8;">(${p.dur} min)</span>` : ''}
                  </li>
                `).join('')}
              </ul>

              <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Acesse o portal para consultar a documentação de apoio completa.</p>
              
              <div style="text-align: center; margin-top: 35px;">
                <a href="https://conselho.inepadconsulting.com" style="background: #b45309; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Acessar Sistema GovCorp</a>
              </div>
            </div>
            <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8;">
              INEPAD Consultoria • Sistema de Governança Corporativa
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