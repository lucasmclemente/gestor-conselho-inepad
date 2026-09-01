import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "../_shared/votetoken.ts"

const esc = (s: string): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')

function html(body: string, status = 200): Response {
  const page = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Votação • Conselho INEPAD</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',system-ui,sans-serif}
    body{background:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:#fff;max-width:520px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)}
    .top{background:#0f172a;padding:22px;text-align:center;border-bottom:4px solid #b45309}
    .top .tag{color:#f59e0b;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
    .body{padding:32px}
    .prop{background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #b45309;border-radius:8px;padding:16px;margin:0 0 8px;font-style:italic;font-weight:700;color:#1e293b}
    .who{font-size:12px;color:#64748b;margin:14px 0 20px}
    .who b{color:#1e293b}
    .btns{display:flex;flex-direction:column;gap:10px}
    button{border:none;cursor:pointer;padding:16px;border-radius:10px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#fff;transition:opacity .15s}
    button:hover{opacity:.9}
    .favor{background:#059669}.contra{background:#dc2626}.abster{background:#64748b}
    .msg{text-align:center;padding:10px 0}
    .msg .ico{font-size:48px;margin-bottom:10px}
    .msg h2{color:#1e293b;font-size:20px;margin-bottom:8px}
    .msg p{color:#64748b;font-size:14px;line-height:1.6}
    .foot{text-align:center;font-size:10px;color:#94a3b8;padding:16px;border-top:1px solid #f1f5f9}
  </style></head><body><div class="card"><div class="top"><div class="tag">Votação de Deliberação • Conselho</div></div><div class="body">${body}</div><div class="foot">Boardplan • INEPAD Governança e Sucessão</div></div></body></html>`
  return new Response(page, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

function errorPage(msg: string): Response {
  return html(`<div class="msg"><div class="ico">⚠️</div><h2>Não foi possível abrir a votação</h2><p>${esc(msg)}</p></div>`, 400)
}

function deliberationApproved(d: any): boolean {
  const voters: string[] = d.voters || []
  const votes: Record<string, string> = d.votes || {}
  const favor = voters.filter((v) => votes[v] === 'Favor').length
  const contra = voters.filter((v) => votes[v] === 'Contra').length
  const voted = voters.filter((v) => votes[v]).length
  const allVoted = voters.length > 0 && voted === voters.length
  return allVoted && favor > contra
}

serve(async (req) => {
  const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', SECRET, { auth: { autoRefreshToken: false, persistSession: false } })
  const url = new URL(req.url)

  async function loadDelib(payload: any) {
    const { data: meeting } = await admin.from('meetings').select('id, client_id, deliberacoes, acoes').eq('id', payload.m).maybeSingle()
    if (!meeting) return { meeting: null, delib: null, idx: -1, delibs: [] as any[] }
    const delibs = [...(meeting.deliberacoes || [])]
    const idx = (payload.d != null) ? delibs.findIndex((x: any) => x.id === payload.d) : payload.di
    const delib = (idx >= 0 && idx < delibs.length) ? delibs[idx] : null
    return { meeting, delib, idx, delibs }
  }

  // GET → mostra a página de confirmação (NÃO registra voto — evita "pré-clique" de antivírus)
  if (req.method === 'GET') {
    const token = url.searchParams.get('token') || ''
    const payload = await verifyToken(token)
    if (!payload) return errorPage('Link inválido ou expirado.')
    const { delib } = await loadDelib(payload)
    if (!delib) return errorPage('Deliberação não encontrada.')
    const current = (delib.votes || {})[payload.v]
    const currentLine = current ? `<p class="who">Seu voto atual: <b>${esc(current)}</b>. Você pode alterá-lo abaixo.</p>` : ''
    return html(`
      <div class="prop">"${esc(delib.title)}"</div>
      <p class="who">Registrando o voto de <b>${esc(payload.v)}</b></p>
      ${currentLine}
      <form method="POST" action="">
        <input type="hidden" name="token" value="${esc(token)}"/>
        <div class="btns">
          <button class="favor" name="choice" value="Favor">👍 A Favor</button>
          <button class="contra" name="choice" value="Contra">👎 Contra</button>
          <button class="abster" name="choice" value="Abstenção">⊘ Abster-se</button>
        </div>
      </form>`)
  }

  // POST → registra o voto (só acontece com o clique do usuário no botão)
  if (req.method === 'POST') {
    const form = await req.formData()
    const token = String(form.get('token') || '')
    const choice = String(form.get('choice') || '')
    const payload = await verifyToken(token)
    if (!payload) return errorPage('Link inválido ou expirado.')
    if (!['Favor', 'Contra', 'Abstenção'].includes(choice)) return errorPage('Opção de voto inválida.')

    const { meeting, delib, idx, delibs } = await loadDelib(payload)
    if (!meeting || !delib) return errorPage('Deliberação não encontrada.')
    if (!(delib.voters || []).includes(payload.v)) return errorPage('Você não está na lista de votantes desta deliberação.')

    const votes = { ...(delib.votes || {}), [payload.v]: choice }
    let updatedDelib: any = { ...delib, votes }
    let acoes = meeting.acoes || []
    if (deliberationApproved(updatedDelib) && !updatedDelib.actionGenerated) {
      updatedDelib = { ...updatedDelib, actionGenerated: true }
      acoes = [...acoes, {
        id: Date.now(), title: updatedDelib.title, resps: [], resp: '', date: '',
        obs: `Gerada automaticamente a partir da deliberação aprovada em ${new Date().toLocaleDateString('pt-BR')}.`,
        status: 'Pendente', priority: 'Média', fromDeliberation: true,
      }]
    }
    delibs[idx] = updatedDelib
    const updatePayload: any = updatedDelib.actionGenerated && !delib.actionGenerated ? { deliberacoes: delibs, acoes } : { deliberacoes: delibs }
    const { error } = await admin.from('meetings').update(updatePayload).eq('id', meeting.id)
    if (error) return errorPage('Erro ao registrar o voto. Tente novamente.')

    try { await admin.from('audit_logs').insert([{ username: payload.v, action: 'Votação (e-mail)', details: `Voto "${choice}" em: ${delib.title}`, client_id: meeting.client_id }]) } catch (_) { /* silencioso */ }

    return html(`<div class="msg"><div class="ico">✅</div><h2>Voto registrado!</h2><p>Seu voto <b>"${esc(choice)}"</b> na deliberação<br/><i>"${esc(delib.title)}"</i><br/>foi registrado com sucesso.</p><p style="margin-top:14px;font-size:12px;">Você pode fechar esta página.</p></div>`)
  }

  return new Response('Method Not Allowed', { status: 405 })
})
