import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1"

// Caderno de Materiais: une num ÚNICO PDF todos os materiais da reunião
// (aba Materiais + materiais de cada pauta). Une PDFs e imagens (jpg/png);
// os demais formatos (Word/PPT/Excel) são listados numa página final "baixar à parte".
// Salva o caderno como material da reunião e, se notify=true, envia por e-mail aos internos.
// Chamada pela secretária/Adm (JWT). Processamento via service role.

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com', 'http://localhost:3000']
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const isVercel = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allow = ALLOWED_ORIGINS.includes(origin) || isVercel ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
}
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const MAX_FILE = 30 * 1024 * 1024   // 30 MB por arquivo
const MAX_TOTAL = 90 * 1024 * 1024  // 90 MB somados (guarda de memória)

serve(async (req) => {
  const h = cors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...h, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Unauthorized' }, 401)
  const URLV = Deno.env.get('SUPABASE_URL') ?? ''
  const uc = createClient(URLV, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await uc.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)
  const role = (user.app_metadata as any)?.role ?? ''
  const homeClient = (user.app_metadata as any)?.client_id ?? null
  const secClients: string[] = Array.isArray((user.app_metadata as any)?.secretary_clients) ? (user.app_metadata as any).secretary_clients : []
  if (!['Administrador', 'Secretário', 'SuperAdmin'].includes(role)) return json({ error: 'Sem permissão.' }, 403)

  try {
    const { meetingId, appOrigin, notify } = await req.json()
    if (!meetingId) return json({ error: 'Reunião não informada.' }, 400)
    const admin = createClient(URLV, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })
    const { data: meeting } = await admin.from('meetings').select('id, client_id, title, date, time, pautas, materiais, participants').eq('id', meetingId).maybeSingle()
    if (!meeting) return json({ error: 'Reunião não encontrada.' }, 404)
    if (role !== 'SuperAdmin' && meeting.client_id !== homeClient && !secClients.includes(meeting.client_id)) return json({ error: 'Sem permissão para esta empresa.' }, 403)

    // Monta a lista ordenada de materiais: gerais + por pauta
    type Item = { section: string; name: string; path: string }
    const items: Item[] = []
    const pathOf = (url: string): string | null => {
      const m = String(url || '').match(/\/meeting-files\/(.+?)(?:\?|$)/)
      return m ? decodeURIComponent(m[1]) : null
    }
    for (const mat of (Array.isArray(meeting.materiais) ? meeting.materiais : [])) {
      if (mat?.consolidated) continue // não re-incluir cadernos já gerados
      const p = pathOf(mat?.url); if (p && mat?.name) items.push({ section: 'Materiais Gerais', name: mat.name, path: p })
    }
    const pautas = Array.isArray(meeting.pautas) ? meeting.pautas : []
    let pautaNo = 0
    for (const pt of pautas) {
      if (pt?.type === 'intervalo') continue
      pautaNo++
      for (const mat of (pt?.materiais || [])) {
        const p = pathOf(mat?.url); if (p && mat?.name) items.push({ section: `Pauta ${pautaNo} — ${pt.title || ''}`, name: mat.name, path: p })
      }
    }
    if (items.length === 0) return json({ error: 'Não há materiais anexados nesta reunião.' }, 400)

    // ── Monta o PDF ──
    const out = await PDFDocument.create()
    const font = await out.embedFont(StandardFonts.Helvetica)
    const bold = await out.embedFont(StandardFonts.HelveticaBold)
    const A4: [number, number] = [595.28, 841.89]
    const NAVY = rgb(0.06, 0.09, 0.16), AMBER = rgb(0.70, 0.33, 0.04), GRAY = rgb(0.4, 0.45, 0.5)

    const wrap = (text: string, f: any, size: number, maxW: number): string[] => {
      const words = String(text || '').split(/\s+/); const lines: string[] = []; let line = ''
      for (const w of words) {
        const t = line ? line + ' ' + w : w
        if (f.widthOfTextAtSize(t, size) > maxW && line) { lines.push(line); line = w } else line = t
      }
      if (line) lines.push(line); return lines
    }
    const textPage = (title: string, subtitle: string, lines: { t: string; bold?: boolean; color?: any }[]) => {
      const page = out.addPage(A4); const { width, height } = page.getSize()
      page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: NAVY })
      page.drawText('BOARDPLAN', { x: 48, y: height - 46, size: 12, font: bold, color: rgb(1, 1, 1) })
      page.drawText('INEPAD Governança', { x: 48, y: height - 64, size: 9, font, color: rgb(0.8, 0.84, 0.9) })
      let y = height - 140
      for (const l of wrap(title, bold, 20, width - 96)) { page.drawText(l, { x: 48, y, size: 20, font: bold, color: AMBER }); y -= 26 }
      if (subtitle) { y -= 4; for (const l of wrap(subtitle, font, 12, width - 96)) { page.drawText(l, { x: 48, y, size: 12, font, color: GRAY }); y -= 18 } }
      y -= 16
      for (const item of lines) {
        for (const l of wrap(item.t, item.bold ? bold : font, 11, width - 110)) {
          if (y < 60) { break }
          page.drawText(l, { x: 54, y, size: 11, font: item.bold ? bold : font, color: item.color || rgb(0.1, 0.14, 0.2) }); y -= 16
        }
      }
      return page
    }

    const fmtDate = (d: string) => d ? d.split('-').reverse().join('/') : ''
    const included: string[] = []
    const skipped: { name: string; reason: string }[] = []

    // Capa (preenchemos o resumo depois, com uma 2ª passada simples no texto)
    // Processa os materiais por seção, com uma página separadora por seção
    let totalBytes = 0
    let lastSection = ''
    const bodyStart = out.getPageCount() // 0 inicialmente

    for (const it of items) {
      if (it.section !== lastSection) {
        const secItems = items.filter(x => x.section === it.section).map(x => ({ t: '• ' + x.name }))
        textPage(it.section, 'Materiais desta seção:', secItems)
        lastSection = it.section
      }
      const ext = (it.name.split('.').pop() || '').toLowerCase()
      try {
        if (totalBytes >= MAX_TOTAL) { skipped.push({ name: it.name, reason: 'limite total de tamanho atingido' }); continue }
        const { data: blob, error } = await admin.storage.from('meeting-files').download(it.path)
        if (error || !blob) { skipped.push({ name: it.name, reason: 'falha ao baixar' }); continue }
        const bytes = new Uint8Array(await blob.arrayBuffer())
        if (bytes.byteLength > MAX_FILE) { skipped.push({ name: it.name, reason: 'arquivo muito grande' }); continue }
        totalBytes += bytes.byteLength

        if (ext === 'pdf') {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
          const pages = await out.copyPages(src, src.getPageIndices())
          pages.forEach(p => out.addPage(p))
          included.push(it.name)
        } else if (ext === 'png') {
          const img = await out.embedPng(bytes); const page = out.addPage(A4)
          const { width, height } = page.getSize(); const s = Math.min((width - 72) / img.width, (height - 120) / img.height, 1)
          page.drawImage(img, { x: (width - img.width * s) / 2, y: (height - img.height * s) / 2, width: img.width * s, height: img.height * s })
          included.push(it.name)
        } else if (ext === 'jpg' || ext === 'jpeg') {
          const img = await out.embedJpg(bytes); const page = out.addPage(A4)
          const { width, height } = page.getSize(); const s = Math.min((width - 72) / img.width, (height - 120) / img.height, 1)
          page.drawImage(img, { x: (width - img.width * s) / 2, y: (height - img.height * s) / 2, width: img.width * s, height: img.height * s })
          included.push(it.name)
        } else {
          skipped.push({ name: it.name, reason: `formato .${ext} (baixar à parte)` })
        }
      } catch (_e) {
        skipped.push({ name: it.name, reason: 'não foi possível processar' })
      }
    }

    // Página final com os materiais não incluídos
    if (skipped.length > 0) {
      textPage('Materiais não incluídos neste PDF', 'Baixe estes arquivos separadamente na plataforma:',
        skipped.map(s => ({ t: `• ${s.name}  —  ${s.reason}`, color: GRAY })))
    }

    // Capa no início (inserida como primeira página)
    const cover = out.addPage(A4)
    const { width: cw, height: ch } = cover.getSize()
    cover.drawRectangle({ x: 0, y: ch - 160, width: cw, height: 160, color: NAVY })
    cover.drawText('CADERNO DE MATERIAIS', { x: 48, y: ch - 70, size: 22, font: bold, color: rgb(1, 1, 1) })
    cover.drawText('Boardplan · INEPAD Governança', { x: 48, y: ch - 96, size: 11, font, color: rgb(0.8, 0.84, 0.9) })
    let cy = ch - 210
    for (const l of wrap(meeting.title || 'Reunião do Conselho', bold, 18, cw - 96)) { cover.drawText(l, { x: 48, y: cy, size: 18, font: bold, color: AMBER }); cy -= 24 }
    cy -= 6
    if (meeting.date) { cover.drawText(`${fmtDate(meeting.date)}${meeting.time ? ' às ' + meeting.time : ''}`, { x: 48, y: cy, size: 12, font, color: GRAY }); cy -= 24 }
    cover.drawText(`${included.length} material(is) incluído(s)${skipped.length ? `  ·  ${skipped.length} para baixar à parte` : ''}`, { x: 48, y: cy, size: 12, font, color: rgb(0.1, 0.14, 0.2) }); cy -= 20
    cover.drawText(`Gerado em ${new Date().toLocaleString('pt-BR')}`, { x: 48, y: cy, size: 10, font, color: GRAY })
    // move a capa (última página) para o início
    out.removePage(out.getPageCount() - 1)
    out.insertPage(0, cover)

    if (included.length === 0) return json({ error: 'Nenhum material pôde ser unido (todos em formatos não suportados ou ilegíveis).', skipped }, 400)

    const pdfBytes = await out.save()

    // ── Sobe o caderno e salva como material da reunião ──
    const cleanTitle = String(meeting.title || 'Reuniao').replace(/[^\w.\-]+/g, '_').slice(0, 60)
    const fileName = `Caderno de Materiais - ${meeting.title || 'Reunião'}.pdf`
    const path = `materiais-consolidados/${meeting.client_id}/${meeting.id}/${Date.now()}-caderno-${cleanTitle}.pdf`
    const up = await admin.storage.from('meeting-files').upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true })
    if (up.error) return json({ error: 'Falha ao salvar o PDF: ' + up.error.message }, 400)
    const { data: signed } = await admin.storage.from('meeting-files').createSignedUrl(path, 60 * 60 * 24 * 14)
    const url = signed?.signedUrl || ''

    const att = { name: fileName, url, uploadedAt: new Date().toISOString(), consolidated: true }
    const freshMats = [...(Array.isArray(meeting.materiais) ? meeting.materiais : []).filter((m: any) => !m?.consolidated), att]
    await admin.from('meetings').update({ materiais: freshMats }).eq('id', meeting.id)
    try { await admin.from('audit_logs').insert([{ username: (user.user_metadata as any)?.name || user.email, action: 'Caderno de Materiais', details: `Caderno gerado (${included.length} itens) — ${meeting.title}`, client_id: meeting.client_id }]) } catch (_) { /* */ }

    // ── E-mail aos participantes internos (opcional) ──
    let emailed = 0
    if (notify) {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
      const origin = (typeof appOrigin === 'string' && /^https?:\/\//.test(appOrigin)) ? appOrigin.replace(/\/$/, '') : 'https://conselho.inepadconsulting.com'
      const recipients = (meeting.participants || []).filter((p: any) => p?.email && !p.isExternal).map((p: any) => ({ email: p.email, name: p.name }))
      const html = (name: string) => `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <div style="background:#0f172a;padding:28px;text-align:center;border-bottom:4px solid #b45309;">
            <img src="https://conselho.inepadconsulting.com/boardplan-logo-email.png" alt="Boardplan" style="height:34px;" />
          </div>
          <div style="padding:36px;color:#1e293b;">
            <h2 style="color:#b45309;font-style:italic;margin:0 0 4px;">Caderno de Materiais</h2>
            <p style="font-size:15px;font-weight:bold;margin:0;">${esc(meeting.title || '')}</p>
            <p style="font-size:13px;color:#64748b;">${esc(fmtDate(meeting.date) || 'S/D')}${meeting.time ? ' às ' + esc(meeting.time) : ''}</p>
            <p style="font-size:14px;">Olá, <b>${esc(name)}</b>. Reunimos num único PDF todos os materiais desta reunião (${included.length} documento(s)) para você analisar com antecedência.</p>
            <div style="text-align:center;margin:30px 0 8px;">
              <a href="${esc(url)}" style="background:#b45309;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;display:inline-block;">⬇ Baixar o Caderno de Materiais (PDF)</a>
            </div>
            ${skipped.length ? `<p style="text-align:center;font-size:11px;color:#94a3b8;">Obs.: ${skipped.length} material(is) em outros formatos devem ser baixados à parte na plataforma.</p>` : ''}
          </div>
        </div>`
      if (RESEND_API_KEY) {
        const sends = recipients.map((r: any) => fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({ from: 'Governança INEPAD <conselho@inepadconsulting.com>', to: r.email, subject: `Caderno de Materiais: ${String(meeting.title || 'Reunião').replace(/[\r\n\t]+/g, ' ').trim()}`, html: html(r.name || '') }),
        }))
        const res = await Promise.allSettled(sends)
        emailed = res.filter((x) => x.status === 'fulfilled').length
      }
    }

    return json({ ok: true, url, name: fileName, included: included.length, skipped, emailed })
  } catch (e: any) {
    return json({ error: e?.message || 'Erro inesperado.' }, 400)
  }
})
