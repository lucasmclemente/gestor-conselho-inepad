import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
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

    // 1. Consulta o estado do documento no ClickSign
    const docResp = await fetch(`${CLICKSIGN_BASE}/documents/${clicksign_key}?access_token=${CLICKSIGN_TOKEN}`)
    if (!docResp.ok) return ok({ error: `Erro ao consultar ClickSign: ${docResp.status}` })
    const docData = await docResp.json()
    const doc = docData.document
    const status: string = doc?.status ?? 'unknown'

    // Diagnóstico completo da resposta do documento
    const debug: any = {
      docStatus: status,
      docFields: Object.keys(doc ?? {}),
      downloads: doc?.downloads ?? null,
      signedFileUrl: doc?.downloads?.signed_file_url ?? doc?.signed_file_url ?? null,
    }

    if (status !== 'closed') {
      const signers = doc?.signers ?? []
      const pending = signers.filter((s: any) => !s.signed_at).length
      return ok({ signed: false, status, pending, total: signers.length, debug })
    }

    // 2. Busca reunião no banco
    const { data: meeting } = await supabaseAdmin
      .from('meetings').select('id, atas, client_id, title').eq('id', meetingId).single()
    if (!meeting) return ok({ error: 'Reunião não encontrada' })

    const ata = (meeting.atas ?? [])[ataIndex]
    if (!ata) return ok({ error: 'Ata não encontrada' })

    let signedStorageUrl = ata.url

    // 3. Tenta baixar o PDF assinado
    // Prioridade: campo downloads do doc > endpoint direto de download
    const downloadUrl = doc?.downloads?.signed_file_url
      || doc?.signed_file_url
      || `${CLICKSIGN_BASE}/documents/${clicksign_key}/download`

    debug.attemptedDownloadUrl = downloadUrl

    try {
      const pdfResp = await fetch(`${downloadUrl}?access_token=${CLICKSIGN_TOKEN}`)
      const ct = pdfResp.headers.get('content-type') ?? ''
      const cl = pdfResp.headers.get('content-length') ?? '?'
      debug.downloadStatus = pdfResp.status
      debug.downloadContentType = ct
      debug.downloadContentLength = cl

      if (pdfResp.ok) {
        const buf = await pdfResp.arrayBuffer()
        debug.bufferBytes = buf.byteLength

        if (buf.byteLength >= 500) {
          // Arquivo válido — faz upload para o Supabase Storage
          const filePath = `atas/${meeting.client_id}/${Date.now()}_assinada.pdf`
          const { error: upErr } = await supabaseAdmin.storage
            .from('meeting-files')
            .upload(filePath, buf, { contentType: 'application/pdf', upsert: true })

          if (!upErr) {
            const { data: urlData } = await supabaseAdmin.storage
              .from('meeting-files')
              .createSignedUrl(filePath, 60 * 60 * 24 * 7)
            if (urlData?.signedUrl) {
              signedStorageUrl = urlData.signedUrl
              debug.uploaded = true
            }
          } else {
            debug.uploadError = upErr.message
          }
        } else {
          // Provavelmente HTML — mostra preview
          debug.smallBodyPreview = new TextDecoder().decode(buf.slice(0, 300))
        }
      } else {
        debug.downloadErrorBody = (await pdfResp.text()).substring(0, 400)
      }
    } catch (e: any) {
      debug.downloadException = e.message
    }

    // 4. Atualiza a ata no banco
    const pdfUpdated = signedStorageUrl !== ata.url
    const updatedAtas = (meeting.atas ?? []).map((a: any, i: number) =>
      i === ataIndex ? {
        ...a,
        clicksign_status: 'signed',
        clicksign_signed_url: signedStorageUrl,
        clicksign_signed_at: new Date().toISOString(),
        url: signedStorageUrl,
      } : a
    )

    const { error: updateErr } = await supabaseAdmin
      .from('meetings')
      .update({ atas: updatedAtas })
      .eq('id', meetingId)

    if (updateErr) {
      console.error('[clicksign-check] Erro ao atualizar banco:', updateErr.message)
      return ok({ error: `Erro ao atualizar reunião no banco: ${updateErr.message}` })
    }

    return ok({ signed: true, status: 'closed', pdfUpdated, updatedAtas, debug })

  } catch (error: any) {
    return ok({ error: `Erro interno: ${error.message}` })
  }
})
