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

function buildSignEmail(name: string, meetingTitle: string, meetingDate: string, signUrl: string, deadline: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#0f172a;padding:24px 30px;text-align:center;">
        <img src="https://jrtrrubtjbinnddqdbta.supabase.co/storage/v1/object/public/meeting-files/logo-sidebar.jpg"
             alt="INEPAD" style="height:32px;margin-bottom:10px;" />
        <p style="margin:0;color:#f59e0b;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;">
          Assinatura Digital • Ata de Reunião
        </p>
      </div>
      <div style="padding:32px;">
        <p style="font-size:16px;color:#1e293b;margin:0 0 8px;">Olá, <strong>${name}</strong></p>
        <p style="font-size:13px;color:#64748b;margin:0 0 24px;line-height:1.6;">
          Você foi convidado a assinar a ata da reunião abaixo. Clique no botão para acessar o documento e assinar digitalmente.
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#1e293b;">📋 ${meetingTitle}</p>
          <p style="margin:0;font-size:11px;color:#64748b;">Data da reunião: ${meetingDate || 'N/D'} &nbsp;|&nbsp; Prazo para assinar: ${deadline}</p>
        </div>
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${signUrl}" style="background:#0f172a;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px;display:inline-block;">
            ✍️ Assinar Documento
          </a>
        </div>
        <p style="font-size:10px;color:#94a3b8;text-align:center;line-height:1.6;">
          Este link é de uso individual e intransferível.<br/>
          Powered by <a href="https://www.clicksign.com" style="color:#94a3b8;">ClickSign</a> • Assinatura Eletrônica com Validade Jurídica
        </p>
      </div>
    </div>
  `
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
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
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    if (!CLICKSIGN_TOKEN) return ok({ error: 'Secret CLICKSIGN_ACCESS_TOKEN não configurado' })

    // 1. Baixa o PDF
    console.log(`[clicksign-flow] Baixando PDF...`)
    const pdfResp = await fetch(ataUrl)
    if (!pdfResp.ok) return ok({ error: `Erro ao baixar PDF: HTTP ${pdfResp.status}` })
    const pdfBuffer = await pdfResp.arrayBuffer()
    const pdfBase64 = arrayBufferToBase64(pdfBuffer)
    console.log(`[clicksign-flow] PDF: ${pdfBuffer.byteLength} bytes`)

    // 2. Cria documento no ClickSign
    const deadlineDate = new Date()
    deadlineDate.setDate(deadlineDate.getDate() + 30)
    const deadlineStr = deadlineDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    // Garante extensão .pdf no fim: remove a extensão original, sanitiza/trunca só o
    // nome-base e acrescenta ".pdf" (truncar com a extensão junto quebrava o MIME no ClickSign)
    const safeBase = (ataName || 'ata')
      .replace(/\.[^.]*$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 40)
    const docPath = `/Atas/${Date.now()}_${safeBase}.pdf`

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
    if (!createDocResp.ok) {
      return ok({ error: `ClickSign recusou o documento (${createDocResp.status}): ${createDocText}` })
    }
    const documentKey: string = JSON.parse(createDocText).document?.key
    if (!documentKey) return ok({ error: 'ClickSign não retornou a chave do documento' })
    console.log(`[clicksign-flow] Documento criado: ${documentKey}`)

    // 3. Adiciona signatários e coleta URLs de assinatura
    const signingLinks: { name: string; email: string; url: string }[] = []

    for (const participant of participants) {
      // Cria o signatário
      const signerResp = await fetch(`${CLICKSIGN_BASE}/signers?access_token=${CLICKSIGN_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signer: { email: participant.email, auths: ['email'], name: participant.name } })
      })
      if (!signerResp.ok) {
        const e = await signerResp.text()
        return ok({ error: `Erro ao criar signatário ${participant.name} (${signerResp.status}): ${e}` })
      }
      const signerKey: string = (await signerResp.json()).signer?.key
      if (!signerKey) return ok({ error: `ClickSign não retornou chave do signatário ${participant.name}` })

      // Vincula ao documento
      const listResp = await fetch(`${CLICKSIGN_BASE}/lists?access_token=${CLICKSIGN_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list: { document_key: documentKey, signer_key: signerKey, sign_as: 'sign', refusable: false } })
      })
      const listText = await listResp.text()
      if (!listResp.ok) {
        return ok({ error: `Erro ao vincular ${participant.name} (${listResp.status}): ${listText}` })
      }
      const signUrl: string = JSON.parse(listText).list?.url
      if (signUrl) {
        signingLinks.push({ name: participant.name, email: participant.email, url: signUrl })
        console.log(`[clicksign-flow] Signatário vinculado: ${participant.email} → ${signUrl}`)
      }
    }

    if (signingLinks.length === 0) {
      return ok({ error: 'Nenhum link de assinatura foi gerado. Verifique os participantes da reunião.' })
    }

    // 4. Tenta ativar o documento via ClickSign (opcional — envia e-mails do ClickSign)
    const baseHost = CLICKSIGN_BASE.includes('app.clicksign.com')
      ? 'https://app.clicksign.com'
      : 'https://sandbox.clicksign.com'
    const finishResp = await fetch(`${baseHost}/api/v1/documents/${documentKey}/finish?access_token=${CLICKSIGN_TOKEN}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    })
    const finishOk = finishResp.ok
    console.log(`[clicksign-flow] finish: ${finishResp.status} ${finishOk ? '✅' : '⚠️ (usando envio próprio)'}`)

    // 5. Se ClickSign não enviou e-mails (sandbox), envia via Resend com links de assinatura
    if (!finishOk && RESEND_API_KEY) {
      console.log(`[clicksign-flow] Enviando e-mails via Resend para ${signingLinks.length} signatários...`)
      for (const { name, email, url } of signingLinks) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'Governança INEPAD <conselho@inepadconsulting.com>',
            to: email,
            subject: `✍️ Assine a ata: ${meetingTitle}`,
            html: buildSignEmail(name, meetingTitle, meetingDate || '', url, deadlineStr),
          })
        })
        console.log(`[clicksign-flow] E-mail enviado para ${email}`)
      }
    }

    return ok({ success: true, clicksign_key: documentKey, signers: signingLinks.length })

  } catch (error: any) {
    console.error('[clicksign-flow] Erro:', error)
    return ok({ error: `Erro interno: ${error.message}` })
  }
})
