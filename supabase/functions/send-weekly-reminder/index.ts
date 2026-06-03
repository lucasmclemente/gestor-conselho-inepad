import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ── Helpers ───────────────────────────────────────────────────────

const escapeHtml = (str: string): string =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

function formatDate(dateStr: string): string {
  if (!dateStr) return 'S/D'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function daysDiff(dateStr: string, today: Date): number {
  const target = new Date(dateStr + 'T00:00:00')
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function buildActionCard(a: any, urgency: 'overdue' | 'near' | 'normal'): string {
  const cfg = {
    overdue: {
      bg: '#fef2f2', border: '#fecaca', leftBar: '#ef4444',
      badgeBg: '#ef4444', badgeText: '🔴 EM ATRASO',
    },
    near: {
      bg: '#fffbeb', border: '#fde68a', leftBar: '#d97706',
      badgeBg: '#d97706', badgeText: '⚠️ VENCE EM BREVE',
    },
    normal: {
      bg: '#f8fafc', border: '#e2e8f0', leftBar: '#94a3b8',
      badgeBg: '#64748b', badgeText: 'PENDENTE',
    },
  }[urgency]

  return `
    <div style="background:${cfg.bg};border:1px solid ${cfg.border};border-left:4px solid ${cfg.leftBar};
                border-radius:8px;padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
        <p style="margin:0;font-size:13px;font-weight:bold;color:#1e293b;flex:1;">${escapeHtml(a.title)}</p>
        <span style="background:${cfg.badgeBg};color:#fff;font-size:9px;font-weight:bold;
                     padding:3px 8px;border-radius:100px;text-transform:uppercase;white-space:nowrap;">
          ${cfg.badgeText}
        </span>
      </div>
      <p style="margin:0;font-size:11px;color:#64748b;line-height:1.6;">
        <strong>Reunião:</strong> ${escapeHtml(a.meetingTitle)}
        ${a.date ? `&nbsp;|&nbsp;<strong>Prazo:</strong> <span style="font-weight:bold;color:${urgency === 'overdue' ? '#dc2626' : urgency === 'near' ? '#b45309' : '#475569'};">${formatDate(a.date)}</span>` : ''}
      </p>
      ${a.obs ? `<p style="margin:5px 0 0;font-size:10px;color:#94a3b8;font-style:italic;">Obs: ${escapeHtml(a.obs)}</p>` : ''}
    </div>
  `
}

function buildEmail(name: string, actions: any[]): string {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const in7 = new Date(today); in7.setDate(today.getDate() + 7)

  const overdue     = actions.filter(a => a.date && new Date(a.date + 'T00:00:00') < today)
  const nearDeadline = actions.filter(a => {
    if (!a.date) return false
    const d = new Date(a.date + 'T00:00:00')
    return d >= today && d <= in7
  })
  const normal = actions.filter(a => {
    if (!a.date) return true
    return new Date(a.date + 'T00:00:00') > in7
  })

  const allCards = [
    ...overdue.map(a => buildActionCard(a, 'overdue')),
    ...nearDeadline.map(a => buildActionCard(a, 'near')),
    ...normal.map(a => buildActionCard(a, 'normal')),
  ].join('')

  const total = actions.length
  const overdueCount = overdue.length
  const nearCount = nearDeadline.length

  // Alerta colorido no topo do e-mail
  const alertBg    = overdueCount > 0 ? '#fef2f2' : nearCount > 0 ? '#fffbeb' : '#f0fdf4'
  const alertBorder = overdueCount > 0 ? '#fecaca' : nearCount > 0 ? '#fde68a' : '#bbf7d0'
  const alertText  = overdueCount > 0
    ? `Você tem <strong>${overdueCount} ${overdueCount === 1 ? 'atividade' : 'atividades'} em atraso</strong>. Atenção imediata necessária.`
    : nearCount > 0
    ? `Você tem <strong>${nearCount} ${nearCount === 1 ? 'atividade' : 'atividades'} vencendo esta semana</strong>. Fique atento aos prazos.`
    : `Você tem <strong>${total} ${total === 1 ? 'atividade' : 'atividades'} em andamento</strong>. Continue o ótimo trabalho!`

  return `
    <div style="font-family:sans-serif;max-width:620px;margin:auto;border:1px solid #e2e8f0;
                border-radius:12px;overflow:hidden;background:#ffffff;">

      <!-- Cabeçalho -->
      <div style="background:#0f172a;padding:24px 30px;text-align:center;">
        <img src="https://jrtrrubtjbinnddqdbta.supabase.co/storage/v1/object/public/meeting-files/logo-sidebar.jpg"
             alt="INEPAD" style="height:32px;margin-bottom:10px;" />
        <p style="margin:0;color:#f59e0b;font-size:10px;font-weight:bold;text-transform:uppercase;
                  letter-spacing:2px;">Lembrete Semanal • Plano de Ação</p>
      </div>

      <!-- Corpo -->
      <div style="padding:30px;">

        <p style="font-size:16px;color:#1e293b;margin:0 0 6px;">
          Olá, <strong>${escapeHtml(name)}</strong>
        </p>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.6;">
          Este é o seu resumo semanal de atividades pendentes no Conselho.
        </p>

        <!-- Alerta de status -->
        <div style="background:${alertBg};border:1px solid ${alertBorder};border-radius:8px;
                    padding:14px 18px;margin-bottom:24px;font-size:13px;color:#1e293b;">
          ${alertText}
        </div>

        <!-- Contadores rápidos -->
        <div style="display:flex;gap:12px;margin-bottom:24px;">
          ${overdueCount > 0 ? `
          <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;
                      padding:14px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:900;color:#dc2626;">${overdueCount}</p>
            <p style="margin:4px 0 0;font-size:9px;font-weight:bold;text-transform:uppercase;
                      color:#dc2626;letter-spacing:1px;">Em Atraso</p>
          </div>` : ''}
          ${nearCount > 0 ? `
          <div style="flex:1;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
                      padding:14px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:900;color:#d97706;">${nearCount}</p>
            <p style="margin:4px 0 0;font-size:9px;font-weight:bold;text-transform:uppercase;
                      color:#d97706;letter-spacing:1px;">Vence Esta Semana</p>
          </div>` : ''}
          <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
                      padding:14px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:900;color:#475569;">${total}</p>
            <p style="margin:4px 0 0;font-size:9px;font-weight:bold;text-transform:uppercase;
                      color:#475569;letter-spacing:1px;">Total Pendente</p>
          </div>
        </div>

        <!-- Lista de atividades -->
        <h4 style="margin:0 0 12px;font-size:11px;font-weight:bold;text-transform:uppercase;
                   color:#64748b;letter-spacing:1px;border-bottom:1px solid #f1f5f9;padding-bottom:8px;">
          Suas atividades
        </h4>
        ${allCards}

        <!-- CTA -->
        <div style="text-align:center;margin-top:30px;">
          <a href="https://conselho.inepadconsulting.com"
             style="background:#0f172a;color:#fff;padding:13px 28px;text-decoration:none;
                    border-radius:8px;font-weight:bold;font-size:13px;display:inline-block;">
            Acessar o Painel →
          </a>
        </div>

        <p style="font-size:10px;color:#94a3b8;text-align:center;margin-top:24px;line-height:1.6;">
          Este e-mail é enviado automaticamente toda segunda-feira.<br/>
          Acesse o sistema para atualizar o status das suas atividades.
        </p>
      </div>
    </div>
  `
}

// ── Handler principal ─────────────────────────────────────────────

serve(async (req) => {
  // Só aceita POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Verifica o segredo do cron
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Cliente admin (service_role ignora RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Busca todos os membros para montar mapa nome→email por client_id
    const { data: members, error: membErr } = await supabaseAdmin
      .from('members')
      .select('name, email, client_id')

    if (membErr) throw new Error('Erro ao buscar membros: ' + membErr.message)

    // { client_id: { nome: email } }
    const nameToEmail: Record<string, Record<string, string>> = {}
    for (const m of members ?? []) {
      if (!nameToEmail[m.client_id]) nameToEmail[m.client_id] = {}
      if (m.name && m.email) nameToEmail[m.client_id][m.name] = m.email
    }

    // Busca todas as reuniões com ações
    const { data: meetings, error: meetErr } = await supabaseAdmin
      .from('meetings')
      .select('id, title, acoes, client_id')

    if (meetErr) throw new Error('Erro ao buscar reuniões: ' + meetErr.message)

    // Agrupa ações pendentes por e-mail do responsável
    // { email: { name, actions[] } }
    const byEmail: Record<string, { name: string; actions: any[] }> = {}

    for (const meeting of meetings ?? []) {
      const acoes: any[] = meeting.acoes ?? []
      const clientMap = nameToEmail[meeting.client_id] ?? {}

      for (const acao of acoes) {
        if (acao.status === 'Concluída') continue

        // Suporte ao campo resps[] (novo) e resp (legado)
        const resps: string[] = (acao.resps?.length > 0)
          ? acao.resps
          : acao.resp ? [acao.resp] : []

        for (const respName of resps) {
          const email = clientMap[respName]
          if (!email) continue // membro não encontrado, pula

          if (!byEmail[email]) byEmail[email] = { name: respName, actions: [] }
          byEmail[email].actions.push({
            id:           acao.id,
            title:        acao.title,
            date:         acao.date ?? null,
            status:       acao.status,
            obs:          acao.obs ?? '',
            meetingTitle: meeting.title,
          })
        }
      }
    }

    // Envia um e-mail por pessoa
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const results: { email: string; status: number }[] = []

    for (const [email, { name, actions }] of Object.entries(byEmail)) {
      if (actions.length === 0) continue

      const today = new Date(); today.setHours(0, 0, 0, 0)
      const overdueCount = actions.filter(a => a.date && new Date(a.date + 'T00:00:00') < today).length
      const total = actions.length

      const subject = overdueCount > 0
        ? `⚠️ Você tem ${overdueCount} ${overdueCount === 1 ? 'atividade atrasada' : 'atividades atrasadas'} — Plano de Ação GovCorp`
        : `📋 Seu resumo semanal: ${total} ${total === 1 ? 'atividade pendente' : 'atividades pendentes'} — GovCorp`

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Governança INEPAD <conselho@inepadconsulting.com>',
          to:   email,
          subject,
          html: buildEmail(name, actions),
        }),
      })

      results.push({ email, status: res.status })
    }

    return new Response(
      JSON.stringify({ success: true, sent: results.length, details: results }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
