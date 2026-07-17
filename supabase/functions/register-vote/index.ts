import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

// Mesma regra de resultado usada no app
function deliberationResult(d: any) {
  const voters: string[] = d.voters || []
  const votes: Record<string, string> = d.votes || {}
  const favor = voters.filter((v) => votes[v] === 'Favor').length
  const contra = voters.filter((v) => votes[v] === 'Contra').length
  const voted = voters.filter((v) => votes[v]).length
  const allVoted = voters.length > 0 && voted === voters.length
  if (allVoted && favor > contra) return 'APROVADA'
  return 'OUTRO'
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const role = (user.app_metadata as any)?.role
  const clientId = (user.app_metadata as any)?.client_id
  const callerName = (user.user_metadata as any)?.name
  const callerEmail = user.email
  const isSuper = role === 'SuperAdmin'

  try {
    const { meetingId, delibIndex, delibId, voteType } = await req.json()
    if (!meetingId || !['Favor', 'Contra', 'Abstenção'].includes(voteType)) {
      return new Response(JSON.stringify({ error: 'Parâmetros inválidos.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: meeting, error: mErr } = await admin.from('meetings').select('id, client_id, deliberacoes, acoes, participants').eq('id', meetingId).maybeSingle()
    if (mErr) throw new Error(mErr.message)
    if (!meeting) return new Response(JSON.stringify({ error: 'Reunião não encontrada.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (!isSuper && meeting.client_id !== clientId) return new Response(JSON.stringify({ error: 'Sem permissão.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const delibs = [...(meeting.deliberacoes || [])]
    const di = (delibId != null)
      ? delibs.findIndex((d: any) => d.id === delibId)
      : (typeof delibIndex === 'number' ? delibIndex : -1)
    if (di < 0 || di >= delibs.length) return new Response(JSON.stringify({ error: 'Deliberação não encontrada.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const delib = delibs[di]
    const voters: string[] = delib.voters || []
    // Resolve o nome do votante = quem está logado (registra apenas o próprio voto)
    let voterName: string | null = null
    if (callerName && voters.includes(callerName)) voterName = callerName
    else {
      const match = (meeting.participants || []).find((p: any) => p.email === callerEmail && voters.includes(p.name))
      voterName = match?.name ?? null
    }
    if (!voterName) return new Response(JSON.stringify({ error: 'Você não é um votante elegível desta deliberação.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const votes = { ...(delib.votes || {}), [voterName]: voteType }
    let updatedDelib: any = { ...delib, votes }

    // Aprovada -> vira ação (uma única vez)
    let newAcoes = meeting.acoes || []
    let generatedAction = false
    if (deliberationResult(updatedDelib) === 'APROVADA' && !updatedDelib.actionGenerated) {
      updatedDelib = { ...updatedDelib, actionGenerated: true }
      newAcoes = [...newAcoes, {
        id: Date.now(),
        title: updatedDelib.title,
        resps: [], resp: '', date: '',
        obs: `Gerada automaticamente a partir da deliberação aprovada em ${new Date().toLocaleDateString('pt-BR')}.`,
        status: 'Pendente', priority: 'Média', fromDeliberation: true,
      }]
      generatedAction = true
    }

    delibs[di] = updatedDelib
    const payload: any = generatedAction ? { deliberacoes: delibs, acoes: newAcoes } : { deliberacoes: delibs }
    const { error: upErr } = await admin.from('meetings').update(payload).eq('id', meetingId)
    if (upErr) throw new Error(upErr.message)

    return new Response(JSON.stringify({ success: true, deliberacoes: delibs, acoes: generatedAction ? newAcoes : meeting.acoes, generatedAction, voterName }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
