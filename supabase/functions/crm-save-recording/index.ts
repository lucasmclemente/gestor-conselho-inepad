import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Recebe o áudio gravado no navegador (webphone Telnyx WebRTC) e o guarda no bucket
// privado crm-recordings via service role, vinculando à atividade da ligação.
// A conexão WebRTC do Telnyx não gera eventos de gravação server-side, então a captação
// é feita no cliente e persistida aqui.

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

const MAX_BYTES = 40 * 1024 * 1024; // 40MB — cobre ligações longas em opus

serve(async (req) => {
  const headers = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...headers, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  // Autorização: usuário do CRM (Comercial/Adm/Super)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);
  const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const role = (user.app_metadata as any)?.role;
  const cid = (user.app_metadata as any)?.client_id;
  if (!['SuperAdmin', 'Administrador', 'Comercial'].includes(role)) return json({ error: 'Forbidden' }, 403);

  const body = await req.json().catch(() => ({} as any));
  const activityId = String(body.activityId || '').trim();
  const audioBase64 = String(body.audioB64 || body.audioBase64 || '');
  const seconds = Number(body.seconds || 0);
  const ext = String(body.ext || 'webm').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'webm';
  const mime = String(body.mime || 'audio/webm').slice(0, 60);
  if (!activityId || !audioBase64) return json({ error: 'Parâmetros ausentes (activityId/áudio).' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

  // Isolamento: a atividade tem que ser do mesmo tenant do solicitante (Super pode qualquer)
  const { data: act, error: aerr } = await admin.from('crm_activities').select('id, client_id, recording_id').eq('id', activityId).maybeSingle();
  if (aerr || !act) return json({ error: 'Atividade não encontrada.' }, 404);
  if (role !== 'SuperAdmin' && act.client_id !== cid) return json({ error: 'Sem permissão para esta atividade.' }, 403);
  if (act.recording_id) return json({ ok: true, alreadySaved: true }); // idempotente

  // Decodifica o base64 → bytes (com teto de tamanho)
  let bytes: Uint8Array;
  try {
    const bin = atob(audioBase64);
    if (bin.length > MAX_BYTES) return json({ error: 'Gravação muito grande.' }, 413);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch (_) {
    return json({ error: 'Áudio inválido.' }, 400);
  }
  if (bytes.length < 512) return json({ error: 'Áudio vazio.' }, 400);

  const recId = `web-${activityId}`;
  const path = `${act.client_id}/${recId}.${ext}`;
  const up = await admin.storage.from('crm-recordings').upload(path, bytes, { contentType: mime, upsert: true });
  if (up.error) return json({ error: 'Falha ao salvar o áudio: ' + up.error.message }, 400);

  // Só grava os campos da gravação — call_seconds já é registrado pelo webphone ao finalizar
  await admin.from('crm_activities').update({ recording_id: recId, recording_path: path }).eq('id', activityId);

  return json({ ok: true, recordingId: recId, path });
});
