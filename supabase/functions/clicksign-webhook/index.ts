import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const payload = await req.json()
    const event = payload?.event
    if (!event) return new Response('ok', { status: 200 })

    // ClickSign envia vários eventos — só nos interessa o fechamento (todos assinaram)
    if (event.name !== 'auto_close' && event.name !== 'close') {
      return new Response(JSON.stringify({ skipped: true, event: event.name }), { status: 200 })
    }

    const document = event.data?.document
    if (!document?.key) return new Response('ok', { status: 200 })

    const documentKey: string = document.key
    const signedFileUrl: string | undefined = document.downloads?.signed_file_url

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Busca a reunião que tem esta ata com o clicksign_key
    const { data: meetings, error: meetErr } = await supabaseAdmin
      .from('meetings')
      .select('id, atas, client_id, title')

    if (meetErr) throw new Error('Erro ao buscar reuniões: ' + meetErr.message)

    // Encontra a reunião e o índice da ata com esse clicksign_key
    let targetMeeting: any = null
    let ataIndex = -1

    for (const meeting of meetings ?? []) {
      const idx = (meeting.atas ?? []).findIndex((a: any) => a.clicksign_key === documentKey)
      if (idx !== -1) {
        targetMeeting = meeting
        ataIndex = idx
        break
      }
    }

    if (!targetMeeting || ataIndex === -1) {
      console.warn(`Nenhuma ata encontrada para clicksign_key: ${documentKey}`)
      return new Response('ok', { status: 200 })
    }

    const ata = targetMeeting.atas[ataIndex]
    let signedStorageUrl = ata.url // fallback: mantém URL original

    // Tenta baixar o PDF assinado e armazená-lo no Supabase Storage
    if (signedFileUrl) {
      try {
        const CLICKSIGN_TOKEN = Deno.env.get('CLICKSIGN_ACCESS_TOKEN')
        const pdfResp = await fetch(`${signedFileUrl}?access_token=${CLICKSIGN_TOKEN}`)
        if (pdfResp.ok) {
          const pdfBuffer = await pdfResp.arrayBuffer()
          const fileName = `${targetMeeting.client_id}/${Date.now()}_assinada.pdf`
          const filePath = `atas/${fileName}`
          await supabaseAdmin.storage.from('meeting-files').upload(filePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          })
          const { data: urlData } = await supabaseAdmin.storage
            .from('meeting-files')
            .createSignedUrl(filePath, 60 * 60 * 24 * 365) // 1 ano
          if (urlData?.signedUrl) signedStorageUrl = urlData.signedUrl
        }
      } catch (e) {
        console.error('Erro ao salvar PDF assinado:', e)
        // Continua sem o PDF no Storage — atualiza só o status
      }
    }

    // Atualiza a ata com status 'signed'
    const updatedAtas = (targetMeeting.atas ?? []).map((a: any, i: number) =>
      i === ataIndex
        ? {
            ...a,
            clicksign_status: 'signed',
            clicksign_signed_url: signedStorageUrl,
            clicksign_signed_at: new Date().toISOString(),
            url: signedStorageUrl, // substitui o link principal pela versão assinada
          }
        : a
    )

    await supabaseAdmin
      .from('meetings')
      .update({ atas: updatedAtas })
      .eq('id', targetMeeting.id)

    console.log(`Ata assinada com sucesso: ${ata.name} — Reunião: ${targetMeeting.title}`)

    return new Response(
      JSON.stringify({ success: true, meeting: targetMeeting.title, ata: ata.name }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('clicksign-webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
