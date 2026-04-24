import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { meetingTitle, minuteName, minuteUrl, actions, recipients, pendingSummary } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    // Criamos uma lista de promessas de envio para disparar tudo em paralelo (mais rápido)
    const emailPromises = pendingSummary.map(async (user: any) => {
      
      // Geramos a lista HTML das ações específicas desta reunião (Ações da Ata)
      const currentActionsHtml = actions.length > 0 
        ? actions.map((a: any) => `
            <li style="margin-bottom: 8px;">
              <strong>${a.title}</strong><br/>
              <small>Prazo: ${a.date || 'N/D'}</small>
            </li>`).join('')
        : '<li>Nenhuma nova ação registrada nesta reunião.</li>'

      // Geramos a lista HTML das ações PENDENTES GERAIS do usuário (O novo requisito)
      const totalPendingHtml = user.pendingActions.map((pa: any) => `
          <div style="background: #fff; border-left: 4px solid #b45309; padding: 10px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <p style="margin: 0; font-size: 13px; font-weight: bold;">${pa.title}</p>
            <p style="margin: 2px 0 0; font-size: 11px; color: #64748b;">
              Origem: ${pa.meetingTitle} | Prazo: ${pa.date || 'S/D'} | Status: <span style="color: #b45309;">${pa.status}</span>
            </p>
          </div>
        `).join('')

      // Corpo do e-mail personalizado para este usuário
      return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Governança INEPAD <conselho@inepadconsulting.com>',
          to: user.email,
          subject: `ATA PUBLICADA E PENDÊNCIAS: ${meetingTitle}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
              <div style="background: #0f172a; padding: 20px; text-align: center;">
                <img src="https://jrtrrubtjbinnddqdbta.supabase.co/storage/v1/object/public/meeting-files/logo-sidebar.jpg" style="height: 35px;" />
              </div>
              
              <div style="padding: 30px; color: #1e293b;">
                <p style="font-size: 16px;">Olá, <strong>${user.name}</strong>,</p>
                <p>A ata da reunião <strong>${meetingTitle}</strong> já está disponível para consulta.</p>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px dashed #cbd5e1; text-align: center;">
                  <p style="margin: 0; font-weight: bold; font-size: 14px;">${minuteName}</p>
                  <a href="${minuteUrl}" style="color: #b45309; font-size: 13px; font-weight: bold; text-decoration: none;">⬇ Baixar PDF da Ata</a>
                </div>

                <h4 style="text-transform: uppercase; font-size: 11px; color: #64748b; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; letter-spacing: 1px;">Ações desta Reunião</h4>
                <ul style="padding-left: 20px; color: #334155; font-size: 13px;">
                  ${currentActionsHtml}
                </ul>

                <div style="margin-top: 30px; padding: 20px; background: #fff7ed; border-radius: 10px;">
                  <h4 style="margin: 0 0 15px; color: #9a3412; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">🚨 Suas Pendências no Plano Global</h4>
                  ${totalPendingHtml}
                  <p style="font-size: 11px; color: #9a3412; margin-top: 10px; font-style: italic;">*Apenas ações com status diferente de 'Concluída' são listadas.</p>
                </div>

                <div style="text-align: center; margin-top: 35px;">
                  <a href="https://conselho.inepadconsulting.com" style="background: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">Acessar Meu Painel no GovCorp</a>
                </div>
              </div>
            </div>
          `,
        }),
      })
    })

    const results = await Promise.all(emailPromises)
    
    return new Response(JSON.stringify({ message: "Notificações enviadas", count: results.length }), {
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