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

const ALLOWED_ROLES = ['Assistente', 'Secretário', 'Administrador', 'SuperAdmin']

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Identifica o solicitante pelo JWT
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  const role = (user.user_metadata as any)?.role
  const clientId = (user.user_metadata as any)?.client_id
  const callerName = (user.user_metadata as any)?.name || user.email
  if (!ALLOWED_ROLES.includes(role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  const isSuper = role === 'SuperAdmin'

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Busca a reunião e confirma que pertence ao client do solicitante
  async function getMeetingScoped(meetingId: string) {
    const { data, error } = await admin.from('meetings').select('id, client_id, materiais').eq('id', meetingId).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Reunião não encontrada.')
    if (!isSuper && data.client_id !== clientId) throw new Error('Sem permissão para esta reunião.')
    return data
  }

  try {
    const body = await req.json()
    const action = body.action

    // LISTAR — devolve apenas campos não sensíveis (sem deliberações/ações/pautas)
    if (action === 'list') {
      let q = admin.from('meetings').select('id, title, date, status, materiais')
      if (!isSuper) q = q.eq('client_id', clientId)
      const { data, error } = await q.order('date', { ascending: false })
      if (error) throw new Error(error.message)
      return new Response(JSON.stringify({ meetings: data || [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ADICIONAR material
    if (action === 'add') {
      const { meetingId, material } = body
      if (!meetingId || !material?.name || !material?.url) {
        return new Response(JSON.stringify({ error: 'Dados do material incompletos.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const meeting = await getMeetingScoped(meetingId)
      const newMat = {
        name: String(material.name),
        url: String(material.url),
        path: material.path ? String(material.path) : undefined,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.id,
        uploadedByName: callerName,
      }
      const materiais = [...(meeting.materiais || []), newMat]
      const { error } = await admin.from('meetings').update({ materiais }).eq('id', meetingId)
      if (error) throw new Error(error.message)
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // EXCLUIR material — Assistente só apaga o que ele mesmo subiu
    if (action === 'delete') {
      const { meetingId, path, url } = body
      if (!meetingId || (!path && !url)) {
        return new Response(JSON.stringify({ error: 'Identificação do material ausente.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const meeting = await getMeetingScoped(meetingId)
      const materiais = meeting.materiais || []
      const idx = materiais.findIndex((m: any) => (path && m.path === path) || (url && m.url === url))
      if (idx === -1) {
        return new Response(JSON.stringify({ error: 'Material não encontrado.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const target = materiais[idx]
      // Assistente só pode remover materiais que ele próprio enviou
      if (role === 'Assistente' && target.uploadedBy !== user.id) {
        return new Response(JSON.stringify({ error: 'Você só pode remover materiais enviados por você.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const updated = materiais.filter((_: any, i: number) => i !== idx)
      const { error } = await admin.from('meetings').update({ materiais: updated }).eq('id', meetingId)
      if (error) throw new Error(error.message)
      // Remove o arquivo do Storage (best-effort)
      if (target.path) { try { await admin.storage.from('meeting-files').remove([target.path]) } catch (_) { /* ignore */ } }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Ação inválida.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
