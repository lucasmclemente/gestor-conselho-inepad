import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runSync, refreshConn } from "../_shared/gotoSync.ts";

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

  const body = await req.json().catch(() => ({}));
  const action = body.action || 'call';

  // ── Gravação já em cache no Storage (Telnyx OU GoTo já baixada): serve sem exigir GoTo conectada ──
  if (action === 'recording') {
    const rid = String(body.recordingId || '').trim();
    if (!rid) return json({ error: 'recordingId não informado.' }, 400);
    const cached0 = await admin.storage.from('crm-recordings').createSignedUrl(`${cid}/${rid}.mp3`, 3600);
    if (cached0.data?.signedUrl) return json({ url: cached0.data.signedUrl, cached: true });
  }

  const { data: conn } = await admin.from('crm_goto_connections').select('*').eq('member_id', user.id).maybeSingle();
  if (!conn) return json({ error: action === 'recording' ? 'Gravação ainda não disponível — tente de novo em instantes.' : 'Telefonia não conectada. Clique em "Conectar telefonia" primeiro.' }, 400);

  // ── Token válido (refresh se expirado) ──────────────────────
  let accessToken: string;
  try { accessToken = await refreshConn(admin, conn); }
  catch (e) { return json({ error: String((e as any)?.message || e) }, 400); }
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

  // ── Baixa a gravação da GoTo (não estava em cache): fluxo de 3 passos + cache no Storage ──
  if (action === 'recording') {
    const recordingId = String(body.recordingId || '').trim();
    if (!recordingId) return json({ error: 'recordingId não informado.' }, 400);
    const path = `${cid}/${recordingId}.mp3`;

    // já baixado antes? devolve direto do Storage
    const cached = await admin.storage.from('crm-recordings').createSignedUrl(path, 3600);
    if (cached.data?.signedUrl) return json({ url: cached.data.signedUrl, cached: true });

    // 1) obtém o token de acesso à gravação
    const r1 = await gget(`/recording/v1/recordings/${recordingId}/content`);
    const b1 = await r1.json().catch(() => null);
    const token = b1?.token?.token;
    if (!token) return json({ error: 'Gravação ainda não disponível na GoTo.' }, 400);
    // 2) token NO PATH + Bearer → 302 para a URL assinada (CloudFront)
    const r2 = await fetch(`${API}/recording/v1/recordings/${recordingId}/content/${encodeURIComponent(token)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, redirect: 'manual',
    });
    const loc = r2.headers.get('location');
    if (!loc) return json({ error: 'Não obtive o link de mídia da GoTo.', status: r2.status }, 400);
    // 3) baixa os bytes do .mp3 (URL assinada, sem auth)
    const r3 = await fetch(loc);
    if (!r3.ok) return json({ error: 'Falha ao baixar o áudio.', status: r3.status }, 400);
    const bytes = new Uint8Array(await r3.arrayBuffer());

    // salva no Storage (posse INEPAD + cache) e vincula à atividade
    const up = await admin.storage.from('crm-recordings').upload(path, bytes, { contentType: 'audio/mpeg', upsert: true });
    if (up.error) return json({ error: 'Falha ao salvar o áudio: ' + up.error.message }, 400);
    if (body.activityId) await admin.from('crm_activities').update({ recording_path: path }).eq('id', body.activityId).eq('client_id', cid);

    const signed = await admin.storage.from('crm-recordings').createSignedUrl(path, 3600);
    return json({ url: signed.data?.signedUrl || null, cached: false });
  }

  // ── Sincroniza o registro de ligações → atividades nos negócios ──
  if (action === 'sync') {
    try { return json(await runSync(admin, accessToken, cid, body)); }
    catch (e) { return json({ error: String((e as any)?.message || e) }, 400); }
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
