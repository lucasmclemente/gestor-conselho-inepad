import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { signToken } from "../_shared/votetoken.ts"

// Solicita, por e-mail, que cada RESPONSÁVEL envie os materiais das SUAS pautas.
// Um e-mail por responsável, listando só as pautas dele, com link (token) para upload
// sem login. Chamada pela secretária/Adm (JWT). Garante uid em cada pauta.

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com', 'http://localhost:3000']
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const isVercel = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allow = ALLOWED_ORIGINS.includes(origin) || isVercel ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
}
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const uid = () => (crypto as any).randomUUID ? (crypto as any).randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`

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
    const { meetingId, appOrigin } = await req.json()
    const admin = createClient(URLV, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })
    const { data: meeting } = await admin.from('meetings').select('id, client_id, title, date, time, pautas, participants').eq('id', meetingId).maybeSingle()
    if (!meeting) return json({ error: 'Reunião não encontrada.' }, 404)
    const cid = meeting.client_id
    if (role !== 'SuperAdmin' && cid !== homeClient && !secClients.includes(cid)) return json({ error: 'Sem permissão para esta empresa.' }, 403)

    // garante uid em cada pauta (link/token estável)
    let changed = false
    const pautas = (Array.isArray(meeting.pautas) ? meeting.pautas : []).map((p: any) => { if (!p.uid) { changed = true; return { ...p, uid: uid() } } return p })
    if (changed) await admin.from('meetings').update({ pautas }).eq('id', meeting.id)

    // e-mail dos participantes internos por nome
    const emailByName = new Map<string, string>()
    for (const pt of (meeting.participants || [])) { if (pt?.name && pt?.email && !pt.isExternal && !emailByName.has(pt.name)) emailByName.set(pt.name, pt.email) }

    // agrupa pautas por responsável (ignora intervalos e sem responsável)
    const byResp = new Map<string, any[]>()
    for (const p of pautas) { if (p.type === 'intervalo' || !p.resp) continue; if (!byResp.has(p.resp)) byResp.set(p.resp, []); byResp.get(p.resp)!.push(p) }
    if (byResp.size === 0) return json({ error: 'Nenhuma pauta com responsável definido.' }, 400)

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const origin = (typeof appOrigin === 'string' && /^https?:\/\//.test(appOrigin)) ? appOrigin.replace(/\/$/, '') : 'https://conselho.inepadconsulting.com'
    const exp = Date.now() + 21 * 24 * 60 * 60 * 1000
    const cleanTitle = String(meeting.title || 'Reunião do Conselho').replace(/[\r\n\t]+/g, ' ').trim()

    let sent = 0; const skipped: string[] = []; const failed: string[] = []
    for (const [resp, lista] of byResp) {
      const email = emailByName.get(resp)
      if (!email) { skipped.push(resp); continue }
      const token = await signToken({ k: 'pautamat', m: meeting.id, r: resp, exp })
      const link = `${origin}/?pautamat=${encodeURIComponent(token)}`
      const itens = lista.map((p: any) => `<li style="margin:6px 0;"><b>${esc(p.title)}</b>${p.tema ? ` <span style="color:#64748b;font-size:12px;">· ${esc(p.tema)}</span>` : ''}${(p.materiais || []).length ? ` <span style="color:#059669;font-size:11px;">(${(p.materiais || []).length} já enviado(s))</span>` : ''}</li>`).join('')
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <div style="background:#0f172a;padding:28px;text-align:center;border-bottom:4px solid #b45309;">
            <img src="https://conselho.inepadconsulting.com/boardplan-logo-email.png" alt="Boardplan" style="height:34px;" />
          </div>
          <div style="padding:36px;color:#1e293b;">
            <h2 style="color:#b45309;font-style:italic;margin:0 0 4px;">Envio de materiais das suas pautas</h2>
            <p style="font-size:15px;font-weight:bold;margin:0;">${esc(cleanTitle)}</p>
            <p style="font-size:13px;color:#64748b;">${esc(meeting.date || 'S/D')}${meeting.time ? ' às ' + esc(meeting.time) : ''}</p>
            <p style="font-size:14px;">Olá, <b>${esc(resp)}</b>. Você é responsável pelas pautas abaixo. Anexe os materiais de apoio de cada uma:</p>
            <ul style="font-size:14px;padding-left:18px;">${itens}</ul>
            <div style="text-align:center;margin:32px 0 8px;">
              <a href="${esc(link)}" style="background:#b45309;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;display:inline-block;">Enviar materiais</a>
            </div>
            <p style="text-align:center;font-size:11px;color:#94a3b8;">Você também pode anexar diretamente na plataforma, na aba Ordem do Dia. Este link é individual e expira por segurança.</p>
          </div>
        </div>`
      if (RESEND_API_KEY) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({ from: 'Governança INEPAD <conselho@inepadconsulting.com>', to: email, subject: `Materiais das suas pautas: ${cleanTitle.substring(0, 60)}`, html }),
        })
        if (res.ok) sent++; else { failed.push(resp) }
      } else failed.push(resp)
    }
    return json({ success: true, sent, skipped, failed })
  } catch (e: any) {
    return json({ error: e?.message || 'Erro inesperado.' }, 400)
  }
})
