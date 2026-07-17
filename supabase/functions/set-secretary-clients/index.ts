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
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
  const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !caller) return json({ error: 'Unauthorized' }, 401)

  // Apenas SuperAdmin decide acesso entre clientes
  if ((caller.app_metadata as any)?.role !== 'SuperAdmin') return json({ error: 'Apenas SuperAdmin pode atribuir clientes.' }, 403)

  try {
    const { userId, clientIds } = await req.json()
    if (!userId || !Array.isArray(clientIds)) return json({ error: 'Parâmetros inválidos.' }, 400)
    const clean = [...new Set(clientIds.map((c: any) => String(c)).filter(Boolean))]

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: au } = await admin.auth.admin.getUserById(userId)
    if (!au?.user) return json({ error: 'Usuário não encontrado.' }, 404)
    const existingApp = (au.user.app_metadata as any) || {}
    const { error: authUpdErr } = await admin.auth.admin.updateUserById(userId, { app_metadata: { ...existingApp, secretary_clients: clean } })
    if (authUpdErr) return json({ error: 'Erro ao atualizar login: ' + authUpdErr.message }, 400)

    const { error: memErr } = await admin.from('members').update({ secretary_clients: clean }).eq('id', userId)
    if (memErr) return json({ error: 'Erro ao atualizar membro: ' + memErr.message }, 400)

    return json({ success: true, secretary_clients: clean })
  } catch (e: any) {
    return json({ error: e.message }, 400)
  }
})
