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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const role = (user.user_metadata as any)?.role
  const clientId = (user.user_metadata as any)?.client_id
  const secClients = Array.isArray((user.user_metadata as any)?.secretary_clients) ? (user.user_metadata as any).secretary_clients : []
  const isSuper = role === 'SuperAdmin'
  if (!['Administrador', 'SuperAdmin'].includes(role)) {
    return new Response(JSON.stringify({ error: 'Apenas Administrador/SuperAdmin podem remover membros.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const { userId } = await req.json()
    if (!userId) return new Response(JSON.stringify({ error: 'userId é obrigatório.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (userId === user.id) return new Response(JSON.stringify({ error: 'Você não pode remover a própria conta.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })

    // Autorização por cliente: Adm só remove do próprio client e não remove SuperAdmin
    const { data: target } = await admin.from('members').select('id, client_id, role').eq('id', userId).maybeSingle()
    if (target && !isSuper) {
      if (target.client_id !== clientId && !secClients.includes(target.client_id)) return new Response(JSON.stringify({ error: 'Sem permissão para remover este membro.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      if (target.role === 'SuperAdmin') return new Response(JSON.stringify({ error: 'Administrador não pode remover SuperAdmin.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    // Se não há linha em members (login órfão), só SuperAdmin pode limpar
    if (!target && !isSuper) return new Response(JSON.stringify({ error: 'Membro não encontrado.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Remove o login do Auth (libera o e-mail) e a linha em members
    const { error: authDelErr } = await admin.auth.admin.deleteUser(userId)
    if (authDelErr && !/not.*found/i.test(authDelErr.message)) {
      return new Response(JSON.stringify({ error: 'Erro ao remover login: ' + authDelErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    await admin.from('members').delete().eq('id', userId)

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
