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

COMO A CONVERSA REALMENTE ACONTECE (leia com atenção):
Uma reunião de conselho é orgânica. Quase NUNCA alguém anuncia "agora vamos ao item 3 da pauta". Os assuntos simplesmente surgem, se misturam, voltam depois e são tratados fora de ordem. NÃO procure marcadores explícitos de pauta — eles não existem.

Seu trabalho é RECONHECER O ASSUNTO. Leia a transcrição inteira e pergunte-se, para cada item da ordem do dia: "de que trecho desta conversa este item está falando?". Faça a correspondência pelo TEMA, pelo vocabulário e pelo contexto — não por anúncio.
- Exemplo: o item "Aprovação do orçamento 2026" corresponde a qualquer trecho em que se fale de orçamento, números, cortes, investimento ou aprovação de valores — mesmo que a palavra "orçamento" apareça pouco e ninguém cite o item.
- Um assunto pode estar espalhado em vários momentos da reunião: junte tudo num resumo só.
- Se dois itens forem parecidos, use o mais específico; não repita o mesmo texto em ambos.

REGRAS OBRIGATÓRIAS:
1. Escreva em português do Brasil, no registro formal e impessoal de ata ("Discutiu-se...", "Ponderou-se...", "Foi apresentado...", "O conselho avaliou..."). Nunca em primeira pessoa.
2. NÃO atribua falas a pessoas nominalmente. O que exige atribuição (votos, responsáveis, presença) já está registrado no sistema e não deve ser repetido por você. Se for indispensável, refira-se ao papel ("a diretoria apresentou..."), nunca ao nome.
3. Baseie-se no que foi efetivamente dito. NÃO invente fatos, números ou decisões que não estão na transcrição — uma ata é documento legal. Mas atenção: relacionar um trecho ao item da pauta a que ele pertence NÃO é inventar — é o seu trabalho. Na dúvida entre resumir um trecho pertinente ou deixar o item vazio, RESUMA.
4. Devolva string vazia SOMENTE se o assunto daquele item realmente não aparecer em nenhum momento da transcrição. Devolver vazio para um item que foi discutido é um ERRO GRAVE — obriga o secretário a escrever tudo à mão.
5. Sintetize o que foi debatido: pontos levantados, dúvidas, argumentos e encaminhamentos. Não transcreva; resuma.
6. Seja conciso: 2 a 5 frases por item.
7. Não repita o título do item nem o resultado da votação — ambos já constam da ata.
8. Se a transcrição tiver trechos ininteligíveis, resuma o que deu para entender em vez de descartar o item inteiro.
9. Devolva um resumo para CADA item recebido, na mesma ordem, usando o índice informado.`

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

  const role = (user.app_metadata as any)?.role ?? ''
  const homeClient = (user.app_metadata as any)?.client_id ?? null
  const secClients: string[] = Array.isArray((user.app_metadata as any)?.secretary_clients) ? (user.app_metadata as any).secretary_clients : []
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
    // Arquivo binário (ex.: .docx do Teams) chega como lixo — barra antes de gastar tokens
    const amostra = transcript.slice(0, 4000)
    let ilegiveis = 0
    for (const ch of amostra) {
      const c = ch.codePointAt(0) ?? 0
      if (c === 0xFFFD || c < 9 || (c > 13 && c < 32)) ilegiveis++
    }
    if (ilegiveis / Math.max(amostra.length, 1) > 0.05) {
      return json({ error: 'O arquivo não parece ser texto (formatos como .docx e .pdf não são lidos). No Teams/Meet, baixe a transcrição como .vtt ou .txt.' }, 400)
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

    const inTok = message.usage?.input_tokens ?? 0
    const outTok = message.usage?.output_tokens ?? 0
    const costUsd = Number((inTok * 5 / 1_000_000 + outTok * 25 / 1_000_000).toFixed(4)) // opus-4-8: $5/$25 por 1M

    // Auditoria + registro de consumo de IA (silenciosos se falharem)
    try {
      await admin.from('audit_logs').insert([{
        username: (user.user_metadata as any)?.name || user.email || 'Sistema',
        action: 'Ata (IA)',
        details: `Rascunho de discussões gerado para "${meeting.title}": ${preenchidas} de ${pautas.length} item(ns).`,
        client_id: cid,
      }])
    } catch (_) { /* silencioso */ }
    try {
      await admin.from('ai_usage').insert([{
        client_id: cid, feature: 'ata', model: 'claude-opus-4-8',
        input_tokens: inTok, output_tokens: outTok, cost_usd: costUsd,
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
      // Diagnóstico: só quando nada foi preenchido, para saber se o texto chegou de fato
      ...(preenchidas === 0 ? {
        debug: {
          chars_transcricao: transcript.length,
          inicio_transcricao: transcript.slice(0, 300),
        },
      } : {}),
    })
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500)
  }
})
