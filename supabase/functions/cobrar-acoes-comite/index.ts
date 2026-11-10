import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Comitês Fase 2 — COBRANÇA por e-mail das ações de comitê a partir do Conselho.
// O Conselho (supervisor ou Conselheiro) dispara um lembrete ao responsável de uma
// ação de comitê. Nunca envia ata/deliberação — só o resumo da própria ação.
// Os e-mails são resolvidos no servidor (por NOME → members do tenant); o cliente
// nunca escolhe o destinatário. Consolida: 1 e-mail por pessoa com todas as ações dela.

const ALLOWED_ORIGINS = [
  'https://conselho.inepadconsulting.com', 'https://app.boardplan.com.br',
  'http://localhost:3000',
];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const preview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin);
  const allowed = ALLOWED_ORIGINS.includes(origin) || preview ? origin : ALLOWED_ORIGINS[0];
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Vary': 'Origin' };
}

const escapeHtml = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

serve(async (req) => {
  const c = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: c });
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...c, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);
  const authed = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await authed.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  const role = (user.app_metadata as any)?.role;
  const homeClient = (user.app_metadata as any)?.client_id;
  const secClients: string[] = Array.isArray((user.app_metadata as any)?.secretary_clients) ? (user.app_metadata as any).secretary_clients : [];
  // Quem cobra = o Conselho: supervisor (Adm/Sec/Super) ou Conselheiro. Controller/Diretor não cobram comitê.
  if (!['Administrador', 'Secretário', 'SuperAdmin', 'Conselheiro'].includes(role)) return json({ error: 'Sem permissão.' }, 403);

  try {
    const { items, appOrigin } = await req.json();
    if (!Array.isArray(items) || items.length === 0) return json({ error: 'Nada para cobrar.' }, 400);
    if (items.length > 200) return json({ error: 'Muitos itens de uma vez.' }, 400);
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const origin = (typeof appOrigin === 'string' && /^https?:\/\//.test(appOrigin)) ? appOrigin.replace(/\/$/, '') : 'https://app.boardplan.com.br';

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } });
    const isSuper = role === 'SuperAdmin';
    const tenantOk = (cid: string) => isSuper || cid === homeClient || secClients.includes(cid);

    // Carrega as reuniões envolvidas (service role) e valida comitê + tenant
    const meetingIds = [...new Set(items.map((it: any) => String(it?.meetingId || '')).filter(Boolean))];
    if (meetingIds.length === 0) return json({ error: 'Parâmetros ausentes.' }, 400);
    const { data: meetings } = await admin.from('meetings').select('id, client_id, title, comite_id, acoes').in('id', meetingIds);
    const mById = new Map<string, any>((meetings || []).map((m: any) => [String(m.id), m]));

    // Caches de membros por cliente (resolve NOME → e-mail, como no resto do sistema)
    const membersCache = new Map<string, any[]>();
    const loadMembers = async (cid: string) => {
      if (membersCache.has(cid)) return membersCache.get(cid)!;
      const { data } = await admin.from('members').select('name, email').eq('client_id', cid);
      const list = data || [];
      membersCache.set(cid, list);
      return list;
    };
    const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

    // Agrupa por pessoa (e-mail) → lista de ações cobradas
    type Row = { title: string; comite: string; meeting: string; due: string; status: string };
    const perPerson = new Map<string, { name: string; email: string; client_id: string; rows: Row[] }>();
    let skipped = 0;

    for (const it of items) {
      const m = mById.get(String(it?.meetingId || ''));
      if (!m || !m.comite_id || !tenantOk(m.client_id)) { skipped++; continue; }
      const action = (m.acoes || []).find((a: any) => String(a.id) === String(it?.actionId));
      if (!action) { skipped++; continue; }
      if (String(action.status) === 'Concluída') { skipped++; continue; }
      const resps: string[] = Array.isArray(action.resps) && action.resps.length > 0 ? action.resps : (action.resp ? [action.resp] : []);
      if (resps.length === 0) { skipped++; continue; }

      const members = await loadMembers(m.client_id);
      const comiteName = (() => { return it?.comiteNome && typeof it.comiteNome === 'string' ? it.comiteNome : ''; })();
      for (const rname of resps) {
        const mem = members.find((x: any) => norm(x.name) === norm(rname) && x.email);
        if (!mem) { continue; } // responsável sem cadastro/e-mail → não cobra
        const key = norm(mem.email);
        if (!perPerson.has(key)) perPerson.set(key, { name: mem.name || rname, email: mem.email, client_id: m.client_id, rows: [] });
        perPerson.get(key)!.rows.push({
          title: String(action.title || 'Ação'),
          comite: comiteName,
          meeting: String(m.title || ''),
          due: String(action.date || ''),
          status: String(action.status || 'Pendente'),
        });
      }
    }

    if (perPerson.size === 0) return json({ ok: true, sent: 0, people: 0, skipped, note: 'Nenhum responsável com e-mail cadastrado.' });

    const emailPromises = [...perPerson.values()].map((p) => {
      const rowsHtml = p.rows.map((r) => `
        <div style="background:#fff;border-left:4px solid #b45309;padding:12px;margin-bottom:10px;border-radius:6px;border:1px solid #fed7aa;">
          <p style="margin:0;font-size:13px;font-weight:bold;color:#1e293b;">${escapeHtml(r.title)}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#64748b;">
            ${r.comite ? `<strong>Comitê:</strong> ${escapeHtml(r.comite)} | ` : ''}${r.meeting ? `<strong>Reunião:</strong> ${escapeHtml(r.meeting)} | ` : ''}<strong>Prazo:</strong> ${escapeHtml(r.due || 'S/D')} | <strong>Status:</strong> ${escapeHtml(r.status)}
          </p>
        </div>`).join('');
      return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'Governança Boardplan <governanca@boardplan.com.br>',
          to: p.email,
          reply_to: user.email,
          subject: `COBRANÇA — ações de comitê pendentes (${p.rows.length})`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff;">
              <div style="background:#0f172a;padding:20px;text-align:center;"><img src="https://app.boardplan.com.br/boardplan-logo-email.png" style="height:35px;" /></div>
              <div style="padding:30px;color:#1e293b;">
                <p style="font-size:16px;">Olá, <strong>${escapeHtml(p.name)}</strong>,</p>
                <p style="font-size:14px;line-height:1.5;">O Conselho está acompanhando as ações do comitê e registrou as pendências abaixo sob sua responsabilidade. Pedimos a gentileza de atualizá-las no portal.</p>
                <div style="margin-top:20px;padding:20px;background:#fff7ed;border-radius:10px;border:1px solid #ffedd5;">
                  <h4 style="margin:0 0 15px;color:#9a3412;font-size:12px;text-transform:uppercase;letter-spacing:1px;">📋 Ações a atualizar</h4>
                  ${rowsHtml}
                </div>
                <div style="text-align:center;margin-top:35px;"><a href="${origin}" style="background:#0f172a;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px;display:inline-block;">Acessar o Portal</a></div>
              </div>
            </div>`,
        }),
      });
    });

    const results = await Promise.allSettled(emailPromises);
    const sent = results.filter((r) => r.status === 'fulfilled').length;
    try {
      const anyClient = [...perPerson.values()][0]?.client_id;
      let myName = user.email || '';
      try { const { data: me } = await admin.from('members').select('name').eq('id', user.id).maybeSingle(); if (me?.name) myName = me.name; } catch (_) { /* usa e-mail */ }
      if (anyClient) await admin.from('audit_logs').insert([{ username: myName, action: 'Cobrança', details: `Cobrança de ${sent} responsável(is) por ações de comitê`, client_id: anyClient }]);
    } catch (_) { /* silencioso */ }

    return json({ ok: true, sent, people: perPerson.size, skipped });
  } catch (e: any) {
    return json({ error: e?.message || 'Erro inesperado.' }, 400);
  }
});
