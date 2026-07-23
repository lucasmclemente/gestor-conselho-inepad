import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts"
import Anthropic from "npm:@anthropic-ai/sdk"

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com', 'http://localhost:3000']
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const preview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || preview ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
}

const MAX_PDF_BYTES = 20 * 1024 * 1024 // 20 MB

const SYSTEM_PROMPT = `Você é um(a) especialista em governança corporativa que avalia a CONFORMIDADE de um documento aos seus requisitos mínimos.

REGRAS:
1. Você NÃO emite parecer jurídico nem julga a qualidade redacional. Avalia apenas se o documento CONTEMPLA cada requisito mínimo informado.
2. Para CADA requisito, classifique: "presente" (o documento trata do ponto de forma clara), "parcial" (menciona mas de forma incompleta/vaga) ou "ausente" (não trata). Dê uma evidência curta (referência ao trecho/cláusula, sem transcrever longamente).
3. Baseie-se SOMENTE no que está no documento. Se algo não aparece, é "ausente" — não presuma.
4. Ao final, proponha um NÍVEL de maturidade do instrumento (0 a 4) pela cobertura dos requisitos:
   - 0 (Inexistente): o documento não corresponde ao instrumento esperado.
   - 1 (Inicial): contempla poucos requisitos, de forma frágil.
   - 2 (Em estruturação): contempla parte relevante, com lacunas importantes.
   - 3 (Estruturado): contempla a maioria dos requisitos de forma adequada.
   - 4 (Referência): contempla praticamente todos os requisitos de forma robusta.
5. Escreva em português do Brasil, tom técnico e objetivo. A justificativa deve ser 2 a 4 frases.`

const SCHEMA = {
  type: 'object',
  properties: {
    requisitos: {
      type: 'array',
      description: 'Um resultado por requisito mínimo, na ordem recebida.',
      items: {
        type: 'object',
        properties: {
          requisito: { type: 'string' },
          status: { type: 'string', enum: ['presente', 'parcial', 'ausente'] },
          evidencia: { type: 'string', description: 'Evidência curta do documento (referência/observação).' },
        },
        required: ['requisito', 'status', 'evidencia'],
        additionalProperties: false,
      },
    },
    nivel_sugerido: { type: 'integer', description: 'Nível de maturidade do instrumento, 0 a 4.' },
    justificativa: { type: 'string' },
  },
  required: ['requisitos', 'nivel_sugerido', 'justificativa'],
  additionalProperties: false,
}

serve(async (req) => {
  const c = cors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: c })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...c, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  const authClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: aerr } = await authClient.auth.getUser()
  if (aerr || !user) return json({ error: 'Unauthorized' }, 401)

  const role = (user.app_metadata as any)?.role ?? ''
  const homeClient = (user.app_metadata as any)?.client_id ?? null
  const secClients: string[] = Array.isArray((user.app_metadata as any)?.secretary_clients) ? (user.app_metadata as any).secretary_clients : []
  if (!['Administrador', 'Secretário', 'SuperAdmin'].includes(role)) return json({ error: 'Sem permissão.' }, 403)

  try {
    const { clientId, criterionId, path } = await req.json()
    const cid = String(clientId || '')
    if (!cid || !criterionId || !path) return json({ error: 'Parâmetros ausentes.' }, 400)
    const tenantOk = role === 'SuperAdmin' || cid === homeClient || secClients.includes(cid)
    if (!tenantOk) return json({ error: 'Sem permissão para este cliente.' }, 403)
    // A pasta do arquivo tem que ser do próprio cliente (path: maturidade/<cid>/...)
    const seg = String(path).split('/')
    if (seg[0] !== 'maturidade' || seg[1] !== cid) return json({ error: 'Caminho de evidência inválido.' }, 400)

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) return json({ error: 'IA não configurada (ANTHROPIC_API_KEY ausente).' }, 500)

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: crit, error: cErr } = await admin.from('maturity_criteria').select('id, item, instrument, requirements').eq('id', criterionId).maybeSingle()
    if (cErr || !crit) return json({ error: 'Critério não encontrado.' }, 404)
    const requisitos: string[] = Array.isArray(crit.requirements) ? crit.requirements : []
    if (requisitos.length === 0) return json({ error: 'Este item não tem requisitos mínimos definidos.' }, 400)

    // Baixa o PDF do storage
    const { data: blob, error: dErr } = await admin.storage.from('meeting-files').download(path)
    if (dErr || !blob) return json({ error: 'Não foi possível ler o documento.' }, 404)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (bytes.byteLength > MAX_PDF_BYTES) return json({ error: `Documento muito grande (${Math.round(bytes.byteLength / 1024 / 1024)} MB). Limite ${MAX_PDF_BYTES / 1024 / 1024} MB.` }, 400)
    // Assinatura %PDF
    if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
      return json({ error: 'O arquivo não é um PDF. Envie o documento em PDF.' }, 400)
    }
    const b64 = encodeBase64(bytes)

    const userContent = `INSTRUMENTO ESPERADO: ${crit.instrument || crit.item}

REQUISITOS MÍNIMOS (avalie cada um, nesta ordem):
${requisitos.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Avalie o documento PDF em anexo contra esses requisitos.`

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } } as any,
        { type: 'text', text: userContent },
      ] }],
    })
    const message = await stream.finalMessage()
    if (message.stop_reason === 'refusal') return json({ error: 'O modelo recusou processar este documento.' }, 422)
    const textBlock: any = message.content.find((b: any) => b.type === 'text')
    if (!textBlock?.text) return json({ error: 'Resposta vazia da IA.' }, 502)
    let parsed: any
    try { parsed = JSON.parse(textBlock.text) } catch { return json({ error: 'A IA devolveu um formato inesperado.' }, 502) }

    const nivel = Math.max(0, Math.min(4, parseInt(parsed?.nivel_sugerido) || 0))
    const findings = Array.isArray(parsed?.requisitos) ? parsed.requisitos : []
    const justificativa = String(parsed?.justificativa || '').trim()

    // Grava o resultado na resposta do cliente (status 'avaliado' por IA; INEPAD valida depois)
    await admin.from('maturity_answers').upsert([{
      client_id: cid, criterion_id: criterionId,
      level: nivel, na: false, status: 'avaliado',
      ai_level: nivel, ai_findings: findings, ai_justification: justificativa, ai_assessed_at: new Date().toISOString(),
      updated_by: (user.user_metadata as any)?.name || user.email || 'IA',
      updated_at: new Date().toISOString(),
      validated_by: null, validated_at: null,
    }], { onConflict: 'client_id,criterion_id' })

    // Custo de IA
    const inTok = message.usage?.input_tokens ?? 0
    const outTok = message.usage?.output_tokens ?? 0
    try {
      await admin.from('ai_usage').insert([{
        client_id: cid, feature: 'evidencia', model: 'claude-opus-4-8',
        input_tokens: inTok, output_tokens: outTok,
        cost_usd: Number((inTok * 5 / 1_000_000 + outTok * 25 / 1_000_000).toFixed(4)),
      }])
    } catch (_) { /* silencioso */ }

    return json({ level: nivel, findings, justificativa, usage: { input_tokens: inTok, output_tokens: outTok } })
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500)
  }
})
