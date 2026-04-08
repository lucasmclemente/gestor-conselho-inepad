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

    // 1. Processar os anexos (converter URLs em Base64 para o Resend)
    const attachments = await Promise.all(
      (meetingData.materiais || []).map(async (m: any) => {
        const fileRes = await fetch(m.url);
        const arrayBuffer = await fileRes.arrayBuffer();
        const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        return {
          filename: m.name,
          content: base64Content,
        };
      })
    );

    // 2. Disparar o e-mail via Resend
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
        attachments: attachments, // <--- Aqui entram os anexos
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #0f172a; padding: 30px; text-align: center;">
               <img src="https://jrtrrubtjbinnddqdbta.supabase.co/storage/v1/object/public/meeting-files/logo-sidebar.jpg" style="height: 40px;" />
            </div>
            <div style="padding: 40px; color: #1e293b;">
              <h2 style="color: #b45309;">${meetingData.title}</h2>
              <p>Prezado(a) Conselheiro(a), comunicamos a convocação para a próxima sessão:</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>📅 Data:</strong> ${meetingData.date}</p>
                <p><strong>⏰ Horário:</strong> ${meetingData.time}</p>
                <p><strong>📍 Local:</strong> ${meetingData.type}</p>
              </div>
              <h3>Ordem do Dia</h3>
              <ul>
                ${meetingData.pautas.map((p: any) => `<li>${p.title}</li>`).join('')}
              </ul>
              <p>Os materiais de apoio seguem em anexo a este e-mail.</p>
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