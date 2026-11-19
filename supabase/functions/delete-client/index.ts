import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ─────────────────────────────────────────────────────────────────────────────
// delete-client — exclusão DEFINITIVA de um cliente (cancelamento/LGPD). Só SuperAdmin.
// Apaga: logins (auth.users), TODOS os dados do cliente (via purge_client_data —
// toda tabela com client_id, não só members/meetings), os arquivos do Storage
// (meeting-files, client-logos, crm-recordings, crm-attachments) e, por fim, o
// registro em clients. NÃO apaga audit_logs/server_audit_logs (trilha imutável).
// ─────────────────────────────────────────────────────────────────────────────

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

// Coleta paths de arquivos do Storage a partir das URLs salvas nos dados.
function collectFromUrls(node: unknown, meetingFiles: Set<string>, clientLogos: Set<string>) {
  if (node == null) return
  if (typeof node === 'string') {
    const mf = node.match(/\/(?:sign|public)\/meeting-files\/([^?"'\s\\]+)/)
    if (mf) { try { meetingFiles.add(decodeURIComponent(mf[1])) } catch { meetingFiles.add(mf[1]) } }
    const cl = node.match(/\/(?:sign|public)\/client-logos\/([^?"'\s\\]+)/)
    if (cl) { try { clientLogos.add(decodeURIComponent(cl[1])) } catch { clientLogos.add(cl[1]) } }
    return
  }
  if (Array.isArray(node)) { for (const v of node) collectFromUrls(v, meetingFiles, clientLogos); return }
  if (typeof node === 'object') {
    for (const k of Object.keys(node as Record<string, unknown>)) {
      collectFromUrls((node as Record<string, unknown>)[k], meetingFiles, clientLogos)
    }
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  // Identifica o solicitante a partir do JWT
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  // Somente SuperAdmin pode excluir empresas
  const role = (user.app_metadata as any)?.role
  const callerClientId = (user.app_metadata as any)?.client_id
  if (role !== 'SuperAdmin') return json({ error: 'Apenas SuperAdmin pode excluir empresas.' }, 403)

  try {
    const { client_id } = await req.json()
    const cid = typeof client_id === 'string' ? client_id.trim() : ''
    if (!cid) return json({ error: 'client_id é obrigatório.' }, 400)
    // Trava de segurança: não permite excluir a própria empresa do SuperAdmin
    if (cid === callerClientId) return json({ error: 'Você não pode excluir a própria empresa.' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1) Snapshot dos dados ANTES de apagar — p/ pegar ids de membros e refs de arquivos
    const { data: dump } = await admin.rpc('export_client_data', { cid })
    const data = (dump ?? {}) as Record<string, any[]>
    const memberIds: string[] = (data.members ?? []).map((m: any) => m.id).filter(Boolean)

    const meetingFiles = new Set<string>()
    const clientLogos = new Set<string>()
    collectFromUrls(data, meetingFiles, clientLogos)
    const crmRecordings = new Set<string>()
    for (const act of (data.crm_activities ?? [])) {
      if (act?.recording_path) crmRecordings.add(String(act.recording_path))
    }

    // 2) Remove os logins (auth.users) dos membros desta empresa
    let deletedAuth = 0
    for (const id of memberIds) {
      const { error: delErr } = await admin.auth.admin.deleteUser(id)
      if (!delErr) deletedAuth++
      else console.error(`[delete-client] Falha ao remover login ${id}:`, delErr.message)
    }

    // 3) Apaga TODOS os dados do cliente (toda tabela com client_id, menos clients + auditoria)
    const { data: purge, error: purgeErr } = await admin.rpc('purge_client_data', { cid })
    if (purgeErr) throw new Error('Erro ao apagar os dados: ' + purgeErr.message)

    // 4) Apaga os arquivos do Storage
    let removedFiles = 0
    const removeBatch = async (bucket: string, paths: string[]) => {
      if (paths.length === 0) return
      try {
        const { data: rm } = await admin.storage.from(bucket).remove(paths)
        removedFiles += (rm?.length ?? 0)
      } catch (e) { console.error(`[delete-client] Storage ${bucket}:`, (e as Error).message) }
    }
    await removeBatch('meeting-files', [...meetingFiles])
    await removeBatch('crm-recordings', [...crmRecordings])
    await removeBatch('client-logos', [...clientLogos])
    // rede de segurança: varre por prefixo <client_id>/ nos buckets de CRM e no logo
    for (const bucket of ['crm-recordings', 'crm-attachments', 'client-logos']) {
      try {
        const { data: listed } = await admin.storage.from(bucket).list(cid, { limit: 1000 })
        const paths = (listed ?? []).filter((f) => f?.name && !f.name.endsWith('/')).map((f) => `${cid}/${f.name}`)
        await removeBatch(bucket, paths)
      } catch { /* bucket pode não existir */ }
    }

    // 5) Remove o registro do cliente
    const { error: clientErr } = await admin.from('clients').delete().eq('client_id', cid)
    if (clientErr) throw new Error('Erro ao remover o cliente: ' + clientErr.message)

    // Observação: audit_logs e server_audit_logs NÃO são apagados (trilha imutável).
    const deleted = (purge as any)?.deleted ?? {}
    const totalRows = Object.values(deleted).reduce((a: number, b: any) => a + Number(b || 0), 0)
    const summary = `${totalRows} registro(s) em ${Object.keys(deleted).length} tabela(s), ${deletedAuth} login(s) e ${removedFiles} arquivo(s) removidos.`
    console.log(`[delete-client] Empresa ${cid} excluída por ${user.email}. ${summary}`)

    return json({ success: true, summary, deleted, remaining: (purge as any)?.remaining ?? [] })
  } catch (error: any) {
    return json({ error: error.message }, 400)
  }
})
