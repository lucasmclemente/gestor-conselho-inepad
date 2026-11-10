import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Comitês — COBRANÇA AUTOMÁTICA (cron semanal). Versão automática do "Cobrar" manual
// (cobrar-acoes-comite). pg_cron chama esta função toda segunda de manhã com o header
// x-cron-secret. Para cada cliente com committees_enabled E committee_auto_charge=true,
// varre as ações dos comitês ATRASADAS ou VENCENDO em ≤3 dias e manda 1 e-mail
// consolidado por responsável (resolve NOME → e-mail do tenant). Nunca envia ata.

const escapeHtml = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const DUE_SOON_DAYS = 3;
const fmtBR = (d: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) return 'S/D'; const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };

type Row = { title: string; date: string; meeting: string; comite: string; urgency: 'overdue' | 'near' };

function buildEmail(name: string, rows: Row[]): string {
  const overdue = rows.filter(r => r.urgency === 'overdue');
  const near = rows.filter(r => r.urgency === 'near');
  const card = (r: Row) => {
    const over = r.urgency === 'overdue';
    return `
      <div style="background:${over ? '#fef2f2' : '#fffbeb'};border:1px solid ${over ? '#fecaca' : '#fde68a'};border-left:4px solid ${over ? '#ef4444' : '#d97706'};border-radius:8px;padding:12px 14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <p style="margin:0;font-size:13px;font-weight:bold;color:#1e293b;flex:1;">${escapeHtml(r.title)}</p>
          <span style="background:${over ? '#ef4444' : '#d97706'};color:#fff;font-size:9px;font-weight:bold;padding:3px 8px;border-radius:100px;text-transform:uppercase;white-space:nowrap;">${over ? '🔴 EM ATRASO' : '⚠️ VENCE EM BREVE'}</span>
        </div>
        <p style="margin:6px 0 0;font-size:11px;color:#64748b;">
          ${r.comite ? `<strong>Comitê:</strong> ${escapeHtml(r.comite)} &nbsp;|&nbsp; ` : ''}${r.meeting ? `<strong>Reunião:</strong> ${escapeHtml(r.meeting)} &nbsp;|&nbsp; ` : ''}<strong>Prazo:</strong> <span style="font-weight:bold;color:${over ? '#dc2626' : '#b45309'};">${fmtBR(r.date)}</span>
        </p>
      </div>`;
  };
  const cards = [...overdue.map(card), ...near.map(card)].join('');
  const alertBg = overdue.length > 0 ? '#fef2f2' : '#fffbeb';
  const alertBorder = overdue.length > 0 ? '#fecaca' : '#fde68a';
  const alertText = overdue.length > 0
    ? `Você tem <strong>${overdue.length} ${overdue.length === 1 ? 'ação de comitê em atraso' : 'ações de comitê em atraso'}</strong>${near.length > 0 ? ` e ${near.length} vencendo em breve` : ''}.`
    : `Você tem <strong>${near.length} ${near.length === 1 ? 'ação de comitê vencendo em breve' : 'ações de comitê vencendo em breve'}</strong>.`;
  return `
    <div style="font-family:sans-serif;max-width:620px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff;">
      <div style="background:#0f172a;padding:24px 30px;text-align:center;">
        <img src="https://app.boardplan.com.br/boardplan-logo-email.png" alt="Boardplan" style="height:32px;margin-bottom:10px;" />
        <p style="margin:0;color:#f59e0b;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;">Cobrança Semanal • Ações de Comitê</p>
      </div>
      <div style="padding:30px;">
        <p style="font-size:16px;color:#1e293b;margin:0 0 6px;">Olá, <strong>${escapeHtml(name)}</strong></p>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.6;">O Conselho está acompanhando as ações do comitê. Segue o resumo das pendências sob sua responsabilidade — por favor atualize-as no portal.</p>
        <div style="background:${alertBg};border:1px solid ${alertBorder};border-radius:8px;padding:14px 18px;margin-bottom:24px;font-size:13px;color:#1e293b;">${alertText}</div>
        <h4 style="margin:0 0 12px;font-size:11px;font-weight:bold;text-transform:uppercase;color:#64748b;letter-spacing:1px;border-bottom:1px solid #f1f5f9;padding-bottom:8px;">Ações a atualizar</h4>
        ${cards}
        <div style="text-align:center;margin-top:30px;"><a href="https://app.boardplan.com.br" style="background:#0f172a;color:#fff;padding:13px 28px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px;display:inline-block;">Acessar o Painel →</a></div>
        <p style="font-size:10px;color:#94a3b8;text-align:center;margin-top:24px;line-height:1.6;">E-mail enviado automaticamente toda segunda-feira.</p>
      </div>
    </div>`;
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

  let reqBody: any = {};
  try { reqBody = await req.json(); } catch { /* corpo vazio no cron normal */ }

  // Modo teste: 1 e-mail de exemplo para test_to (sem broadcast)
  if (reqBody?.test_to) {
    const d = new Date(); const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    const past = new Date(d); past.setDate(d.getDate() - 2);
    const soon = new Date(d); soon.setDate(d.getDate() + 2);
    const sample: Row[] = [
      { title: 'Revisar o parecer de auditoria', date: fmt(past), meeting: 'Reunião de teste', comite: 'Comitê de Auditoria', urgency: 'overdue' },
      { title: 'Consolidar matriz de riscos', date: fmt(soon), meeting: 'Reunião de teste', comite: 'Comitê de Auditoria', urgency: 'near' },
    ];
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: 'Governança Boardplan <governanca@boardplan.com.br>', to: reqBody.test_to, subject: 'COBRANÇA — ações de comitê pendentes (TESTE)', html: buildEmail(reqBody.test_name || 'Teste', sample) }),
    });
    return json({ test: true, to: reqBody.test_to, status: res.status });
  }

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // Clientes que ligaram a cobrança automática (e têm o add-on)
    const { data: clients } = await admin.from('clients').select('client_id').eq('committees_enabled', true).eq('committee_auto_charge', true);
    const clientIds = (clients || []).map((c: any) => c.client_id);
    if (clientIds.length === 0) return json({ success: true, clients: 0, sent: 0, note: 'Nenhum cliente com cobrança automática ligada.' });

    // Comitês ativos desses clientes
    const { data: comites } = await admin.from('comites').select('id, nome, client_id').eq('ativo', true).in('client_id', clientIds);
    const comiteById = new Map<string, any>((comites || []).map((c: any) => [String(c.id), c]));
    const comiteIds = (comites || []).map((c: any) => String(c.id));
    if (comiteIds.length === 0) return json({ success: true, clients: clientIds.length, sent: 0, note: 'Nenhum comitê ativo.' });

    // Reuniões de comitê
    const { data: meetings } = await admin.from('meetings').select('id, title, acoes, client_id, comite_id').in('comite_id', comiteIds);

    // Mapa NOME → e-mail por client (match exato + fallback por 1º nome, igual ao send-weekly-reminder)
    const { data: members } = await admin.from('members').select('name, email, client_id').in('client_id', clientIds);
    const exact: Record<string, Record<string, string>> = {};
    const firstIdx: Record<string, Record<string, { name: string; email: string }[]>> = {};
    for (const m of members || []) {
      if (!m.name || !m.email) continue;
      (exact[m.client_id] ||= {})[m.name] = m.email;
      const fn = m.name.trim().split(/\s+/)[0].toLowerCase();
      ((firstIdx[m.client_id] ||= {})[fn] ||= []).push({ name: m.name, email: m.email });
    }
    const resolveEmail = (resp: string, cid: string): string | null => {
      const em = exact[cid] || {};
      if (em[resp]) return em[resp];
      const fw = resp.trim().split(/\s+/)[0].toLowerCase();
      const cands = (firstIdx[cid] || {})[fw] || [];
      if (cands.length === 1) return cands[0].email;
      const hit = Object.entries(em).find(([mn]) => mn.toLowerCase().includes(resp.toLowerCase()) || resp.toLowerCase().includes(mn.toLowerCase().split(' ')[0]));
      return hit ? hit[1] : null;
    };

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const soon = new Date(today); soon.setDate(today.getDate() + DUE_SOON_DAYS);
    const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

    // { email: { name, client_id, rows[] } }
    const byEmail: Record<string, { name: string; client_id: string; rows: Row[] }> = {};
    for (const mt of meetings || []) {
      const comite = comiteById.get(String(mt.comite_id));
      for (const a of (mt.acoes || [])) {
        if (a.status === 'Concluída' || !validDate(a.date)) continue;
        const d = new Date(a.date + 'T00:00:00');
        let urgency: 'overdue' | 'near' | null = null;
        if (d < today) urgency = 'overdue';
        else if (d <= soon) urgency = 'near';
        if (!urgency) continue; // só atrasadas ou vencendo em ≤3 dias
        const resps: string[] = (a.resps?.length > 0) ? a.resps : (a.resp ? [a.resp] : []);
        for (const rname of resps) {
          const email = resolveEmail(rname, mt.client_id);
          if (!email) continue;
          const key = email.toLowerCase();
          (byEmail[key] ||= { name: rname, client_id: mt.client_id, rows: [] }).rows.push({
            title: String(a.title || 'Ação'), date: String(a.date), meeting: String(mt.title || ''), comite: comite?.nome || '', urgency,
          });
        }
      }
    }

    const results: any[] = [];
    const perClient: Record<string, number> = {};
    for (const [email, p] of Object.entries(byEmail)) {
      if (p.rows.length === 0) continue;
      const overdue = p.rows.filter(r => r.urgency === 'overdue').length;
      const subject = overdue > 0
        ? `⚠️ Cobrança: ${overdue} ${overdue === 1 ? 'ação de comitê atrasada' : 'ações de comitê atrasadas'} — Boardplan`
        : `📋 Cobrança: ações de comitê vencendo — Boardplan`;
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: 'Governança Boardplan <governanca@boardplan.com.br>', to: email, subject, html: buildEmail(p.name, p.rows) }),
      });
      results.push({ email, status: res.status });
      perClient[p.client_id] = (perClient[p.client_id] || 0) + 1;
    }

    // Log por cliente
    for (const [cid, n] of Object.entries(perClient)) {
      try { await admin.from('audit_logs').insert([{ username: 'Sistema (cron)', action: 'Cobrança', details: `Cobrança automática de comitês: ${n} responsável(is)`, client_id: cid }]); } catch (_) { /* silencioso */ }
    }

    return json({ success: true, clients: clientIds.length, sent: results.length, details: results });
  } catch (e: any) {
    return json({ error: e?.message || 'Erro inesperado.' }, 500);
  }
});
