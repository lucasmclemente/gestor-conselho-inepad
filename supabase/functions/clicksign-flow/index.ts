import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// CORS aberto — segurança garantida pelo JWT obrigatório em todas as rotas
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

// Converte ArrayBuffer para base64 em chunks — evita erro em PDFs grandes
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

// Sempre retorna 200 com { error } ou { success, clicksign_key }
// para que o Supabase invoke() passe a mensagem de erro ao front-end
function ok(body: object) {
  return new Response(JSON.stringify(body), { headers: CORS, status: 200 })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Autenticação JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return ok({ error: 'Unauthorized' })

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) return ok({ error: 'Unauthorized' })

    const { ataUrl, ataName, meetingTitle, meetingDate, participants } = await req.json()

    if (!ataUrl || !participants?.length) {
      return ok({ error: 'Parâmetros obrigatórios ausentes: ataUrl, participants' })
    }

    const CLICKSIGN_TOKEN = Deno.env.get('CLICKSIGN_ACCESS_TOKEN')
    const CLICKSIGN_BASE = Deno.env.get('CLICKSIGN_BASE_URL') ?? 'https://sandbox.clicksign.com/api/v1'

    if (!CLICKSIGN_TOKEN) return ok({ error: 'Secret CLICKSIGN_ACCESS_TOKEN não configurado no Supabase' })

    console.log(`[clicksign-flow] Baixando PDF: ${ataUrl.substring(0, 80)}...`)

    // 1. Baixa o PDF da ata
    const pdfResp = await fetch(ataUrl)
    if (!pdfResp.ok) return ok({ error: `Erro ao baixar PDF da ata: HTTP ${pdfResp.status}` })
    const pdfBuffer = await pdfResp.arrayBuffer()
    console.log(`[clicksign-flow] PDF baixado: ${pdfBuffer.byteLength} bytes`)

    const pdfBase64 = arrayBufferToBase64(pdfBuffer)
    const deadlineDate = new Date()
    deadlineDate.setDate(deadlineDate.getDate() + 30)

    // 2. Cria documento no ClickSign — path único com timestamp para evitar conflito
    const docPath = `/Atas/${Date.now()}_${ataName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 40)}`
    console.log(`[clicksign-flow] Criando documento ClickSign: ${docPath}`)

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

    const createDocText = await createDocResp.text()
    console.log(`[clicksign-flow] ClickSign create doc status: ${createDocResp.status} | body: ${createDocText.substring(0, 300)}`)

    if (!createDocResp.ok) {
      return ok({ error: `ClickSign recusou o documento (${createDocResp.status}): ${createDocText}` })
    }

    const docData = JSON.parse(createDocText)
    const documentKey: string = docData.document?.key
    if (!documentKey) return ok({ error: 'ClickSign não retornou a chave do documento' })

    // 3. Adiciona cada signatário
    let signersAdded = 0
    for (const participant of participants) {
      // Cria o signatário
      const signerResp = await fetch(`${CLICKSIGN_BASE}/signers?access_token=${CLICKSIGN_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer: { email: participant.email, auths: ['email'], name: participant.name }
        })
      })
      if (!signerResp.ok) {
        const errText = await signerResp.text()
        console.error(`[clicksign-flow] Erro ao criar signatário ${participant.email}: ${errText}`)
        return ok({ error: `Erro ao criar signatário ${participant.name} (${signerResp.status}): ${errText}` })
      }
      const signerData = await signerResp.json()
      const signerKey: string = signerData.signer?.key
      if (!signerKey) {
        return ok({ error: `ClickSign não retornou chave do signatário ${participant.name}` })
      }

      // Vincula o signatário ao documento (minimal payload)
      const listUrl = `${CLICKSIGN_BASE}/lists?access_token=${CLICKSIGN_TOKEN}`
      const listPayload = { list: { document_key: documentKey, signer_key: signerKey, sign_as: 'sign', refusable: false } }
      console.log(`[clicksign-flow] POST lists URL: ${listUrl.replace(CLICKSIGN_TOKEN!, '***')}`)
      console.log(`[clicksign-flow] POST lists body: ${JSON.stringify(listPayload)}`)

      const listResp = await fetch(listUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listPayload),
      })
      const listText = await listResp.text()
      console.log(`[clicksign-flow] lists response ${listResp.status}: ${listText}`)

      if (!listResp.ok) {
        return ok({ error: `Erro ao vincular ${participant.name} (${listResp.status}): ${listText}` })
      }

      // DIAGNÓSTICO: retorna os dados intermediários para inspeção
      return ok({
        debug: true,
        documentKey,
        signerKey,
        signerEmail: participant.email,
        listStatus: listResp.status,
        listResponse: listText,
        message: 'Diagnóstico — verifique os dados acima antes de prosseguir'
      })
    }

    if (signersAdded === 0) {
      return ok({ error: 'Nenhum signatário foi adicionado ao documento. Verifique se os participantes da reunião possuem e-mail.' })
    }

    // 4. Verifica o estado do documento antes de finalizar
    const checkResp = await fetch(`${CLICKSIGN_BASE}/documents/${documentKey}?access_token=${CLICKSIGN_TOKEN}`)
    const checkText = await checkResp.text()
    console.log(`[clicksign-flow] Documento antes do finish: ${checkText.substring(0, 500)}`)

    // 5. Ativa o documento (envia e-mails)
    const finishResp = await fetch(`${CLICKSIGN_BASE}/documents/${documentKey}/finish?access_token=${CLICKSIGN_TOKEN}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!finishResp.ok) {
      const errText = await finishResp.text()
      // Inclui estado do documento no erro para diagnóstico
      return ok({ error: `Erro ao ativar documento no ClickSign (${finishResp.status}): ${errText} | Estado doc: ${checkText.substring(0, 200)}` })
    }

    console.log(`[clicksign-flow] Documento ativado com sucesso: ${documentKey}`)
    return ok({ success: true, clicksign_key: documentKey })

  } catch (error: any) {
    console.error('[clicksign-flow] Erro inesperado:', error)
    return ok({ error: `Erro interno: ${error.message}` })
  }
})
