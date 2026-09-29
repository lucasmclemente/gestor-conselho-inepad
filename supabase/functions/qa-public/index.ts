import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Q&A ao vivo — acesso PÚBLICO (sem login) via service role. Ações: info, submit, vote.
// A sessão é identificada por um code curto (do link/QR). Nenhum dado sensível é exposto.

const ALLOWED_ORIGINS = ['https://conselho.inepadconsulting.com', 'http://localhost:3000']
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const preview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || preview ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  const c = cors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: c })
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...c, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })

  try {
    const body = await req.json().catch(() => ({} as any))
    const action = body.action || 'info'
    const code = String(body.code || '').trim()
    if (!code) return json({ error: 'Sessão inválida.' }, 400)

    const { data: session } = await admin.from('qa_sessions').select('id, title, open, client_id, materials').eq('code', code).maybeSingle()
    if (!session) return json({ error: 'Sessão não encontrada.' }, 404)

    if (action === 'info') {
      const { data: qs } = await admin.from('qa_questions')
        .select('id, body, author_name, votes, status')
        .eq('session_id', session.id).neq('status', 'archived')
        .order('votes', { ascending: false }).order('created_at', { ascending: true }).limit(200)
      // Assina os materiais na hora (o caminho é guardado no banco; o link nunca "expira" para o público)
      const mats = Array.isArray(session.materials) ? session.materials : []
      const materials: any[] = []
      for (const m of mats) {
        if (m?.path) {
          const { data: signed } = await admin.storage.from('meeting-files').createSignedUrl(m.path, 60 * 60 * 6)
          if (signed?.signedUrl) materials.push({ name: m.name, url: signed.signedUrl })
        }
      }
      return json({ ok: true, title: session.title, open: session.open, questions: qs || [], materials })
    }

    if (action === 'submit') {
      if (!session.open) return json({ error: 'As perguntas desta sessão foram encerradas.' }, 403)
      const text = String(body.body || '').trim()
      if (text.length < 2) return json({ error: 'Escreva sua pergunta.' }, 400)
      if (text.length > 1000) return json({ error: 'Pergunta muito longa (máx. 1000 caracteres).' }, 400)
      const name = String(body.name || '').trim().slice(0, 80) || null
      const { error } = await admin.from('qa_questions').insert({ session_id: session.id, client_id: session.client_id, body: text, author_name: name })
      if (error) return json({ error: 'Erro ao enviar a pergunta.' }, 400)
      return json({ ok: true })
    }

    if (action === 'vote') {
      const qid = String(body.questionId || '')
      const device = String(body.deviceId || '').slice(0, 100)
      if (!qid || !device) return json({ error: 'Voto inválido.' }, 400)
      const { data: q } = await admin.from('qa_questions').select('id').eq('id', qid).eq('session_id', session.id).maybeSingle()
      if (!q) return json({ error: 'Pergunta não encontrada.' }, 404)
      const { data: existing } = await admin.from('qa_votes').select('device_id').eq('question_id', qid).eq('device_id', device).maybeSingle()
      let voted: boolean
      if (existing) { await admin.from('qa_votes').delete().eq('question_id', qid).eq('device_id', device); voted = false }
      else { await admin.from('qa_votes').insert({ question_id: qid, device_id: device }); voted = true }
      // recomputa o total a partir da tabela de votos (evita corrida)
      const { count } = await admin.from('qa_votes').select('*', { count: 'exact', head: true }).eq('question_id', qid)
      const votes = count || 0
      await admin.from('qa_questions').update({ votes }).eq('id', qid)
      return json({ ok: true, voted, votes })
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (e: any) {
    return json({ error: e.message }, 400)
  }
})
