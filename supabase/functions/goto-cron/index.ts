// ============================================================
// Boardplan — CRM: cron diário de sincronização de ligações da GoTo.
// Protegida por header x-cron-secret == GOTO_CRON_SECRET (sem JWT).
// Para cada cliente com telefonia conectada, roda o sync (últimos 2 dias).
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runSync, refreshConn } from "../_shared/gotoSync.ts";

serve(async (req) => {
  const json = (b: object, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

  const secret = Deno.env.get('GOTO_CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'Forbidden' }, 403);

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const { data: conns } = await admin.from('crm_goto_connections').select('*');

  // uma conexão por cliente (evita rodar o mesmo tenant várias vezes)
  const byClient = new Map<string, any>();
  for (const c of (conns || [])) if (c.client_id && !byClient.has(c.client_id)) byClient.set(c.client_id, c);

  const ran: any[] = [];
  for (const conn of byClient.values()) {
    try {
      const accessToken = await refreshConn(admin, conn);
      const r = await runSync(admin, accessToken, conn.client_id, { days: 2, autoCreate: true });
      ran.push({ client_id: conn.client_id, fetched: r.fetched, created: r.created, leadsCreated: r.leadsCreated, backfilled: r.backfilled });
    } catch (e) {
      ran.push({ client_id: conn.client_id, error: String((e as any)?.message || e) });
    }
  }
  return json({ ok: true, at: new Date().toISOString(), clients: byClient.size, ran });
});
