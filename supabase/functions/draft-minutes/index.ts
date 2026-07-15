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

// Limite de segurança: ~100k tokens de transcrição (uma reunião de 2h dá ~40k)
const MAX_TRANSCRIPT_CHARS = 400_000

const SYSTEM_PROMPT = `Você é secretário(a) de governança corporativa, especialista em redigir atas de Conselhos Deliberativos e Consultivos no Brasil.

Sua tarefa: a partir da transcrição de uma reunião, redigir o RESUMO DA DISCUSSÃO de cada item da ordem do dia.

REGRAS OBRIGATÓRIAS:
1. Escreva em português do Brasil, no registro formal e impessoal de ata ("Discutiu-se...", "Ponderou-se...", "Foi apresentado...", "O conselho avaliou..."). Nunca em primeira pessoa.
2. NÃO atribua falas a pessoas nominalmente. O que exige atribuição (votos, responsáveis, presença) já está registrado no sistema e não deve ser repetido por você. Se for indispensável, refira-se ao papel ("a diretoria apresentou..."), nunca ao nome.
3. Baseie-se EXCLUSIVAMENTE na transcrição. Se um item da pauta não foi discutido, devolva string vazia para ele. NUNCA invente conteúdo — uma ata é documento legal.
4. Sintetize o que foi efetivamente debatido: pontos levantados, dúvidas, argumentos e encaminhamentos. Não transcreva; resuma.
5. Seja conciso: 2 a 5 frases por item.
6. Não repita o título do item nem o resultado da votação — ambos já constam da ata.
7. Se um trecho estiver ininteligível ou a transcrição for ruim, prefira omitir a especular.
8. Devolva um resumo para CADA item recebido, na mesma ordem, usando o índice informado.`

const SCHEMA = {
  type: 'object',
  properties: {
    resumos: {
      type: 'array',
      description: 'Um resumo por item da ordem do dia, na ordem recebida.',
      items: {
        type: 'object',
        properties: {
          indice: { type: 'integer', description: 'O índice do item da ordem do dia.' },
          discussao: { type: 'string', description: 'Resumo impessoal do que foi discutido. String vazia se o item não foi tratado na transcrição.' },
        },
        required: ['indice', 'discussao'],
        additionalProperties: false,
      },
    },
  },
  required: ['resumos'],
  additionalProperties: false,
}

// Calcula o resultado de uma deliberação (mesma regra do front)
function delibResumo(d: any): string {
  const voters: string[] = d.voters || []
  const votes: Record<string, string> = d.votes || {}
  const favor = voters.filter(v => votes[v] === 'Favor').length
  const contra = voters.filter(v => votes[v] === 'Contra').length
  const abst = voters.filter(v => votes[v] === 'Abstenção').length
  return `${favor} a favor, ${contra} contra, ${abst} abstenção(ões)`
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

  const role = (user.user_metadata as any)?.role ?? ''
  const homeClient = (user.user_metadata as any)?.client_id ?? null
  const secClients: string[] = Array.isArray((user.user_metadata as any)?.secretary_clients) ? (user.user_metadata as any).secretary_clients : []
  if (!['Administrador', 'Secretário', 'SuperAdmin'].includes(role)) {
    return json({ error: 'Apenas Administrador e Secretário podem rascunhar a ata.' }, 403)
  }

  try {
    const { meetingId, transcript } = await req.json()
    if (!meetingId || typeof transcript !== 'string' || transcript.trim().length < 200) {
      return json({ error: 'Envie a reunião e uma transcrição com conteúdo.' }, 400)
    }
    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      return json({ error: `Transcrição muito longa (${Math.round(transcript.length / 1000)}k caracteres). O limite é ${MAX_TRANSCRIPT_CHARS / 1000}k.` }, 400)
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) return json({ error: 'IA não configurada (ANTHROPIC_API_KEY ausente).' }, 500)

    // ── Carrega a reunião (service role) e valida o tenant ──
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: meeting, error: mErr } = await admin.from('meetings').select('id, client_id, title, date, pautas, participants, deliberacoes').eq('id', meetingId).maybeSingle()
    if (mErr) throw new Error(mErr.message)
    if (!meeting) return json({ error: 'Reunião não encontrada.' }, 404)
    const cid = meeting.client_id
    const tenantOk = role === 'SuperAdmin' || cid === homeClient || secClients.includes(cid)
    if (!tenantOk) return json({ error: 'Sem permissão para esta reunião.' }, 403)

    const pautas: any[] = meeting.pautas || []
    if (pautas.length === 0) return json({ error: 'Esta reunião não tem itens na ordem do dia.' }, 400)

    // ── Monta o contexto estruturado que o modelo NÃO precisa adivinhar ──
    const participantes = (meeting.participants || []).map((p: any) => p.name).filter(Boolean).join(', ')
    const itens = pautas.map((p: any, i: number) => `[${i}] ${p.title}${p.resp ? ` (apresentado por: ${p.resp})` : ''}`).join('\n')
    const delibs = (meeting.deliberacoes || []).length > 0
      ? (meeting.deliberacoes || []).map((d: any) => `- ${d.title}: ${delibResumo(d)}`).join('\n')
      : '(nenhuma)'

    const userContent = `REUNIÃO: ${meeting.title}${meeting.date ? ` — ${meeting.date}` : ''}
PARTICIPANTES: ${participantes || '(não informados)'}

ITENS DA ORDEM DO DIA (devolva um resumo para cada índice):
${itens}

DELIBERAÇÕES JÁ REGISTRADAS (contexto apenas — não repita na sua resposta):
${delibs}

TRANSCRIÇÃO DA REUNIÃO:
"""
${transcript}
"""`

    // ── Claude: saída estruturada garante um resumo por pauta ──
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: userContent }],
    })
    const message = await stream.finalMessage()

    if (message.stop_reason === 'refusal') {
      return json({ error: 'O modelo recusou processar este conteúdo.' }, 422)
    }
    const textBlock: any = message.content.find((b: any) => b.type === 'text')
    if (!textBlock?.text) return json({ error: 'Resposta vazia da IA.' }, 502)

    let parsed: any
    try { parsed = JSON.parse(textBlock.text) } catch { return json({ error: 'A IA devolveu um formato inesperado.' }, 502) }

    // Normaliza: um resumo por índice de pauta, sem estourar o array
    const resumos: Array<{ indice: number; discussao: string }> = Array.isArray(parsed?.resumos) ? parsed.resumos : []
    const notas: string[] = pautas.map((_, i) => {
      const r = resumos.find(x => Number(x.indice) === i)
      return (r?.discussao || '').trim()
    })
    const preenchidas = notas.filter(Boolean).length

    // Auditoria (silenciosa se falhar)
    try {
      await admin.from('audit_logs').insert([{
        username: (user.user_metadata as any)?.name || user.email || 'Sistema',
        action: 'Ata (IA)',
        details: `Rascunho de discussões gerado para "${meeting.title}": ${preenchidas} de ${pautas.length} item(ns).`,
        client_id: cid,
      }])
    } catch (_) { /* silencioso */ }

    return json({
      notas,
      preenchidas,
      total: pautas.length,
      usage: {
        input_tokens: message.usage?.input_tokens ?? 0,
        output_tokens: message.usage?.output_tokens ?? 0,
      },
    })
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500)
  }
})
