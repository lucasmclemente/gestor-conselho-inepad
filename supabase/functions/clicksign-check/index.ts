import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function ok(body: object) {
  return new Response(JSON.stringify(body), { headers: CORS, status: 200 })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return ok({ error: 'Unauthorized' })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await anonClient.auth.getUser()
    if (authError || !user) return ok({ error: 'Unauthorized' })

    const { meetingId, ataIndex, clicksign_key } = await req.json()
    if (!meetingId || ataIndex === undefined || !clicksign_key) {
      return ok({ error: 'meetingId, ataIndex e clicksign_key são obrigatórios' })
    }

    const CLICKSIGN_TOKEN = Deno.env.get('CLICKSIGN_ACCESS_TOKEN')
    const CLICKSIGN_BASE = Deno.env.get('CLICKSIGN_BASE_URL') ?? 'https://sandbox.clicksign.com/api/v1'

    if (!CLICKSIGN_TOKEN) return ok({ error: 'CLICKSIGN_ACCESS_TOKEN não configurado' })

    // Consulta o estado atual do documento no ClickSign
    const docResp = await fetch(`${CLICKSIGN_BASE}/documents/${clicksign_key}?access_token=${CLICKSIGN_TOKEN}`)
    if (!docResp.ok) {
      return ok({ error: `Erro ao consultar ClickSign: ${docResp.status}` })
    }
    const docData = await docResp.json()
    const doc = docData.document
    const status: string = doc?.status ?? 'unknown'
    console.log(`[clicksign-check] Documento ${clicksign_key} status: ${status}`)

    // Status "closed" = todos assinaram
    if (status !== 'closed') {
      // Verifica se há signatários pendentes
      const signers = doc?.signers ?? []
      const pending = signers.filter((s: any) => !s.signed_at).length
      const total = signers.length
      return ok({ signed: false, status, pending, total, message: `${total - pending}/${total} assinaram` })
    }

    // Documento fechado — busca e armazena o PDF assinado
    const { data: meeting } = await supabaseAdmin
      .from('meetings')
      .select('id, atas, client_id, title')
      .eq('id', meetingId)
      .single()

    if (!meeting) return ok({ error: 'Reunião não encontrada' })

    const ata = (meeting.atas ?? [])[ataIndex]
    if (!ata) return ok({ error: 'Ata não encontrada' })

    let signedStorageUrl = ata.url

    // Baixa o PDF assinado via endpoint de download do ClickSign
    try {
      // Tenta a URL do campo downloads primeiro, depois o endpoint direto
      const signedFileUrl =
        doc?.downloads?.signed_file_url ||
        doc?.signed_file_url ||
        `${CLICKSIGN_BASE}/documents/${clicksign_key}/download`

      console.log(`[clicksign-check] Baixando PDF assinado: ${signedFileUrl}`)
      const pdfResp = await fetch(`${signedFileUrl}?access_token=${CLICKSIGN_TOKEN}`)
      console.log(`[clicksign-check] Download status: ${pdfResp.status}, Content-Type: ${pdfResp.headers.get('content-type')}`)

      if (pdfResp.ok && pdfResp.headers.get('content-type')?.includes('pdf')) {
        const pdfBuffer = await pdfResp.arrayBuffer()
        const filePath = `atas/${meeting.client_id}/${Date.now()}_assinada.pdf`
        const { error: uploadErr } = await supabaseAdmin.storage
          .from('meeting-files')
          .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
        if (!uploadErr) {
          const { data: urlData } = await supabaseAdmin.storage
            .from('meeting-files')
            .createSignedUrl(filePath, 60 * 60 * 24 * 365)
          if (urlData?.signedUrl) {
            signedStorageUrl = urlData.signedUrl
            console.log(`[clicksign-check] ✅ PDF assinado salvo no Storage`)
          }
        } else {
          console.error('[clicksign-check] Erro no upload:', uploadErr)
        }
      } else {
        console.warn(`[clicksign-check] PDF não disponível ainda (${pdfResp.status})`)
      }
    } catch (e) {
      console.error('[clicksign-check] Erro ao baixar PDF assinado:', e)
    }

    // Atualiza a ata
    const updatedAtas = (meeting.atas ?? []).map((a: any, i: number) =>
      i === ataIndex ? {
        ...a,
        clicksign_status: 'signed',
        clicksign_signed_url: signedStorageUrl,
        clicksign_signed_at: new Date().toISOString(),
        url: signedStorageUrl,
      } : a
    )

    await supabaseAdmin.from('meetings').update({ atas: updatedAtas }).eq('id', meetingId)
    console.log(`[clicksign-check] ✅ Ata ${ata.name} marcada como assinada`)

    return ok({ signed: true, status: 'closed' })

  } catch (error: any) {
    console.error('[clicksign-check] Erro:', error)
    return ok({ error: `Erro interno: ${error.message}` })
  }
})
