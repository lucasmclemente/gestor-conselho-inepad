import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Eventos que indicam que TODOS assinaram e o documento está concluído
const SIGNED_EVENTS = ['auto_close', 'close', 'finalize', 'completed']

serve(async (req) => {
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ ok: true, service: 'clicksign-webhook' }), {
      headers: { 'Content-Type': 'application/json' }, status: 200
    })
  }

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const event = payload?.event
  console.log(`[clicksign-webhook] Evento recebido: ${event?.name ?? 'desconhecido'}`)
  console.log(`[clicksign-webhook] Payload: ${JSON.stringify(payload).substring(0, 1000)}`)

  if (!event?.name) return new Response('ok', { status: 200 })

  // Registra o evento mas só processa se for de conclusão
  if (!SIGNED_EVENTS.includes(event.name)) {
    console.log(`[clicksign-webhook] Evento "${event.name}" ignorado — aguardando conclusão`)
    return new Response(JSON.stringify({ received: true, event: event.name, action: 'skipped' }), {
      headers: { 'Content-Type': 'application/json' }, status: 200
    })
  }

  try {
    const document = event.data?.document
    if (!document?.key) {
      console.warn('[clicksign-webhook] Documento sem chave no payload')
      return new Response('ok', { status: 200 })
    }

    const documentKey: string = document.key
    const signedFileUrl: string | undefined =
      document.downloads?.signed_file_url ||
      document.signed_file_url ||
      document.download_url

    console.log(`[clicksign-webhook] Processando documento: ${documentKey}`)
    console.log(`[clicksign-webhook] URL do PDF assinado: ${signedFileUrl ?? 'não disponível'}`)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Busca reunião com essa ata
    const { data: meetings, error: meetErr } = await supabaseAdmin
      .from('meetings')
      .select('id, atas, client_id, title')

    if (meetErr) throw new Error('Erro ao buscar reuniões: ' + meetErr.message)

    let targetMeeting: any = null
    let ataIndex = -1

    for (const meeting of meetings ?? []) {
      const idx = (meeting.atas ?? []).findIndex((a: any) => a.clicksign_key === documentKey)
      if (idx !== -1) { targetMeeting = meeting; ataIndex = idx; break }
    }

    if (!targetMeeting || ataIndex === -1) {
      console.warn(`[clicksign-webhook] Nenhuma ata encontrada para key: ${documentKey}`)
      return new Response(JSON.stringify({ received: true, found: false }), { status: 200 })
    }

    const ata = targetMeeting.atas[ataIndex]
    let signedStorageUrl = ata.url

    // Baixa e armazena o PDF assinado
    if (signedFileUrl) {
      try {
        const CLICKSIGN_TOKEN = Deno.env.get('CLICKSIGN_ACCESS_TOKEN')
        const downloadUrl = CLICKSIGN_TOKEN
          ? `${signedFileUrl}?access_token=${CLICKSIGN_TOKEN}`
          : signedFileUrl
        const pdfResp = await fetch(downloadUrl)
        console.log(`[clicksign-webhook] Download PDF assinado: ${pdfResp.status}`)
        if (pdfResp.ok) {
          const pdfBuffer = await pdfResp.arrayBuffer()
          const filePath = `atas/${targetMeeting.client_id}/${Date.now()}_assinada.pdf`
          const { error: uploadErr } = await supabaseAdmin.storage
            .from('meeting-files')
            .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
          if (!uploadErr) {
            const { data: urlData } = await supabaseAdmin.storage
              .from('meeting-files')
              .createSignedUrl(filePath, 60 * 60 * 24 * 365)
            if (urlData?.signedUrl) {
              signedStorageUrl = urlData.signedUrl
              console.log(`[clicksign-webhook] PDF assinado salvo no Storage`)
            }
          }
        }
      } catch (e) {
        console.error('[clicksign-webhook] Erro ao salvar PDF:', e)
      }
    }

    // Atualiza ata no banco
    const updatedAtas = (targetMeeting.atas ?? []).map((a: any, i: number) =>
      i === ataIndex ? {
        ...a,
        clicksign_status: 'signed',
        clicksign_signed_url: signedStorageUrl,
        clicksign_signed_at: new Date().toISOString(),
        url: signedStorageUrl,
      } : a
    )

    await supabaseAdmin.from('meetings').update({ atas: updatedAtas }).eq('id', targetMeeting.id)
    console.log(`[clicksign-webhook] ✅ Ata marcada como assinada: ${ata.name}`)

    return new Response(
      JSON.stringify({ success: true, meeting: targetMeeting.title, ata: ata.name }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('[clicksign-webhook] Erro:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' }, status: 500
    })
  }
})
