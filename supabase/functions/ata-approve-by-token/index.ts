import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyVoteToken } from "../_shared/votetoken.ts"

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com', 'http://localhost:3000']
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const preview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || preview ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Vary': 'Origin' }
}

const STATUSES = ['aprovada', 'ressalva', 'reprovada']

serve(async (req) => {
  const c = cors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: c })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...c, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', SECRET, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    const { token, action, choice, note } = await req.json()
    const payload = await verifyVoteToken(SECRET, token || '')
    if (!payload || payload.k !== 'ata') return json({ error: 'Link inválido ou expirado.' }, 401)

    const { data: meeting } = await admin.from('meetings').select('id, title, client_id, atas').eq('id', payload.m).maybeSingle()
    if (!meeting) return json({ error: 'Ata não encontrada.' }, 404)
    const atas = [...(meeting.atas || [])]
    const idx = atas.findIndex((a: any) => a.id === payload.a)
    if (idx < 0) return json({ error: 'Ata não encontrada.' }, 404)
    const ata = atas[idx]

    if (action === 'info') {
      // Gera um link fresco de download (o salvo pode ter expirado)
      let ataUrl = ata.url || null
      try {
        const m = /\/meeting-files\/(.+?)(\?|$)/.exec(ata.url || '')
        if (m && m[1]) {
          const { data } = await admin.storage.from('meeting-files').createSignedUrl(decodeURIComponent(m[1]), 60 * 60)
          if (data?.signedUrl) ataUrl = data.signedUrl
        }
      } catch { /* mantém a url salva */ }
      const approvals = ata.approvals || {}
      const notes = ata.approvalNotes || {}
      return json({
        ok: true, meetingTitle: meeting.title, ataName: ata.name, ataUrl,
        approver: payload.v, currentStatus: approvals[payload.v] || null, currentNote: notes[payload.v] || '',
      })
    }

    if (action === 'cast') {
      if (!STATUSES.includes(choice)) return json({ error: 'Opção inválida.' }, 400)
      if (!(ata.approvers || []).includes(payload.v)) return json({ error: 'Você não está na lista de aprovadores desta ata.' }, 403)
      if ((choice === 'ressalva' || choice === 'reprovada') && !String(note || '').trim()) return json({ error: 'Descreva o motivo para ressalva/reprovação.' }, 400)

      const approvals = { ...(ata.approvals || {}), [payload.v]: choice }
      const approvalNotes = { ...(ata.approvalNotes || {}), [payload.v]: String(note || '').trim() }
      const approvalAt = { ...(ata.approvalAt || {}), [payload.v]: new Date().toISOString() }
      atas[idx] = { ...ata, approvals, approvalNotes, approvalAt }
      const { error } = await admin.from('meetings').update({ atas }).eq('id', meeting.id)
      if (error) return json({ error: 'Erro ao registrar a aprovação.' }, 400)
      try { await admin.from('audit_logs').insert([{ username: payload.v, action: 'Aprovação de ata (e-mail)', details: `${choice} — ata "${ata.name}" (${meeting.title})`, client_id: meeting.client_id }]) } catch (_) { /* silencioso */ }
      return json({ ok: true, choice })
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (e: any) {
    return json({ error: e.message }, 400)
  }
})
