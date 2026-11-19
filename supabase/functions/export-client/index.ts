import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ─────────────────────────────────────────────────────────────────────────────
// export-client — exportação completa dos dados de um cliente (saída/portabilidade).
// Só SuperAdmin. Devolve um JSON com:
//   • data: { tabela: [linhas...] } — tudo que tem client_id (via export_client_data)
//   • files: [{ bucket, path, url }] — links (7 dias) para baixar os arquivos do
//     cliente no Storage, descobertos a partir das URLs/paths salvos nos próprios
//     dados (meeting-files, client-logos) + gravações de CRM (crm-recordings).
// Formatos abertos (JSON + arquivos originais), sem lock-in.
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const SIGNED_TTL = 60 * 60 * 24 * 7 // 7 dias

// Varre recursivamente o JSON e coleta paths de arquivos do Storage a partir das
// URLs salvas (assinadas ou públicas). Os caminhos no meeting-files são
// inconsistentes, então extraímos da própria referência, não listando o bucket.
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
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser()
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  // Só SuperAdmin exporta dados de um cliente.
  if ((user.app_metadata as any)?.role !== 'SuperAdmin') {
    return json({ error: 'Apenas SuperAdmin pode exportar dados de clientes.' }, 403)
  }

  try {
    const { client_id } = await req.json()
    const cid = typeof client_id === 'string' ? client_id.trim() : ''
    if (!cid) return json({ error: 'client_id é obrigatório.' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1) Dump estruturado (todas as tabelas com client_id)
    const { data: dump, error: dumpErr } = await admin.rpc('export_client_data', { cid })
    if (dumpErr) return json({ error: 'Falha ao exportar os dados: ' + dumpErr.message }, 500)
    const data = (dump ?? {}) as Record<string, any[]>

    // 2) Descobre os arquivos do Storage a partir das referências nos dados
    const meetingFiles = new Set<string>()
    const clientLogos = new Set<string>()
    collectFromUrls(data, meetingFiles, clientLogos)

    // crm-recordings: o caminho fica cru em crm_activities.recording_path
    const crmRecordings = new Set<string>()
    for (const act of (data.crm_activities ?? [])) {
      if (act?.recording_path) crmRecordings.add(String(act.recording_path))
    }
    // rede de segurança: lista também por prefixo <client_id>/ nos buckets de CRM
    for (const bucket of ['crm-recordings', 'crm-attachments']) {
      try {
        const { data: listed } = await admin.storage.from(bucket).list(cid, { limit: 1000 })
        for (const f of listed ?? []) {
          if (f?.name && !f.name.endsWith('/')) {
            if (bucket === 'crm-recordings') crmRecordings.add(`${cid}/${f.name}`)
          }
        }
      } catch { /* bucket pode não existir neste ambiente */ }
    }

    // 3) Gera links de download (assinados) para cada arquivo
    const files: { bucket: string; path: string; url: string | null }[] = []

    const signMany = async (bucket: string, paths: string[]) => {
      for (const path of paths) {
        try {
          const { data: s } = await admin.storage.from(bucket).createSignedUrl(path, SIGNED_TTL)
          files.push({ bucket, path, url: s?.signedUrl ?? null })
        } catch {
          files.push({ bucket, path, url: null })
        }
      }
    }
    await signMany('meeting-files', [...meetingFiles])
    await signMany('crm-recordings', [...crmRecordings])
    // client-logos é bucket público → URL pública permanente
    for (const path of clientLogos) {
      const { data: pub } = admin.storage.from('client-logos').getPublicUrl(path)
      files.push({ bucket: 'client-logos', path, url: pub?.publicUrl ?? null })
    }

    // Contagem por tabela (resumo)
    const counts: Record<string, number> = {}
    for (const k of Object.keys(data)) counts[k] = Array.isArray(data[k]) ? data[k].length : 0

    // Log de auditoria (best-effort)
    try {
      await admin.from('audit_logs').insert([{
        username: (user.user_metadata as any)?.name || user.email || 'SuperAdmin',
        action: 'Exportação de dados',
        details: `Exportação completa do cliente ${cid} (${files.length} arquivo(s))`,
        client_id: cid,
      }])
    } catch { /* silencioso */ }

    return json({
      client_id: cid,
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      note: 'Dados em formato aberto (JSON). Os arquivos têm link válido por 7 dias.',
      counts,
      files,
      data,
    })
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500)
  }
})
