import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Anthropic from "npm:@anthropic-ai/sdk"

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const SYSTEM_PROMPT = `Você é secretário(a) de governança corporativa, especialista em preparar a ORDEM DO DIA de reuniões de Conselhos Deliberativos e Consultivos no Brasil.

Tarefa: a partir das PENDÊNCIAS reais do conselho (ações do plano de ação, indicadores fora da meta, deliberações não concluídas e pontos não resolvidos da última reunião), redigir uma ordem do dia profissional, consolidada e bem sequenciada para a PRÓXIMA reunião.

DIRETRIZES:
1. Português do Brasil, tom formal e objetivo de pauta de conselho. Títulos claros e acionáveis (comece por um substantivo de ação quando possível: "Aprovação...", "Acompanhamento...", "Deliberação sobre...", "Análise...").
2. CONSOLIDE — não faça uma linha por pendência. Agrupe temas relacionados num único item (ex.: várias ações atrasadas viram um item "Acompanhamento das ações em atraso do plano"). Cite 1–2 exemplos-chave entre parênteses quando ajudar a orientar.
3. SEQUENCIE com lógica de conselho: abertura e verificação de quórum → aprovação da ata da reunião anterior → itens de acompanhamento → deliberações a concluir → temas estratégicos (indicadores/objetivos) → encaminhamentos e encerramento.
4. Proponha uma DURAÇÃO em minutos realista por item (abertura ~5; acompanhamento ~10–15; deliberação ~15–20; encerramento ~5).
5. Escreva um OBJETIVO curto (1 frase) por item — o que se espera decidir ou encaminhar. Deixe vazio ("") para itens meramente formais (abertura, aprovação de ata, encerramento).
6. NÃO invente pendências que não foram informadas — baseie-se apenas no que foi recebido. Se vierem poucas ou nenhuma pendência, produza uma pauta-padrão enxuta de conselho.
7. Entre 6 e 12 itens no total. Seja conciso; nada de encher a pauta.`

const SCHEMA = {
  type: 'object',
  properties: {
    pauta: {
      type: 'array',
      description: 'Itens da ordem do dia, na ordem em que devem ocorrer.',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título do item da pauta.' },
          duracao_min: { type: 'integer', description: 'Duração estimada em minutos.' },
          objetivo: { type: 'string', description: 'Objetivo/encaminhamento esperado, 1 frase. Vazio se meramente formal.' },
        },
        required: ['titulo', 'duracao_min', 'objetivo'],
        additionalProperties: false,
      },
    },
  },
  required: ['pauta'],
  additionalProperties: false,
}

serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  // ── Autenticação + papel ──
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  const authClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: aerr } = await authClient.auth.getUser()
  if (aerr || !user) return json({ error: 'Unauthorized' }, 401)

  const role = (user.app_metadata as any)?.role ?? ''
  const homeClient = (user.app_metadata as any)?.client_id ?? null
  const secClients: string[] = Array.isArray((user.app_metadata as any)?.secretary_clients) ? (user.app_metadata as any).secretary_clients : []
  if (!['Administrador', 'Secretário', 'SuperAdmin'].includes(role)) {
    return json({ error: 'Apenas Administrador e Secretário podem redigir a pauta.' }, 403)
  }

  try {
    const { clientId, context, grupos } = await req.json()
    const cid = String(clientId || '')
    if (!cid) return json({ error: 'Cliente não informado.' }, 400)
    const tenantOk = role === 'SuperAdmin' || cid === homeClient || secClients.includes(cid)
    if (!tenantOk) return json({ error: 'Sem permissão para este cliente.' }, 403)

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) return json({ error: 'IA não configurada (ANTHROPIC_API_KEY ausente).' }, 500)

    // ── Monta o contexto das pendências ──
    const gs: any[] = Array.isArray(grupos) ? grupos : []
    const pend = gs
      .filter((g) => Array.isArray(g?.itens) && g.itens.length)
      .map((g) => `## ${g.label}\n${g.itens.map((i: string) => `- ${i}`).join('\n')}`)
      .join('\n\n') || '(sem pendências registradas — produza uma pauta-padrão enxuta de conselho)'

    const ctx = context || {}
    const userContent = `PRÓXIMA REUNIÃO: ${ctx.title || 'Reunião do Conselho'}${ctx.date ? ` — ${ctx.date}` : ''}${ctx.type ? ` (${ctx.type})` : ''}

PENDÊNCIAS REAIS DO CONSELHO (base para a ordem do dia):
${pend}`

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 6000,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: userContent }],
    })
    const message = await stream.finalMessage()

    if (message.stop_reason === 'refusal') return json({ error: 'O modelo recusou processar este conteúdo.' }, 422)
    const textBlock: any = message.content.find((b: any) => b.type === 'text')
    if (!textBlock?.text) return json({ error: 'Resposta vazia da IA.' }, 502)

    let parsed: any
    try { parsed = JSON.parse(textBlock.text) } catch { return json({ error: 'A IA devolveu um formato inesperado.' }, 502) }

    const pauta = (Array.isArray(parsed?.pauta) ? parsed.pauta : [])
      .map((it: any) => ({
        titulo: String(it?.titulo || '').trim(),
        duracao_min: Math.max(1, Math.min(120, parseInt(it?.duracao_min) || 10)),
        objetivo: String(it?.objetivo || '').trim(),
      }))
      .filter((it: any) => it.titulo)

    if (pauta.length === 0) return json({ error: 'A IA não conseguiu redigir a pauta.' }, 502)

    const inTok = message.usage?.input_tokens ?? 0
    const outTok = message.usage?.output_tokens ?? 0
    const costUsd = Number((inTok * 5 / 1_000_000 + outTok * 25 / 1_000_000).toFixed(4)) // opus-4-8: $5/$25 por 1M

    // Auditoria + registro de consumo de IA (silenciosos se falharem)
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })
    try {
      await admin.from('audit_logs').insert([{
        username: (user.user_metadata as any)?.name || user.email || 'Sistema',
        action: 'Pauta (IA)',
        details: `Pauta redigida pela IA (${pauta.length} itens) para "${ctx.title || 'reunião'}".`,
        client_id: cid,
      }])
    } catch (_) { /* silencioso */ }
    try {
      await admin.from('ai_usage').insert([{
        client_id: cid, feature: 'pauta', model: 'claude-opus-4-8',
        input_tokens: inTok, output_tokens: outTok, cost_usd: costUsd,
      }])
    } catch (_) { /* silencioso */ }

    return json({ pauta, usage: { input_tokens: inTok, output_tokens: outTok } })
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500)
  }
})
