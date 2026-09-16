// ============================================================
// Boardplan CRM — Correio de voz (inbound Telnyx via TeXML <Record>)
//
// Recebe o recordingStatusCallback do TeXML, baixa o áudio do recado, salva no
// bucket crm-attachments e cria uma atividade no negócio (casando pelo número de
// quem ligou; se desconhecido, cria um lead). O áudio aparece no histórico com player.
//
// Segurança: público (sem JWT), protegido por ?k=<TELNYX_VOICEMAIL_SECRET> na URL.
// Deploy: supabase functions deploy telnyx-voicemail --no-verify-jwt --project-ref <ref>
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const digits = (s: string) => (s || '').replace(/\D/g, '');
// chave de comparação de telefone: últimos 8 dígitos (ignora DDI/DDD/9º dígito divergentes)
const phoneKey = (s: string) => { const d = digits(s); return d.length >= 8 ? d.slice(-8) : d; };

serve(async (req) => {
  const ok = () => new Response('ok', { status: 200 });
  if (req.method !== 'POST') return ok();

  const url = new URL(req.url);
  const secret = Deno.env.get('TELNYX_VOICEMAIL_SECRET') ?? '';
  if (!secret || url.searchParams.get('k') !== secret) return new Response('forbidden', { status: 403 });

  // TeXML manda x-www-form-urlencoded (compatível Twilio); aceita JSON também
  let p: Record<string, string> = {};
  try {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) { p = await req.json(); }
    else { const t = await req.text(); for (const [k, v] of new URLSearchParams(t)) p[k] = v; }
  } catch { /* */ }

  const recUrl = p.RecordingUrl || p.recording_url || '';
  const sid = p.RecordingSid || p.CallSid || p.call_control_id || String(Date.now());
  const from = p.From || p.from || '';
  const to = p.To || p.to || '';
  const dur = parseInt(p.RecordingDuration || p.recording_duration || '0', 10) || 0;
  console.log('[voicemail]', { sid, from, to, dur, hasUrl: !!recUrl });
  if (!recUrl) return ok();

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const CID = Deno.env.get('TELNYX_INBOUND_CLIENT_ID') || 'INEPAD';

  // baixa o áudio (URLs do Telnyx: tenta sem auth; com .mp3; com Bearer)
  const tryFetch = async (u: string) => { try { const r = await fetch(u); return r.ok ? r : null; } catch { return null; } };
  let resp = await tryFetch(recUrl) || await tryFetch(recUrl.endsWith('.mp3') ? recUrl : recUrl + '.mp3');
  if (!resp) { try { resp = await fetch(recUrl, { headers: { Authorization: `Bearer ${Deno.env.get('TELNYX_API_KEY') ?? ''}` } }); if (!resp.ok) resp = null; } catch { resp = null; } }
  if (!resp) { console.log('[voicemail] download falhou'); return ok(); }
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const ct = resp.headers.get('content-type') || 'audio/mpeg';
  const path = `${CID}/voicemail/${String(sid).replace(/[^a-zA-Z0-9-]/g, '')}.mp3`;
  const up = await admin.storage.from('crm-attachments').upload(path, bytes, { contentType: ct, upsert: true });
  if (up.error) { console.log('[voicemail] upload falhou:', up.error.message); return ok(); }
  const attachment = { name: `Recado ${from || ''}.mp3`.trim(), path, type: 'audio/mpeg', size: bytes.length };

  // casa o número de quem ligou com um contato/empresa → pega o negócio
  const key = phoneKey(from);
  let dealId: string | null = null;
  if (key) {
    const [{ data: cts }, { data: orgs }] = await Promise.all([
      admin.from('crm_contacts').select('id, organization_id, phone').eq('client_id', CID).not('phone', 'is', null),
      admin.from('crm_organizations').select('id, phone').eq('client_id', CID).not('phone', 'is', null),
    ]);
    const ct2 = (cts || []).find((c: any) => phoneKey(c.phone) === key);
    let orgId = ct2?.organization_id || (orgs || []).find((o: any) => phoneKey(o.phone) === key)?.id || null;
    if (orgId) {
      const { data: dl } = await admin.from('crm_deals').select('id').eq('client_id', CID).eq('organization_id', orgId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      dealId = dl?.id || null;
    }
    if (!dealId && ct2?.id) {
      const { data: dl } = await admin.from('crm_deals').select('id').eq('client_id', CID).eq('contact_id', ct2.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      dealId = dl?.id || null;
    }
  }

  // sem correspondência → cria um lead para não perder o contato
  if (!dealId) {
    const { data: pipe } = await admin.from('crm_pipelines').select('id').eq('client_id', CID).eq('is_default', true).limit(1).maybeSingle();
    const pipeId = pipe?.id || (await admin.from('crm_pipelines').select('id').eq('client_id', CID).order('position').limit(1).maybeSingle()).data?.id;
    if (pipeId) {
      const { data: stage } = await admin.from('crm_stages').select('id').eq('pipeline_id', pipeId).order('position').limit(1).maybeSingle();
      const nm = `Lead ${from || 'desconhecido'}`;
      const { data: org } = await admin.from('crm_organizations').insert({ client_id: CID, name: nm, phone: from || null }).select('id').single();
      const { data: ctc } = org ? await admin.from('crm_contacts').insert({ client_id: CID, organization_id: org.id, name: 'Contato (recado)', phone: from || null }).select('id').single() : { data: null } as any;
      const { data: dl } = (org && stage) ? await admin.from('crm_deals').insert({ client_id: CID, pipeline_id: pipeId, stage_id: stage.id, title: nm, organization_id: org.id, contact_id: ctc?.id || null, status: 'open', source: 'Recado (Telnyx)' }).select('id').single() : { data: null } as any;
      dealId = dl?.id || null;
    }
  }
  if (!dealId) { console.log('[voicemail] sem negócio para vincular'); return ok(); }

  await admin.from('crm_activities').insert({
    client_id: CID, deal_id: dealId, type: 'call',
    title: `📞 Correio de voz — ${from || 'número desconhecido'}`,
    notes: `Recado recebido${dur ? ` (${dur}s)` : ''}. Ligou para ${to || 'a INEPAD'}.`,
    attachments: [attachment],
    done: false,
  });
  console.log('[voicemail] atividade criada no deal', dealId);
  return ok();
});
