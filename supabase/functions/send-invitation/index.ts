import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// 1. Definimos o "crachá" de liberação (CORS Headers)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 2. Respondemos ao navegador quando ele faz a "pergunta de segurança" (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
              <h2 style="font-style: italic; color: #b45309;">${meetingData.title}</h2>
              <p>Prezado(a) Conselheiro(a), comunicamos a realização da próxima sessão:</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>📅 Data:</strong> ${meetingData.date}</p>
                <p style="margin: 5px 0;"><strong>⏰ Horário:</strong> ${meetingData.time}</p>
                <p style="margin: 5px 0;"><strong>📍 Formato:</strong> ${meetingData.type}</p>
              </div>
              <h3 style="text-transform: uppercase; font-size: 12px; color: #64748b; letter-spacing: 1px;">Ordem do Dia</h3>
              <ul style="padding-left: 20px;">
                ${meetingData.pautas.map((p: any) => `<li style="margin-bottom: 8px;"><strong>${p.title}</strong> (${p.dur} min)</li>`).join('')}
              </ul>
              <p style="margin-top: 30px; font-size: 14px;">Acesse a plataforma para consultar a documentação de apoio.</p>
            </div>
            <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8;">
              INEPAD Consultoria • Sistema de Governança Corporativa
            </div>
          </div>
        `,
      }),
    })

    const data = await res.json()

    // 3. Retornamos a resposta final COM os cabeçalhos de CORS
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