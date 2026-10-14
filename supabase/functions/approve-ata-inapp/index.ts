import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Aprovação de ata DENTRO da plataforma (conselheiro logado) — equivalente ao
// fluxo por e-mail (ata-approve-by-token), mas autenticado por JWT.
// A RLS de meetings só deixa Adm/Sec/Super gravar, por isso a escrita é via service role
// (após validar que o usuário logado é mesmo um aprovador da ata).

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com', 'http://localhost:3000']
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const preview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || preview ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
}
const STATUSES = ['aprovada', 'ressalva', 'reprovada']

serve(async (req) => {
  const c = cors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: c })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...c, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const URLV = Deno.env.get('SUPABASE_URL') ?? ''
  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Unauthorized' }, 401)
  const uc = createClient(URLV, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await uc.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)
  const role = (user.app_metadata as any)?.role ?? ''
  const homeClient = (user.app_metadata as any)?.client_id ?? null
  const secClients: string[] = Array.isArray((user.app_metadata as any)?.secretary_clients) ? (user.app_metadata as any).secretary_clients : []
  const myName = (user.user_metadata as any)?.name || user.email || ''
  const myEmail = (user.email || '').toLowerCase()

  try {
    const { meetingId, ataId, ataUrl, choice, note } = await req.json()
    if (!meetingId) return json({ error: 'Reunião não informada.' }, 400)
    const admin = createClient(URLV, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })
    const { data: meeting } = await admin.from('meetings').select('id, title, client_id, atas, participants').eq('id', meetingId).maybeSingle()
    if (!meeting) return json({ error: 'Reunião não encontrada.' }, 404)
    // Isolamento de tenant (conselheiro do próprio cliente; multi-empresa; Super)
    if (role !== 'SuperAdmin' && meeting.client_id !== homeClient && !secClients.includes(meeting.client_id)) return json({ error: 'Sem permissão para esta empresa.' }, 403)

    const atas = [...(meeting.atas || [])]
    const idx = atas.findIndex((a: any) => (ataId != null && a.id === ataId) || (ataUrl && a.url === ataUrl))
    if (idx < 0) return json({ error: 'Ata não encontrada.' }, 404)
    const ata = atas[idx]
    if (ata.approvalClosed) return json({ error: 'As aprovações desta ata foram encerradas pela secretaria.' }, 403)

    // Resolve o nome do aprovador: pelo nome do usuário OU por e-mail (via participantes)
    const approvers: string[] = ata.approvers || []
    const cands: string[] = [myName]
    for (const p of (meeting.participants || [])) { if (p?.email && String(p.email).toLowerCase() === myEmail && p?.name) cands.push(p.name) }
    const approverName = cands.find((n) => n && approvers.includes(n)) || null
    if (!approverName) return json({ error: 'Você não está na lista de aprovadores desta ata.' }, 403)

    if (choice === 'info') return json({ ok: true, approver: approverName, currentStatus: (ata.approvals || {})[approverName] || null })

    if (!STATUSES.includes(choice)) return json({ error: 'Opção inválida.' }, 400)
    if ((choice === 'ressalva' || choice === 'reprovada') && !String(note || '').trim()) return json({ error: 'Descreva o motivo para ressalva/reprovação.' }, 400)

    const approvals = { ...(ata.approvals || {}), [approverName]: choice }
    const approvalNotes = { ...(ata.approvalNotes || {}), [approverName]: String(note || '').trim() }
    const approvalAt = { ...(ata.approvalAt || {}), [approverName]: new Date().toISOString() }
    atas[idx] = { ...ata, approvals, approvalNotes, approvalAt }
    const { error } = await admin.from('meetings').update({ atas }).eq('id', meeting.id)
    if (error) return json({ error: 'Erro ao registrar a aprovação.' }, 400)
    try { await admin.from('audit_logs').insert([{ username: approverName, action: 'Aprovação de ata (plataforma)', details: `${choice} — ata "${ata.name}" (${meeting.title})`, client_id: meeting.client_id }]) } catch (_) { /* */ }
    return json({ ok: true, approver: approverName, choice })
  } catch (e: any) {
    return json({ error: e?.message || 'Erro inesperado.' }, 400)
  }
})
