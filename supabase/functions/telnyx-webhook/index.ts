import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.0";
import { sha512 } from "https://esm.sh/@noble/hashes@1.4.0/sha512";

// Ed25519 síncrono no runtime do Supabase (WebCrypto Ed25519 é instável lá)
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

// ── OBS: a telefonia do CRM usa Telnyx WebRTC (Credential Connection), que NÃO gera
// eventos de gravação server-side. Por isso a gravação das ligações é feita no navegador
// (components/CrmWebphone.tsx → Edge Function crm-save-recording). Este webhook fica
// pronto e seguro (fail-closed) caso no futuro se migre para Call Control (Voice API App). ──

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

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

// Verifica a assinatura Ed25519 do Telnyx (headers telnyx-signature-ed25519 + telnyx-timestamp)
async function telnyxSignatureValid(raw: string, req: Request, pubB64: string): Promise<boolean> {
  const sigB64 = req.headers.get('telnyx-signature-ed25519') || '';
  const ts = req.headers.get('telnyx-timestamp') || '';
  if (!sigB64 || !ts) return false;
  const tsNum = parseInt(ts, 10);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return false; // anti-replay 5min
  try {
    const msg = new TextEncoder().encode(`${ts}|${raw}`);
    return ed.verify(b64ToBytes(sigB64), msg, b64ToBytes(pubB64));
  } catch (e) { console.error('[telnyx-webhook] erro na verificação:', String(e)); return false; }
}

serve(async (req) => {
  const ok = () => new Response('ok', { status: 200 });
  const deny = () => new Response('unauthorized', { status: 401 });
  if (req.method !== 'POST') return ok();

  const raw = await req.text();

  // Fail-closed: com a chave pública configurada, só processa requisições assinadas pelo Telnyx
  const pubB64 = Deno.env.get('TELNYX_PUBLIC_KEY') || '';
  if (pubB64) {
    if (!(await telnyxSignatureValid(raw, req, pubB64))) return deny();
  } else {
    console.warn('[telnyx-webhook] TELNYX_PUBLIC_KEY ausente — assinatura NÃO verificada.');
  }

  let body: any = {};
  try { body = JSON.parse(raw || '{}'); } catch { return ok(); }
  const ev = body?.data;
  const et = ev?.event_type;

  // Conexão de credencial (WebRTC) não grava sozinha: ao atender, dispara a gravação via Call Control
  if (et === 'call.answered') {
    const ccid = ev?.payload?.call_control_id;
    if (ccid) {
      try {
        await fetch(`https://api.telnyx.com/v2/calls/${encodeURIComponent(ccid)}/actions/record_start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${Deno.env.get('TELNYX_API_KEY') ?? ''}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ format: 'mp3', channels: 'dual' }),
        });
      } catch (e) { console.error('[telnyx-webhook] record_start erro:', String(e)); }
    }
    return ok();
  }

  if (et !== 'call.recording.saved') return ok();

  const p = ev.payload || {};
  const sid = p.call_session_id;
  const to = p.to || p.callee || '';
  const mp3 = p?.recording_urls?.mp3 || p?.public_recording_urls?.mp3 || p?.recording_urls?.wav || p?.public_recording_urls?.wav;
  if (!mp3 || !isSafePublicUrl(String(mp3))) { if (mp3) console.warn('[telnyx-webhook] URL de gravação rejeitada (SSRF):', String(mp3).slice(0, 70)); return ok(); }

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

  let act: any = null;
  if (sid) { const r = await admin.from('crm_activities').select('id, client_id, recording_id').eq('external_id', sid).maybeSingle(); act = r.data; }
  if (!act && to) {
    const r = await admin.from('crm_activities').select('id, client_id, recording_id')
      .eq('type', 'call').is('recording_id', null).ilike('notes', `%${to}%`).ilike('title', '%webphone%')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    act = r.data;
  }
  if (!act || act.recording_id) return ok();

  let r = await fetch(mp3);
  if (!r.ok) r = await fetch(mp3, { headers: { Authorization: `Bearer ${Deno.env.get('TELNYX_API_KEY') ?? ''}` } });
  if (!r.ok) return ok();
  const bytes = new Uint8Array(await r.arrayBuffer());

  const recId = `tnx-${String(sid || to).replace(/[^a-zA-Z0-9-]/g, '')}`;
  const path = `${act.client_id}/${recId}.mp3`;
  const up = await admin.storage.from('crm-recordings').upload(path, bytes, { contentType: 'audio/mpeg', upsert: true });
  if (up.error) return ok();
  await admin.from('crm_activities').update({ recording_id: recId, recording_path: path }).eq('id', act.id);
  return ok();
});
