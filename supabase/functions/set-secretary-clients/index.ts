import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = [
  'https://conselho.inepadconsulting.com', 'https://app.boardplan.com.br',
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
    // clientIds = empresas em que o usuário atua (secretary_clients).
    // roles     = papel de GESTÃO por cliente  { clientId: papel }        (opcional)
    // boardSeats= assento no CONSELHO por cliente { clientId: deliberativo|consultivo } (opcional)
    // Compat: se roles/boardSeats não vierem, os mapas atuais são PRESERVADOS (front antigo só manda clientIds).
    const { userId, clientIds, roles, boardSeats } = await req.json()
    if (!userId || !Array.isArray(clientIds)) return json({ error: 'Parâmetros inválidos.' }, 400)

    // Papéis de gestão aceitos por cliente (SuperAdmin/Certificador/Comercial são globais → não entram aqui)
    const GOV_ROLES = ['Administrador', 'Secretário', 'Conselheiro', 'Conselheiro Consultivo', 'Controller', 'Diretor', 'Assistente']
    const SEATS = ['deliberativo', 'consultivo']
    const cleanMap = (obj: any, allowed: string[]): Record<string, string> => {
      const out: Record<string, string> = {}
      if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          const key = String(k); const val = String(v)
          if (key && allowed.includes(val)) out[key] = val
        }
      }
      return out
    }
    const hasRoles = roles !== undefined
    const hasSeats = boardSeats !== undefined
    const cleanRoles = hasRoles ? cleanMap(roles, GOV_ROLES) : null
    const cleanSeats = hasSeats ? cleanMap(boardSeats, SEATS) : null

    // Dar um papel/assento numa empresa IMPLICA acesso a ela → entra no secretary_clients
    // automaticamente (evita a pegadinha de dar o assento e esquecer de marcar o acesso).
    const seatRoleClients = [...Object.keys(cleanRoles || {}), ...Object.keys(cleanSeats || {})]
    const clean = [...new Set([...clientIds.map((c: any) => String(c)).filter(Boolean), ...seatRoleClients])]

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: au } = await admin.auth.admin.getUserById(userId)
    if (!au?.user) return json({ error: 'Usuário não encontrado.' }, 404)
    const existingApp = (au.user.app_metadata as any) || {}

    const appPatch: Record<string, unknown> = { ...existingApp, secretary_clients: clean }
    const memPatch: Record<string, unknown> = { secretary_clients: clean }
    if (hasRoles) { appPatch.client_roles = cleanRoles; memPatch.client_roles = cleanRoles }
    if (hasSeats) { appPatch.board_seats = cleanSeats; memPatch.board_seats = cleanSeats }

    const { error: authUpdErr } = await admin.auth.admin.updateUserById(userId, { app_metadata: appPatch })
    if (authUpdErr) return json({ error: 'Erro ao atualizar login: ' + authUpdErr.message }, 400)

    const { error: memErr } = await admin.from('members').update(memPatch).eq('id', userId)
    if (memErr) return json({ error: 'Erro ao atualizar membro: ' + memErr.message }, 400)

    return json({ success: true, secretary_clients: clean, client_roles: cleanRoles, board_seats: cleanSeats })
  } catch (e: any) {
    return json({ error: e.message }, 400)
  }
})
