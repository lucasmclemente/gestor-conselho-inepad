import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com',
  'https://app.boardplan.com.br', 'http://localhost:3000']
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const isVercelPreview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || isVercelPreview ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
}

serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  // JWT obrigatório (usuário de governança do cliente)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  const authClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: aerr } = await authClient.auth.getUser()
  if (aerr || !user) return json({ error: 'Unauthorized' }, 401)

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) return json({ error: 'IA não configurada (GEMINI_API_KEY ausente).' }, 500)
    const { indicatorName, value, meta, unit, direction, fact, cause } = await req.json()

    const ctx = [
      `Indicador: ${indicatorName || 'N/D'}`,
      value != null ? `Realizado: ${value}${unit ? ' ' + unit : ''}` : '',
      meta != null ? `Meta: ${meta}${unit ? ' ' + unit : ''}` : '',
      direction ? `Direção: ${direction === 'lower_is_better' ? 'menor é melhor' : 'maior é melhor'}` : '',
      fact ? `Fato observado: ${fact}` : '',
      cause ? `Causa apontada: ${cause}` : '',
    ].filter(Boolean).join('\n')

    const prompt = `Você é consultor sênior de gestão estratégica da INEPAD (governança e sucessão empresarial). Um indicador estratégico não atingiu a meta. Com base no contexto, proponha UMA ação corretiva objetiva e executável por um conselho/gestão.

Contexto:
${ctx}

Retorne SOMENTE um JSON válido, sem texto adicional, no formato:
{ "title": "título curto e acionável da ação", "why": "por que esta ação (1 frase)", "how": "como executar em 1-2 frases práticas" }`

    const gres = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
    })
    if (!gres.ok) return json({ error: 'Erro na IA: ' + (await gres.text()) }, 502)
    const gdata = await gres.json()
    const text = gdata.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return json({ error: 'Resposta vazia da IA.' }, 502)
    let parsed: any = {}
    try { parsed = JSON.parse(text) } catch { parsed = { title: String(text).slice(0, 140), why: '', how: '' } }
    return json({ title: parsed.title || '', why: parsed.why || '', how: parsed.how || '' })
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500)
  }
})
