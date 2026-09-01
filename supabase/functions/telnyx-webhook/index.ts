import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Só permite baixar de URLs públicas https — bloqueia SSRF (metadata da nuvem,
// localhost, IPs privados/loopback/link-local).
function isSafePublicUrl(u: string): boolean {
  let url: URL;
  try { url = new URL(u); } catch { return false; }
  if (url.protocol !== 'https:') return false;
  const h = url.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h === '0.0.0.0' || h === '::1' || h === '[::1]') return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  return true;
}

// Verifica a assinatura Ed25519 do Telnyx sobre `${timestamp}|${rawBody}`.
async function telnyxSignatureValid(raw: string, req: Request, pubB64: string): Promise<boolean> {
  const sigB64 = req.headers.get('telnyx-signature-ed25519') || '';
  const ts = req.headers.get('telnyx-timestamp') || '';
  if (!sigB64 || !ts) return false;
  const tsNum = parseInt(ts, 10);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return false; // anti-replay (5 min)
  try {
    const pub = Uint8Array.from(atob(pubB64), (c) => c.charCodeAt(0));
    const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const msg = new TextEncoder().encode(`${ts}|${raw}`);
    const key = await crypto.subtle.importKey('raw', pub, { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, sig, msg);
  } catch (_) { return false; }
}

// Recebe eventos da Telnyx. Quando a gravação fica pronta (call.recording.saved),
// baixa o .mp3, salva no Storage (crm-recordings) e vincula à atividade da ligação.
serve(async (req) => {
  const ok = () => new Response('ok', { status: 200 });
  const deny = () => new Response('unauthorized', { status: 401 });
  if (req.method !== 'POST') return ok();

  const raw = await req.text();

  // Autenticação do webhook: fail-closed QUANDO a chave pública está configurada.
  // Enquanto TELNYX_PUBLIC_KEY não existe, processa e alerta (configurar ativa o fail-closed).
  const pubB64 = Deno.env.get('TELNYX_PUBLIC_KEY') || '';
  if (pubB64) {
    if (!(await telnyxSignatureValid(raw, req, pubB64))) return deny();
  } else {
    console.warn('[telnyx-webhook] TELNYX_PUBLIC_KEY ausente — assinatura NÃO verificada. Configure a chave pública do Telnyx para ativar o fail-closed.');
  }

  const body = JSON.parse(raw || '{}');
  const ev = body?.data;
  console.log('[telnyx-webhook] event:', ev?.event_type);
  if (ev?.event_type !== 'call.recording.saved') return ok();

  const p = ev.payload || {};
  const sid = p.call_session_id;
  const to = p.to || p.callee || '';
  const mp3 = p?.recording_urls?.mp3 || p?.public_recording_urls?.mp3 || p?.recording_urls?.wav || p?.public_recording_urls?.wav;
  console.log('[telnyx-webhook] recording saved:', { sid, to, hasMp3: !!mp3 });
  if (!mp3 || !isSafePublicUrl(String(mp3))) { if (mp3) console.warn('[telnyx-webhook] URL de gravação rejeitada (não é https pública):', String(mp3).slice(0, 70)); return ok(); }

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

  // 1) casa pelo call_session_id (guardado em external_id)
  let act: any = null;
  if (sid) { const r = await admin.from('crm_activities').select('id, client_id, recording_id').eq('external_id', sid).maybeSingle(); act = r.data; }
  // 2) fallback: casa pelo número de destino (ligação de webphone recente sem gravação)
  if (!act && to) {
    const r = await admin.from('crm_activities').select('id, client_id, recording_id')
      .eq('type', 'call').is('recording_id', null).ilike('notes', `%${to}%`).ilike('title', '%webphone%')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    act = r.data;
  }
  console.log('[telnyx-webhook] matched activity:', act?.id || null);
  if (!act || act.recording_id) return ok();

  // baixa o áudio — tenta SEM auth (URLs da Telnyx costumam ser assinadas); com Bearer se precisar
  let r = await fetch(mp3);
  if (!r.ok) r = await fetch(mp3, { headers: { Authorization: `Bearer ${Deno.env.get('TELNYX_API_KEY') ?? ''}` } });
  console.log('[telnyx-webhook] download', r.status, String(mp3).slice(0, 70));
  if (!r.ok) return ok();
  const bytes = new Uint8Array(await r.arrayBuffer());

  const recId = `tnx-${String(sid || to).replace(/[^a-zA-Z0-9-]/g, '')}`;
  const path = `${act.client_id}/${recId}.mp3`;
  const up = await admin.storage.from('crm-recordings').upload(path, bytes, { contentType: 'audio/mpeg', upsert: true });
  console.log('[telnyx-webhook] upload', up.error ? up.error.message : `ok ${bytes.length}b`);
  if (up.error) return ok();

  await admin.from('crm_activities').update({ recording_id: recId, recording_path: path }).eq('id', act.id);
  console.log('[telnyx-webhook] linked', act.id);
  return ok();
});
