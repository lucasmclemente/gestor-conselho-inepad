import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "../_shared/votetoken.ts"

const ALLOWED_ORIGINS = [
  'https://conselho.inepadconsulting.com',
  'http://localhost:3000',
]
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const isVercelPreview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || isVercelPreview ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

function deliberationApproved(d: any): boolean {
  const voters: string[] = d.voters || []
  const votes: Record<string, string> = d.votes || {}
  const favor = voters.filter((v) => votes[v] === 'Favor').length
  const contra = voters.filter((v) => votes[v] === 'Contra').length
  const voted = voters.filter((v) => votes[v]).length
  const allVoted = voters.length > 0 && voted === voters.length
  return allVoted && favor > contra
}

serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (b: object, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', SECRET, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    const { token, action, choice } = await req.json()
    const payload = await verifyToken(token || '')
    if (!payload) return json({ error: 'Link inválido ou expirado.' }, 401)

    const { data: meeting } = await admin.from('meetings').select('id, client_id, status, deliberacoes, acoes').eq('id', payload.m).maybeSingle()
    if (!meeting) return json({ error: 'Deliberação não encontrada.' }, 404)
    const delibs = [...(meeting.deliberacoes || [])]
    const idx = (payload.d != null) ? delibs.findIndex((x: any) => x.id === payload.d) : payload.di
    const delib = (idx >= 0 && idx < delibs.length) ? delibs[idx] : null
    if (!delib) return json({ error: 'Deliberação não encontrada.' }, 404)

    if (action === 'info') {
      return json({ ok: true, title: delib.title, voter: payload.v, currentVote: (delib.votes || {})[payload.v] || null })
    }

    if (action === 'cast') {
      // Trava de encerramento: reunião concluída não aceita mais votos
      if (meeting.status === 'Concluída') return json({ error: 'Votação encerrada — esta reunião já foi concluída.' }, 403)
      if (!['Favor', 'Contra', 'Abstenção'].includes(choice)) return json({ error: 'Opção inválida.' }, 400)
      if (!(delib.voters || []).includes(payload.v)) return json({ error: 'Você não está na lista de votantes desta deliberação.' }, 403)
      const votes = { ...(delib.votes || {}), [payload.v]: choice }
      let updatedDelib: any = { ...delib, votes }
      let acoes = meeting.acoes || []
      const wasGenerated = !!updatedDelib.actionGenerated
      if (deliberationApproved(updatedDelib) && !wasGenerated) {
        updatedDelib = { ...updatedDelib, actionGenerated: true }
        acoes = [...acoes, {
          id: Date.now(), title: updatedDelib.title, resps: [], resp: '', date: '',
          obs: `Gerada automaticamente a partir da deliberação aprovada em ${new Date().toLocaleDateString('pt-BR')}.`,
          status: 'Pendente', priority: 'Média', fromDeliberation: true,
        }]
      }
      delibs[idx] = updatedDelib
      const upd: any = updatedDelib.actionGenerated && !wasGenerated ? { deliberacoes: delibs, acoes } : { deliberacoes: delibs }
      const { error } = await admin.from('meetings').update(upd).eq('id', meeting.id)
      if (error) return json({ error: 'Erro ao registrar o voto.' }, 400)
      try { await admin.from('audit_logs').insert([{ username: payload.v, action: 'Votação (e-mail)', details: `Voto "${choice}" em: ${delib.title}`, client_id: meeting.client_id }]) } catch (_) { /* silencioso */ }
      return json({ ok: true, choice, title: delib.title })
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (e: any) {
    return json({ error: e.message }, 400)
  }
})
