// ============================================================
// Boardplan — CRM: núcleo da sincronização de ligações da GoTo.
// Usado pelo botão (goto-call action=sync) e pelo cron (goto-cron).
// ============================================================

const API = 'https://api.goto.com';
const AUTH_BASE = 'https://authentication.logmeininc.com/oauth';

// Garante um access_token válido para a conexão (refresh se expirado). Persiste o novo token.
export async function refreshConn(admin: any, conn: any): Promise<string> {
  let accessToken = conn.access_token as string;
  if (new Date(conn.expires_at).getTime() < Date.now() + 60_000) {
    const basic = btoa(`${Deno.env.get('GOTO_CLIENT_ID')}:${Deno.env.get('GOTO_CLIENT_SECRET')}`);
    const r = await fetch(`${AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token }),
    });
    const t = await r.json().catch(() => ({}));
    if (!r.ok || !t.access_token) throw new Error('Sessão da GoTo expirou. Reconecte a telefonia.');
    accessToken = t.access_token;
    await admin.from('crm_goto_connections').update({
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? conn.refresh_token,
      expires_at: new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('member_id', conn.member_id);
  }
  return accessToken;
}

// Puxa as ligações do período, casa com negócios pelo telefone, registra atividades,
// auto-cria leads p/ números desconhecidos e faz backfill do recording_id. Lança em erro.
export async function runSync(admin: any, accessToken: string, cid: string, body: any) {
  const gget = (path: string) => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });

  const days = Math.min(Math.max(Number(body.days) || 7, 1), 90);
  const start = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const end = new Date().toISOString();

  // accountKey da conta
  let accountKey = '';
  try { const r = await gget('/users/v1/lines'); const b = await r.json().catch(() => null); accountKey = b?.items?.[0]?.accountKey || ''; } catch { /* */ }
  if (!accountKey) throw new Error('Não consegui obter a conta na GoTo.');

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
  const norm = (s: string) => { let d = (s || '').replace(/\D/g, ''); if (d.length >= 12 && d.startsWith('55')) d = d.slice(2); return d; };
  const variants = (nat: string): string[] => {
    if (!nat) return [];
    const out = new Set<string>([nat]);
    if (nat.length === 11) out.add(nat.slice(0, 2) + nat.slice(3));
    if (nat.length === 10) out.add(nat.slice(0, 2) + '9' + nat.slice(2));
    return [...out];
  };
  const phoneToDeal = new Map<string, any>();
  const addPhone = (phone: string, deal: any, contactId: string | null) => {
    for (const v of variants(norm(phone || ''))) { if (v && !phoneToDeal.has(v)) phoneToDeal.set(v, { deal, contactId }); }
  };
  (contacts || []).forEach((c: any) => { if (c.organization_id && dealByOrg.has(c.organization_id)) addPhone(c.phone, dealByOrg.get(c.organization_id), c.id); });
  (orgs || []).forEach((o: any) => { if (o.phone && dealByOrg.has(o.id)) addPhone(o.phone, dealByOrg.get(o.id), null); });

  // ids já importados (dedup)
  const { data: existing } = await admin.from('crm_activities').select('id, external_id, recording_id').eq('client_id', cid).not('external_id', 'is', null);
  const seen = new Set<string>((existing || []).map((a: any) => a.external_id));
  const existingByExt = new Map<string, any>((existing || []).map((a: any) => [a.external_id, a]));
  const backfill: { id: string; recording_id: string }[] = [];

  const typeOf = (x: any) => x?.type?.value ?? x?.type ?? '';
  const extNums = (call: any): string[] => {
    const cands: string[] = [];
    if (typeOf(call.caller) === 'PHONE_NUMBER' && call.caller?.number) cands.push(call.caller.number);
    (call.participants || []).forEach((p: any) => { if (typeOf(p) === 'PHONE_NUMBER' && p.number) cands.push(p.number); });
    return cands;
  };

  // auto-criação de leads p/ números desconhecidos (trava anti-lixo)
  const autoCreate = body.autoCreate !== false;
  const MIN_DUR = Number(body.minDuration) || 30;
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

    const m = matchAny(nums);
    let hit: any = m?.hit || null; let ext = m?.ext || '';

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
    const key = String(call.conversationSpaceId || call.id || call.callId || call.legId || `${norm(ext)}|${call.callCreated || call.startTime || ''}`);
    const recId = call.caller?.recordingId
      || (call.participants || []).map((p: any) => p.recordingId).find(Boolean)
      || (call.participants || []).flatMap((p: any) => p.recordings || []).map((rr: any) => rr.id).find(Boolean)
      || null;
    if (seen.has(key)) {
      const ex = existingByExt.get(key);
      if (ex && !ex.recording_id && recId) { backfill.push({ id: ex.id, recording_id: recId }); ex.recording_id = recId; }
      continue;
    }
    seen.add(key);
    const dir = call.direction === 'OUTBOUND' ? 'saída' : 'entrada';
    const outcome = answered ? 'atendida' : 'não atendida';
    const recorded = !!recId;
    const mm = Math.floor(dur / 60), ss = dur % 60;
    rows.push({
      client_id: cid, deal_id: hit.deal.id, contact_id: hit.contactId, type: 'call',
      title: `Ligação (${dir}) — ${ext}`,
      notes: `${outcome} · ${mm}m${String(ss).padStart(2, '0')}s${recorded ? ' · gravada' : ''} · via GoTo`,
      due_at: call.callCreated || call.startTime || null, done: true, done_at: call.callEnded || call.callCreated || null,
      owner_member_id: hit.deal.owner_member_id || null,
      external_id: key, recording_id: recId,
    });
  }
  let created = 0;
  if (rows.length) {
    const { data, error } = await admin.from('crm_activities').insert(rows).select('id');
    if (error) throw new Error('Falha ao gravar as atividades: ' + error.message);
    created = (data || []).length;
  }
  let backfilled = 0;
  for (const b of backfill.slice(0, 500)) {
    const { error } = await admin.from('crm_activities').update({ recording_id: b.recording_id }).eq('id', b.id);
    if (!error) backfilled++;
  }

  // diagnóstico da sobreposição (usado pelo botão quando nada casa)
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
  return { fetched: calls.length, matched, created, leadsCreated, backfilled, debug };
}
