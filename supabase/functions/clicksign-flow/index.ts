import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// CORS aberto — segurança garantida pelo JWT obrigatório em todas as rotas
function getCors(_req: Request) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

serve(async (req) => {
  const cors = getCors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // Autenticação JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    const { meetingId, ataUrl, ataName, meetingTitle, meetingDate, participants } = await req.json()

    if (!ataUrl || !participants?.length) {
      return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios: ataUrl, participants' }), { status: 400, headers: cors })
    }

    const CLICKSIGN_TOKEN = Deno.env.get('CLICKSIGN_ACCESS_TOKEN')
    const CLICKSIGN_BASE = Deno.env.get('CLICKSIGN_BASE_URL') ?? 'https://sandbox.clicksign.com/api/v1'

    if (!CLICKSIGN_TOKEN) return new Response(JSON.stringify({ error: 'CLICKSIGN_ACCESS_TOKEN não configurado' }), { status: 500, headers: cors })

    // 1. Baixa o PDF da ata
    const pdfResp = await fetch(ataUrl)
    if (!pdfResp.ok) throw new Error(`Erro ao baixar PDF: ${pdfResp.status}`)
    const pdfBuffer = await pdfResp.arrayBuffer()
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)))

    const deadlineDate = new Date()
    deadlineDate.setDate(deadlineDate.getDate() + 30) // 30 dias para assinar

    // 2. Cria documento no ClickSign
    const docPath = `/Atas/${meetingDate || 'sem-data'}_${ataName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const createDocResp = await fetch(`${CLICKSIGN_BASE}/documents?access_token=${CLICKSIGN_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document: {
          path: docPath,
          content_base64: `data:application/pdf;base64,${pdfBase64}`,
          deadline_at: deadlineDate.toISOString(),
          auto_close: true,
          locale: 'pt-BR',
          sequence_enabled: false,
          message: `Por favor, assine a ata da reunião: ${meetingTitle}`,
        }
      })
    })

    if (!createDocResp.ok) {
      const errText = await createDocResp.text()
      throw new Error(`Erro ao criar documento no ClickSign: ${errText}`)
    }
    const docData = await createDocResp.json()
    const documentKey: string = docData.document?.key
    if (!documentKey) throw new Error('ClickSign não retornou chave do documento')

    // 3. Adiciona cada signatário
    for (const participant of participants) {
      // Cria o signatário
      const signerResp = await fetch(`${CLICKSIGN_BASE}/signers?access_token=${CLICKSIGN_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer: {
            email: participant.email,
            auths: ['email'],
            name: participant.name,
          }
        })
      })
      if (!signerResp.ok) {
        console.error(`Erro ao criar signatário ${participant.email}: ${await signerResp.text()}`)
        continue
      }
      const signerData = await signerResp.json()
      const signerKey: string = signerData.signer?.key
      if (!signerKey) continue

      // Vincula signatário ao documento
      await fetch(`${CLICKSIGN_BASE}/lists?access_token=${CLICKSIGN_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list: {
            document_key: documentKey,
            signer_key: signerKey,
            sign_as: 'sign',
            message: `Você foi convidado a assinar a ata da reunião "${meetingTitle}".`,
          }
        })
      })
    }

    // 4. Ativa o documento (envia e-mails aos signatários)
    const finishResp = await fetch(`${CLICKSIGN_BASE}/documents/${documentKey}/finish?access_token=${CLICKSIGN_TOKEN}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!finishResp.ok) {
      const errText = await finishResp.text()
      throw new Error(`Erro ao ativar documento: ${errText}`)
    }

    return new Response(
      JSON.stringify({ success: true, clicksign_key: documentKey }),
      { headers: { ...cors, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('clicksign-flow error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...cors, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
