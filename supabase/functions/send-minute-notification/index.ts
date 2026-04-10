import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Resposta para o navegador (CORS)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { meetingTitle, minuteName, minuteUrl, actions, recipients } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        // IMPORTANTE: Use o domínio EXATO verificado no seu Resend
        from: 'Governança INEPAD <conselho@inepadconsulting.com>',
        to: recipients,
        subject: `ATA PUBLICADA: ${meetingTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #0f172a; padding: 30px; text-align: center;">
               <img src="https://jrtrrubtjbinnddqdbta.supabase.co/storage/v1/object/public/meeting-files/logo-sidebar.jpg" style="height: 40px;" />
            </div>
            <div style="padding: 40px; color: #1e293b;">
              <h2 style="color: #b45309; font-style: italic;">Ata Disponível</h2>
              <p>A ata da reunião <strong>${meetingTitle}</strong> foi publicada e já pode ser consultada.</p>
              
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px dashed #cbd5e1; text-align: center;">
                <p style="margin: 0; font-weight: bold;">Arquivo: ${minuteName}</p>
                <a href="${minuteUrl}" style="color: #b45309; font-size: 14px; text-decoration: underline;">Clique aqui para baixar o PDF</a>
              </div>

              <h3 style="text-transform: uppercase; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px;">Plano de Ação Atualizado</h3>
              <ul style="padding-left: 20px; color: #334155; font-size: 14px;">
                ${actions.map((a: any) => `
                  <li style="margin-bottom: 8px;">
                    <strong>${a.title}</strong><br/>
                    <small>Responsável: ${a.resp || 'N/D'} | Prazo: ${a.date || 'N/D'}</small>
                  </li>
                `).join('')}
              </ul>
              
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