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

const VALID_ROLES = ['Conselheiro', 'Assistente', 'Controller', 'Comercial', 'Secretário', 'Administrador', 'Certificador', 'SuperAdmin']

serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !caller) return json({ error: 'Unauthorized' }, 401)

  const callerRole = (caller.app_metadata as any)?.role
  const callerClient = (caller.app_metadata as any)?.client_id
  const callerSec = Array.isArray((caller.app_metadata as any)?.secretary_clients) ? (caller.app_metadata as any).secretary_clients : []
  const isSuper = callerRole === 'SuperAdmin'
  if (!['Administrador', 'SuperAdmin'].includes(callerRole)) return json({ error: 'Apenas Administrador/SuperAdmin podem alterar perfis.' }, 403)

  try {
    const { userId, newRole } = await req.json()
    if (!userId || !VALID_ROLES.includes(newRole)) return json({ error: 'Parâmetros inválidos.' }, 400)
    if (userId === caller.id) return json({ error: 'Você não pode alterar o próprio perfil.' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })

    // Carrega o membro alvo
    const { data: target } = await admin.from('members').select('id, name, client_id, role').eq('id', userId).maybeSingle()
    if (!target) return json({ error: 'Membro não encontrado.' }, 404)

    // Regras para Administrador (não-Super)
    if (!isSuper) {
      if (target.client_id !== callerClient && !callerSec.includes(target.client_id)) return json({ error: 'Sem permissão para este membro.' }, 403)
      if (target.role === 'SuperAdmin') return json({ error: 'Administrador não pode alterar um SuperAdmin.' }, 403)
      if (newRole === 'SuperAdmin') return json({ error: 'Administrador não pode promover a SuperAdmin.' }, 403)
      // Certificador é papel INEPAD (emite selos): criação/remoção só pelo SuperAdmin
      if (target.role === 'Certificador') return json({ error: 'Administrador não pode alterar um Certificador.' }, 403)
      if (newRole === 'Certificador') return json({ error: 'Apenas o SuperAdmin pode designar Certificadores.' }, 403)
    }

    // Atualiza o papel no Auth (app_metadata — segurança) preservando o restante
    const { data: au } = await admin.auth.admin.getUserById(userId)
    const existingApp = (au?.user?.app_metadata as any) || {}
    const { error: authUpdErr } = await admin.auth.admin.updateUserById(userId, { app_metadata: { ...existingApp, role: newRole } })
    if (authUpdErr) return json({ error: 'Erro ao atualizar login: ' + authUpdErr.message }, 400)

    // Atualiza a tabela members
    const { error: memErr } = await admin.from('members').update({ role: newRole }).eq('id', userId)
    if (memErr) return json({ error: 'Erro ao atualizar membro: ' + memErr.message }, 400)

    return json({ success: true })
  } catch (e: any) {
    return json({ error: e.message }, 400)
  }
})
