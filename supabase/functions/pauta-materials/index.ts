import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "../_shared/votetoken.ts"

// Materiais por pauta — o responsável envia os documentos das SUAS pautas.
// Dois modos de acesso:
//   • por TOKEN (link do e-mail, sem login)
//   • por JWT (logado na plataforma; o próprio responsável, ou Adm/Sec/Super)
// Ações: 'info' (lista as pautas do responsável), 'signUpload' (URL de upload assinada
// p/ mandar o arquivo direto ao Storage — aguenta arquivos grandes) e 'confirm'
// (registra o material na pauta). Escrita sempre via service role (após autorizar).

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com', 'http://localhost:3000']
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const isVercel = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allow = ALLOWED_ORIGINS.includes(origin) || isVercel ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
}
const safe = (n: string) => (n || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(-90)

serve(async (req) => {
  const h = cors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...h, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const URLV = Deno.env.get('SUPABASE_URL') ?? ''
  const admin = createClient(URLV, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })

  try {
    const body = await req.json()
    const { action } = body

    // ── autorização: resolve reunião + de quem é (ou editor) ──
    let meetingId: string | null = null, allowResp: string | null = null, isEditor = false
    let jwtCtx: any = null
    if (body.token) {
      const p = await verifyToken(body.token)
      if (!p || p.k !== 'pautamat') return json({ error: 'Link inválido ou expirado.' }, 401)
      meetingId = p.m; allowResp = p.r
    } else {
      const auth = req.headers.get('Authorization')
      if (!auth) return json({ error: 'Unauthorized' }, 401)
      const uc = createClient(URLV, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } })
      const { data: { user } } = await uc.auth.getUser()
      if (!user) return json({ error: 'Unauthorized' }, 401)
      const role = (user.app_metadata as any)?.role ?? ''
      const homeClient = (user.app_metadata as any)?.client_id ?? null
      const secClients: string[] = Array.isArray((user.app_metadata as any)?.secretary_clients) ? (user.app_metadata as any).secretary_clients : []
      const name = (user.user_metadata as any)?.name || user.email || ''
      isEditor = ['Administrador', 'Secretário', 'SuperAdmin'].includes(role)
      allowResp = name
      meetingId = body.meetingId
      jwtCtx = { role, homeClient, secClients }
    }
    if (!meetingId) return json({ error: 'Reunião não informada.' }, 400)

    const { data: meeting } = await admin.from('meetings').select('id, client_id, title, date, time, pautas').eq('id', meetingId).maybeSingle()
    if (!meeting) return json({ error: 'Reunião não encontrada.' }, 404)
    if (jwtCtx && jwtCtx.role !== 'SuperAdmin' && meeting.client_id !== jwtCtx.homeClient && !jwtCtx.secClients.includes(meeting.client_id)) return json({ error: 'Sem permissão para esta empresa.' }, 403)

    const pautas: any[] = Array.isArray(meeting.pautas) ? meeting.pautas : []
    const mine = (p: any) => isEditor || (allowResp && p.resp === allowResp)
    const canTouch = (p: any) => p && p.type !== 'intervalo' && mine(p)

    if (action === 'info') {
      const list = pautas.filter(p => p.type !== 'intervalo' && mine(p)).map(p => ({ uid: p.uid || null, index: pautas.indexOf(p), title: p.title, dur: p.dur, tema: p.tema || '', materiais: (p.materiais || []).map((m: any) => ({ name: m.name })) }))
      return json({ meetingTitle: meeting.title, date: meeting.date, time: meeting.time, resp: allowResp, editor: isEditor, pautas: list })
    }

    // localiza a pauta alvo por uid (ou índice) e confere permissão
    const findIdx = () => {
      if (body.pautaUid) { const i = pautas.findIndex(p => p.uid === body.pautaUid); if (i >= 0) return i }
      if (Number.isInteger(body.pautaIndex)) return body.pautaIndex
      return -1
    }
    const idx = findIdx()
    if (idx < 0 || !canTouch(pautas[idx])) return json({ error: 'Pauta não encontrada ou sem permissão.' }, 403)

    if (action === 'signUpload') {
      const fileName = safe(String(body.fileName || 'arquivo'))
      const key = pautas[idx].uid || `i${idx}`
      const path = `pautas/${meeting.client_id}/${key}/${Date.now()}-${fileName}`
      const { data, error } = await admin.storage.from('meeting-files').createSignedUploadUrl(path)
      if (error || !data) return json({ error: 'Falha ao preparar upload: ' + (error?.message || '') }, 400)
      return json({ path: data.path, token: data.token })
    }

    if (action === 'confirm') {
      const path = String(body.path || '')
      if (!path.startsWith(`pautas/${meeting.client_id}/`)) return json({ error: 'Caminho inválido.' }, 400)
      const { data: signed } = await admin.storage.from('meeting-files').createSignedUrl(path, 60 * 60 * 24 * 7)
      const att = { name: String(body.fileName || 'arquivo'), url: signed?.signedUrl || '', uploadedAt: new Date().toISOString() }
      const next = [...pautas]
      next[idx] = { ...next[idx], materiais: [...(next[idx].materiais || []), att] }
      const { error } = await admin.from('meetings').update({ pautas: next }).eq('id', meeting.id)
      if (error) return json({ error: 'Erro ao registrar o material: ' + error.message }, 400)
      try { await admin.from('audit_logs').insert([{ username: allowResp || 'responsável', action: 'Materiais da Pauta', details: `Material "${att.name}" enviado para a pauta "${next[idx].title}"`, client_id: meeting.client_id }]) } catch (_) { /* */ }
      return json({ ok: true, materiais: (next[idx].materiais || []).map((m: any) => ({ name: m.name })) })
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (e: any) {
    return json({ error: e?.message || 'Erro inesperado.' }, 400)
  }
})
