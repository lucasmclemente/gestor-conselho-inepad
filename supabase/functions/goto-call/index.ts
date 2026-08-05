import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  'https://conselho.inepadconsulting.com',
  'http://localhost:3000',
];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const isVercel = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin);
  const allowed = ALLOWED_ORIGINS.includes(origin) || isVercel ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const AUTH_BASE = 'https://authentication.logmeininc.com/oauth';
const API = 'https://api.goto.com';

serve(async (req) => {
  const headers = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...headers, 'Content-Type': 'application/json' } });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);
  const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const role = (user.app_metadata as any)?.role;
  const cid = (user.app_metadata as any)?.client_id;
  if (!['SuperAdmin', 'Administrador', 'Comercial'].includes(role)) return json({ error: 'Forbidden' }, 403);

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const { data: conn } = await admin.from('crm_goto_connections').select('*').eq('member_id', user.id).maybeSingle();
  if (!conn) return json({ error: 'Telefonia não conectada. Clique em "Conectar telefonia" primeiro.' }, 400);

  // ── Token válido (refresh se expirado) ──────────────────────
  let accessToken = conn.access_token as string;
  if (new Date(conn.expires_at).getTime() < Date.now() + 60_000) {
    const basic = btoa(`${Deno.env.get('GOTO_CLIENT_ID')}:${Deno.env.get('GOTO_CLIENT_SECRET')}`);
    const r = await fetch(`${AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token }),
    });
    const t = await r.json().catch(() => ({}));
    if (!r.ok || !t.access_token) return json({ error: 'Sessão da GoTo expirou. Reconecte a telefonia.', detail: t }, 400);
    accessToken = t.access_token;
    await admin.from('crm_goto_connections').update({
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? conn.refresh_token,
      expires_at: new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('member_id', user.id);
  }
  const gget = (path: string) => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });

  // A linha do usuário vem de GET /users/v1/lines → items[]
  const findLines = async () => {
    const raw: any = {}; let cands: any[] = [];
    try {
      const r = await gget('/users/v1/lines');
      const b = await r.json().catch(() => null);
      raw['/users/v1/lines'] = { status: r.status, body: b };
      if (Array.isArray(b?.items)) cands = b.items.filter((i: any) => i?.id).map((i: any) => ({ id: i.id, number: i.number ?? null, name: i.name ?? null }));
    } catch (e) { raw['/users/v1/lines'] = { error: String(e) }; }
    const seen = new Set<string>(); const candidates = cands.filter(c => c.id && !seen.has(c.id) && seen.add(c.id));
    return { candidates, raw };
  };

  const body = await req.json().catch(() => ({}));
  const action = body.action || 'call';

  // ── Sondagem das gravações (endpoints CERTOS: call-events-report) ──
  if (action === 'recordings') {
    const out: any = { tokenScope: conn.scope };
    let accountKey = '';
    try { const r = await gget('/users/v1/lines'); const b = await r.json().catch(() => null); accountKey = b?.items?.[0]?.accountKey || ''; } catch { /* */ }
    out.accountKey = accountKey;
    const end = new Date().toISOString();
    const start = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    let rec: any = null;
    try {
      const r = await gget(`/call-events-report/v1/report-summaries?accountKey=${accountKey}&startTime=${encodeURIComponent(start)}&endTime=${encodeURIComponent(end)}`);
      const b = await r.json().catch(() => null);
      out.summariesStatus = r.status;
      out.totalCalls = (b?.items || []).length;
      for (const it of (b?.items || [])) {
        const rid = it?.caller?.recordingId || (it?.participants || []).find((p: any) => p.recordingId)?.recordingId;
        if (rid) { rec = { conversationSpaceId: it.conversationSpaceId, recordingId: rid }; break; }
      }
      out.recordedCall = rec;
    } catch (e) { out.summaries_error = String(e); }
    // relatório completo de uma chamada COM gravação (ver estrutura de recordings[])
    if (rec?.conversationSpaceId) {
      try { const rr = await gget(`/call-events-report/v1/reports/${rec.conversationSpaceId}`); out.reportRecorded = { status: rr.status, body: await rr.json().catch(() => null) }; } catch (e) { out.reportRecorded = { error: String(e) }; }
    }
    // investiga a gravação pelo recordingId — despeja o CORPO COMPLETO
    if (rec?.recordingId) {
      const base = `/recording/v1/recordings/${rec.recordingId}`;
      // 1) metadados completos (pode conter url/downloadUrl)
      try { const r = await gget(base); out.meta = { status: r.status, body: await r.json().catch(() => null) }; } catch (e) { out.meta_error = String(e); }
      // 2) /content completo (pode conter url + token lado a lado)
      let contentBody: any = null;
      try { const r = await gget(base + '/content'); contentBody = await r.json().catch(() => null); out.content = { status: r.status, body: contentBody }; } catch (e) { out.content_error = String(e); }

      const tok = contentBody?.token?.token || (typeof contentBody?.token === 'string' ? contentBody.token : '') || '';
      out.hasToken = !!tok;

      const probe = async (label: string, url: string, headers?: any) => {
        try {
          const r = await fetch(url, { headers: headers || {}, redirect: 'manual' });
          const ct = r.headers.get('content-type') || '';
          out[label] = { status: r.status, contentType: ct, length: r.headers.get('content-length'), location: r.headers.get('location'), body: ct.includes('json') ? await r.json().catch(() => null) : `[${ct}]` };
        } catch (e) { out[label] = { error: String(e) }; }
      };
      const oauth = { Authorization: `Bearer ${accessToken}`, Accept: '*/*' };

      // ── TESTE-CHAVE: contact-center-reports em api.jive.com (fluxo do web player) ──
      // orgId e um recordingId conhecido (capturados do navegador); permite override pelo body
      const JIVE = 'https://api.jive.com';
      const orgId = body.orgId || '559d3b2f-c583-4f50-945d-16c516c85656';
      const ccRid = body.ccRecordingId || '25899cbc-5647-40c9-a811-74fc7a802181';
      const ccBase = `${JIVE}/contact-center-reports/v1/organizations/${orgId}/recordings/${ccRid}`;
      out.ccTest = { orgId, ccRid };
      // meu token OAuth acessa esse serviço?
      await probe('cc:meta', ccBase, oauth);
      await probe('cc:content', `${ccBase}/content`, oauth);           // pode 302 ou devolver o token
      await probe('cc:contentSlash', `${ccBase}/content/`, oauth);
      await probe('cc:list', `${JIVE}/contact-center-reports/v1/organizations/${orgId}/recordings?pageSize=3`, oauth);
    }
    return json(out);
  }

  // ── Sincroniza o registro de ligações → atividades nos negócios ──
  if (action === 'sync') {
    const days = Math.min(Math.max(Number(body.days) || 7, 1), 90);
    const start = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    const end = new Date().toISOString();

    // accountKey da conta
    let accountKey = '';
    try { const r = await gget('/users/v1/lines'); const b = await r.json().catch(() => null); accountKey = b?.items?.[0]?.accountKey || ''; } catch { /* */ }
    if (!accountKey) return json({ error: 'Não consegui obter a conta na GoTo.' }, 400);

    // busca as ligações do período (paginado)
    const calls: any[] = [];
    let marker = '';
    for (let page = 0; page < 12; page++) {
      const u = `/call-events-report/v1/report-summaries?accountKey=${accountKey}&startTime=${encodeURIComponent(start)}&endTime=${encodeURIComponent(end)}` + (marker ? `&pageMarker=${encodeURIComponent(marker)}` : '');
      const r = await gget(u);
      if (!r.ok) break;
      const b = await r.json().catch(() => null);
      calls.push(...(b?.items || []));
      const nm = b?.nextPageMarker || '';
      if (!nm || nm === marker) break;
      marker = nm;
    }

    // carrega contatos, negócios e empresas do cliente
    const [{ data: contacts }, { data: deals }, { data: orgs }] = await Promise.all([
      admin.from('crm_contacts').select('id, phone, organization_id').eq('client_id', cid),
      admin.from('crm_deals').select('id, organization_id, owner_member_id').eq('client_id', cid),
      admin.from('crm_organizations').select('id, phone').eq('client_id', cid),
    ]);
    const dealByOrg = new Map<string, any>();
    (deals || []).forEach((d: any) => { if (d.organization_id && !dealByOrg.has(d.organization_id)) dealByOrg.set(d.organization_id, d); });
    // normaliza telefone p/ nacional (tira +, tira DDI 55): "+5516988135491" → "16988135491"
    const norm = (s: string) => { let d = (s || '').replace(/\D/g, ''); if (d.length >= 12 && d.startsWith('55')) d = d.slice(2); return d; };
    // variantes p/ tolerar o 9º dígito de celular (11 dígitos com 9 ↔ 10 sem 9)
    const variants = (nat: string): string[] => {
      if (!nat) return [];
      const out = new Set<string>([nat]);
      if (nat.length === 11) out.add(nat.slice(0, 2) + nat.slice(3)); // remove o 9º dígito
      if (nat.length === 10) out.add(nat.slice(0, 2) + '9' + nat.slice(2)); // adiciona o 9º dígito
      return [...out];
    };
    const phoneToDeal = new Map<string, any>();
    const addPhone = (phone: string, deal: any, contactId: string | null) => {
      for (const v of variants(norm(phone || ''))) { if (v && !phoneToDeal.has(v)) phoneToDeal.set(v, { deal, contactId }); }
    };
    // telefones dos contatos (sócios)
    (contacts || []).forEach((c: any) => { if (c.organization_id && dealByOrg.has(c.organization_id)) addPhone(c.phone, dealByOrg.get(c.organization_id), c.id); });
    // telefones das próprias empresas
    (orgs || []).forEach((o: any) => { if (o.phone && dealByOrg.has(o.id)) addPhone(o.phone, dealByOrg.get(o.id), null); });

    // ids já importados (dedup)
    const { data: existing } = await admin.from('crm_activities').select('external_id').eq('client_id', cid).not('external_id', 'is', null);
    const seen = new Set<string>((existing || []).map((a: any) => a.external_id));

    // na GoTo o "type" vem como string direta ("PHONE_NUMBER"/"LINE"); tratamos os dois formatos
    const typeOf = (x: any) => x?.type?.value ?? x?.type ?? '';
    // extrai os números externos de uma ligação (nunca o DID interno)
    const extNums = (call: any): string[] => {
      const cands: string[] = [];
      if (typeOf(call.caller) === 'PHONE_NUMBER' && call.caller?.number) cands.push(call.caller.number);
      (call.participants || []).forEach((p: any) => { if (typeOf(p) === 'PHONE_NUMBER' && p.number) cands.push(p.number); });
      return cands;
    };

    // ── Auto-criação de leads p/ números desconhecidos ──────────
    // Trava anti-lixo: só liga atendida, com duração mínima, 1 lead por número.
    const autoCreate = body.autoCreate !== false;
    const MIN_DUR = Number(body.minDuration) || 30; // segundos
    const MAX_NEW_LEADS = 400;
    let pipeId: string | null = null, stageId: string | null = null;
    if (autoCreate) {
      const { data: pipe } = await admin.from('crm_pipelines').select('id').eq('client_id', cid).order('is_default', { ascending: false }).order('position').limit(1).maybeSingle();
      if (pipe) {
        pipeId = pipe.id;
        const { data: st } = await admin.from('crm_stages').select('id').eq('pipeline_id', pipe.id).order('position').limit(1).maybeSingle();
        stageId = st?.id || null;
      }
    }
    const canCreate = autoCreate && !!pipeId && !!stageId;

    const matchAny = (nums: string[]) => {
      for (const c of nums) { for (const v of variants(norm(c))) { const m = phoneToDeal.get(v); if (m) return { hit: m, ext: c }; } }
      return null;
    };

    const rows: any[] = [];
    let matched = 0, leadsCreated = 0;
    for (const call of calls) {
      const nums = extNums(call);
      const dur = call.callEnded && call.callCreated ? Math.round((new Date(call.callEnded).getTime() - new Date(call.callCreated).getTime()) / 1000) : 0;
      const answered = call.callerOutcome !== 'MISSED';

      let m = matchAny(nums);
      let hit: any = m?.hit || null; let ext = m?.ext || '';

      // não achou lead: cria um (se passar na trava e ainda dentro do teto)
      if (!hit && canCreate && answered && dur >= MIN_DUR && nums.length && leadsCreated < MAX_NEW_LEADS) {
        ext = nums[0];
        const orgName = `Lead ${ext}`;
        const { data: org } = await admin.from('crm_organizations').insert({ client_id: cid, name: orgName, phone: ext }).select('id').single();
        if (org) {
          const { data: ct } = await admin.from('crm_contacts').insert({ client_id: cid, organization_id: org.id, name: 'Contato (telefonia)', phone: ext }).select('id').single();
          const { data: dl } = await admin.from('crm_deals').insert({ client_id: cid, pipeline_id: pipeId, stage_id: stageId, title: orgName, organization_id: org.id, contact_id: ct?.id || null, status: 'open', source: 'Telefonia (GoTo)' }).select('id, owner_member_id').single();
          if (dl) { hit = { deal: dl, contactId: ct?.id || null }; addPhone(ext, dl, ct?.id || null); leadsCreated++; }
        }
      }
      if (!hit) continue;
      matched++;
      // chave de dedup: qualquer id da GoTo; se não houver, telefone+início da chamada
      const key = String(call.conversationSpaceId || call.id || call.callId || call.legId || `${norm(ext)}|${call.callCreated || call.startTime || ''}`);
      if (seen.has(key)) continue;
      seen.add(key);
      const dir = call.direction === 'OUTBOUND' ? 'saída' : 'entrada';
      const outcome = answered ? 'atendida' : 'não atendida';
      const recorded = !!(call.caller?.recordingId || (call.participants || []).some((p: any) => p.recordingId));
      const mm = Math.floor(dur / 60), ss = dur % 60;
      rows.push({
        client_id: cid, deal_id: hit.deal.id, contact_id: hit.contactId, type: 'call',
        title: `Ligação (${dir}) — ${ext}`,
        notes: `${outcome} · ${mm}m${String(ss).padStart(2, '0')}s${recorded ? ' · gravada' : ''} · via GoTo`,
        due_at: call.callCreated || call.startTime || null, done: true, done_at: call.callEnded || call.callCreated || null,
        owner_member_id: hit.deal.owner_member_id || null,
        external_id: key,
      });
    }
    let created = 0;
    if (rows.length) {
      const { data, error } = await admin.from('crm_activities').insert(rows).select('id');
      if (error) return json({ error: 'Falha ao gravar as atividades.', detail: error.message }, 400);
      created = (data || []).length;
    }

    // diagnóstico: sobreposição real entre números ligados e telefones cadastrados
    const calledNorms = new Set<string>();
    for (const call of calls) for (const n of extNums(call)) { const nn = norm(n); if (nn) calledNorms.add(nn); }
    const overlap = [...calledNorms].filter((n) => variants(n).some((v) => phoneToDeal.has(v)));
    const debug = {
      totalContacts: (contacts || []).length,
      contactsWithPhone: (contacts || []).filter((c: any) => c.phone).length,
      totalOrgs: (orgs || []).length,
      dealsWithOrg: dealByOrg.size,
      phoneToDealSize: phoneToDeal.size,
      distinctCalledNumbers: calledNorms.size,
      overlapCount: overlap.length,
      sampleOverlap: overlap.slice(0, 10),
      samplePhoneKeys: [...phoneToDeal.keys()].slice(0, 12),
      sampleCalledNumbers: [...calledNorms].slice(0, 20),
    };
    return json({ fetched: calls.length, matched, created, leadsCreated, debug });
  }

  // ── Diagnóstico da linha ────────────────────────────────────
  if (action === 'lines') {
    const { candidates, raw } = await findLines();
    if (candidates.length === 1) await admin.from('crm_goto_connections').update({ goto_line_id: candidates[0].id, updated_at: new Date().toISOString() }).eq('member_id', user.id);
    return json({ candidates, stored: candidates.length === 1 ? candidates[0].id : null, raw });
  }

  // ── Resolve o lineId (usa o guardado; senão detecta) ────────
  let lineId = conn.goto_line_id as string | null;
  if (!lineId) {
    const { candidates, raw } = await findLines();
    if (candidates.length >= 1) {
      lineId = candidates[0].id;
      await admin.from('crm_goto_connections').update({ goto_line_id: lineId, updated_at: new Date().toISOString() }).eq('member_id', user.id);
    } else {
      return json({ error: 'Não consegui detectar sua linha na GoTo.', detail: raw }, 400);
    }
  }

  // ── Origina a chamada ───────────────────────────────────────
  const dial = String(body.dial || '').trim();
  if (!dial) return json({ error: 'Número não informado.' }, 400);
  const callRes = await fetch(`${API}/calls/v2/calls`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dialString: dial, from: { lineId } }),
  });
  const callBody = await callRes.json().catch(() => ({}));
  if (!callRes.ok) return json({ error: 'Falha ao iniciar a chamada na GoTo.', detail: callBody }, 400);

  // ── Registra a ligação como atividade no negócio ────────────
  if (body.dealId) {
    await admin.from('crm_activities').insert({
      client_id: cid, deal_id: body.dealId, type: 'call',
      title: `Ligação para ${body.contactName || dial}`,
      notes: 'Chamada iniciada pela telefonia (GoTo).',
      owner_member_id: user.id,
    });
  }
  return json({ ok: true, callId: callBody?.id ?? callBody?.callId ?? null });
});
