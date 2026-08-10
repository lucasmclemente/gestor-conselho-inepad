import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Recebe eventos da Telnyx. Quando a gravação fica pronta (call.recording.saved),
// baixa o .mp3, salva no Storage (crm-recordings) e vincula à atividade da ligação
// (casada pelo call_session_id, guardado em crm_activities.external_id).
serve(async (req) => {
  const ok = () => new Response('ok', { status: 200 });
  if (req.method !== 'POST') return ok();

  const body = await req.json().catch(() => null);
  const ev = body?.data;
  if (ev?.event_type !== 'call.recording.saved') return ok();

  const p = ev.payload || {};
  const sid = p.call_session_id;
  const mp3 = p?.recording_urls?.mp3 || p?.public_recording_urls?.mp3 || p?.recording_urls?.wav;
  if (!sid || !mp3) return ok();

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

  const { data: act } = await admin.from('crm_activities').select('id, client_id, recording_id').eq('external_id', sid).maybeSingle();
  if (!act || act.recording_id) return ok(); // não achou ou já processada

  // baixa o áudio (URL da Telnyx; manda o Bearer caso exija)
  const r = await fetch(mp3, { headers: { Authorization: `Bearer ${Deno.env.get('TELNYX_API_KEY') ?? ''}` } });
  if (!r.ok) return ok();
  const bytes = new Uint8Array(await r.arrayBuffer());

  const recId = `tnx-${sid}`;
  const path = `${act.client_id}/${recId}.mp3`;
  const up = await admin.storage.from('crm-recordings').upload(path, bytes, { contentType: 'audio/mpeg', upsert: true });
  if (up.error) return ok();

  await admin.from('crm_activities').update({ recording_id: recId, recording_path: path }).eq('id', act.id);
  return ok();
});
