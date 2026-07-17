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
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Identifica o solicitante a partir do JWT
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Somente SuperAdmin pode excluir empresas
  const role = (user.app_metadata as any)?.role
  const callerClientId = (user.app_metadata as any)?.client_id
  if (role !== 'SuperAdmin') {
    return new Response(JSON.stringify({ error: 'Apenas SuperAdmin pode excluir empresas.' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { client_id } = await req.json()
    if (!client_id || typeof client_id !== 'string') {
      return new Response(JSON.stringify({ error: 'client_id é obrigatório.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // Trava de segurança: não permite excluir a própria empresa do SuperAdmin
    if (client_id === callerClientId) {
      return new Response(JSON.stringify({ error: 'Você não pode excluir a própria empresa.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1) Remove os logins (auth.users) dos membros desta empresa
    const { data: members } = await supabaseAdmin
      .from('members').select('id, name').eq('client_id', client_id)
    let deletedAuth = 0
    for (const m of members ?? []) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(m.id)
      if (!delErr) deletedAuth++
      else console.error(`[delete-client] Falha ao remover login ${m.id}:`, delErr.message)
    }

    // 2) Remove os registros de membros
    const { count: membersCount } = await supabaseAdmin
      .from('members').delete({ count: 'exact' }).eq('client_id', client_id)

    // 3) Remove as reuniões (inclui pautas/atas/deliberações em jsonb)
    const { count: meetingsCount } = await supabaseAdmin
      .from('meetings').delete({ count: 'exact' }).eq('client_id', client_id)

    // 4) Remove o registro do cliente
    const { error: clientErr } = await supabaseAdmin
      .from('clients').delete().eq('client_id', client_id)
    if (clientErr) throw new Error('Erro ao remover o cliente: ' + clientErr.message)

    // Observação: audit_logs e server_audit_logs NÃO são apagados — são trilhas
    // imutáveis por design (mantêm o histórico mesmo após o encerramento da conta).

    const summary = `${meetingsCount ?? 0} reuniões, ${membersCount ?? 0} membros e ${deletedAuth} login(s) removidos.`
    console.log(`[delete-client] Empresa ${client_id} excluída por ${user.email}. ${summary}`)

    return new Response(JSON.stringify({ success: true, summary }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
