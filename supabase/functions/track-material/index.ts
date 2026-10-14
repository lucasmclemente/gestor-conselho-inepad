import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "../_shared/votetoken.ts"

// Rastreio de acesso a materiais. Dois modos:
//  • GET  ?t=<token>  → link do e-mail: registra quem abriu (identificado pelo token)
//    e REDIRECIONA (302) para uma signed URL fresca do arquivo.
//  • POST { meetingId, materialName } (JWT) → clique dentro do app (logado): registra e retorna ok.
// Escrita sempre via service role. Token k='matopen'.

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com', 'http://localhost:3000']
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const isVercel = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allow = ALLOWED_ORIGINS.includes(origin) || isVercel ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin' }
}

const URLV = Deno.env.get('SUPABASE_URL') ?? ''
const admin = () => createClient(URLV, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })

// Extrai o caminho do Storage de uma URL (assinada/pública) salva
function pathFromUrl(url: string): string | null {
  const m = String(url || '').match(/\/meeting-files\/(.+?)(?:\?|$)/)
  return m ? decodeURIComponent(m[1]) : null
}

function errorPage(msg: string): Response {
  return new Response(`<!doctype html><meta charset="utf-8"><div style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#334155"><h2 style="color:#b45309">Link indisponível</h2><p>${msg}</p><p><a href="https://conselho.inepadconsulting.com" style="color:#b45309">Acessar o portal</a></p></div>`, { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

serve(async (req) => {
  const h = cors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...h, 'Content-Type': 'application/json' } })
  const db = admin()

  try {
    // ── GET: link do e-mail (sem login) ──
    if (req.method === 'GET') {
      const t = new URL(req.url).searchParams.get('t') || ''
      const p = await verifyToken(t)
      if (!p || p.k !== 'matopen' || !p.m) return errorPage('Este link expirou. Acesse os materiais pelo portal.')
      const { data: meeting } = await db.from('meetings').select('id, client_id, materiais, pautas').eq('id', p.m).maybeSingle()
      if (!meeting) return errorPage('Reunião não encontrada.')
      // acha o caminho: do token (p.p) ou procurando o material pelo nome
      let path: string | null = p.p ? String(p.p) : null
      if (!path) {
        const all = [...(meeting.materiais || []), ...((meeting.pautas || []).flatMap((pt: any) => pt?.materiais || []))]
        const found = all.find((m: any) => m?.name === p.n)
        path = found ? pathFromUrl(found.url) : null
      }
      if (!path) return errorPage('Material não encontrado.')
      // registra o acesso
      try { await db.from('material_access_logs').insert({ client_id: meeting.client_id, meeting_id: meeting.id, material_name: p.n || null, user_name: p.u || null, user_email: p.e || null, source: 'email' }) } catch (_) { /* não bloqueia */ }
      const { data: signed } = await db.storage.from('meeting-files').createSignedUrl(path, 60 * 60) // 1h p/ o download
      if (!signed?.signedUrl) return errorPage('Não foi possível abrir o material.')
      return new Response(null, { status: 302, headers: { Location: signed.signedUrl } })
    }

    // ── POST: clique dentro do app (logado) ──
    if (req.method === 'POST') {
      const auth = req.headers.get('Authorization')
      if (!auth) return json({ error: 'Unauthorized' }, 401)
      const uc = createClient(URLV, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } })
      const { data: { user } } = await uc.auth.getUser()
      if (!user) return json({ error: 'Unauthorized' }, 401)
      const name = (user.user_metadata as any)?.name || user.email || ''
      const homeClient = (user.app_metadata as any)?.client_id ?? null
      const secClients: string[] = Array.isArray((user.app_metadata as any)?.secretary_clients) ? (user.app_metadata as any).secretary_clients : []
      const body = await req.json().catch(() => ({} as any))
      const meetingId = body.meetingId
      if (!meetingId) return json({ error: 'meetingId ausente.' }, 400)
      const { data: meeting } = await db.from('meetings').select('id, client_id').eq('id', meetingId).maybeSingle()
      if (!meeting) return json({ error: 'Reunião não encontrada.' }, 404)
      // só registra para membros do próprio tenant (evita ruído cross-tenant)
      const role = (user.app_metadata as any)?.role ?? ''
      if (role !== 'SuperAdmin' && meeting.client_id !== homeClient && !secClients.includes(meeting.client_id)) return json({ ok: false })
      try { await db.from('material_access_logs').insert({ client_id: meeting.client_id, meeting_id: meeting.id, material_name: String(body.materialName || '').slice(0, 300) || null, user_name: name, user_email: user.email, source: 'app' }) } catch (_) { /* */ }
      return json({ ok: true })
    }

    return json({ error: 'Method Not Allowed' }, 405)
  } catch (e: any) {
    return json({ error: e?.message || 'Erro inesperado.' }, 400)
  }
})
