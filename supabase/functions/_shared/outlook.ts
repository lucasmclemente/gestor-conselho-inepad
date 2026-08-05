// ============================================================
// Boardplan — CRM: helpers do Outlook/Microsoft Graph.
// ============================================================

export const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'offline_access Mail.Send Mail.ReadWrite User.Read';

// Garante um access_token válido para a conexão (refresh se expirado). Persiste o novo token.
export async function outlookToken(admin: any, conn: any): Promise<string> {
  let accessToken = conn.access_token as string;
  if (new Date(conn.expires_at).getTime() < Date.now() + 60_000) {
    const TENANT = Deno.env.get('OUTLOOK_TENANT_ID') ?? 'organizations';
    const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('OUTLOOK_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('OUTLOOK_CLIENT_SECRET') ?? '',
        grant_type: 'refresh_token', refresh_token: conn.refresh_token,
        scope: Deno.env.get('OUTLOOK_SCOPES') ?? SCOPES,
      }),
    });
    const t = await r.json().catch(() => ({}));
    if (!r.ok || !t.access_token) throw new Error('Sessão do Outlook expirou. Reconecte o e-mail.');
    accessToken = t.access_token;
    await admin.from('crm_outlook_connections').update({
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? conn.refresh_token,
      expires_at: new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('member_id', conn.member_id);
  }
  return accessToken;
}

// escapa texto simples para HTML (corpo do e-mail digitado pela pessoa)
export function esc(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Sincroniza a caixa de entrada: e-mails RECEBIDOS de contatos do CRM viram
// atividades type=email (direction='in') no negócio. Só guarda o que casa com
// um contato cadastrado (privacidade). Cursor por tempo em conn.delta_link.
export async function syncMailbox(admin: any, conn: any, opts: { full?: boolean; debug?: boolean } = {}) {
  const cid = conn.client_id as string;
  const token = await outlookToken(admin, conn);
  const gget = (u: string) => fetch(u.startsWith('http') ? u : `${GRAPH}${u}`, { headers: { Authorization: `Bearer ${token}` } });

  // e-mail do contato → negócio (via empresa OU via contato direto do negócio)
  const [{ data: contacts }, { data: deals }] = await Promise.all([
    admin.from('crm_contacts').select('id, email, organization_id').eq('client_id', cid).not('email', 'is', null),
    admin.from('crm_deals').select('id, organization_id, contact_id').eq('client_id', cid),
  ]);
  const contactById = new Map<string, any>();
  (contacts || []).forEach((c: any) => contactById.set(c.id, c));
  const dealByOrg = new Map<string, any>();
  (deals || []).forEach((d: any) => { if (d.organization_id && !dealByOrg.has(d.organization_id)) dealByOrg.set(d.organization_id, d); });
  const emailToDeal = new Map<string, any>();
  const addEmail = (email: string, deal: any, contactId: string) => {
    const e = String(email || '').trim().toLowerCase();
    if (e && e.includes('@') && !emailToDeal.has(e)) emailToDeal.set(e, { deal, contactId });
  };
  // via empresa: contatos cuja empresa tem negócio
  (contacts || []).forEach((c: any) => { if (c.organization_id && dealByOrg.has(c.organization_id)) addEmail(c.email, dealByOrg.get(c.organization_id), c.id); });
  // via contato direto do negócio (cobre negócios sem empresa)
  (deals || []).forEach((d: any) => { const c = d.contact_id && contactById.get(d.contact_id); if (c) addEmail(c.email, d, c.id); });
  if (emailToDeal.size === 0) return { fetched: 0, matched: 0, created: 0 };

  // dedup por internetMessageId
  const { data: existing } = await admin.from('crm_activities').select('email_msg_id').eq('client_id', cid).not('email_msg_id', 'is', null);
  const seen = new Set<string>((existing || []).map((a: any) => a.email_msg_id));

  // janela desde o último cursor (ou 14 dias). full=ignora o cursor e revê 14 dias.
  const since = (!opts.full && conn.delta_link) ? conn.delta_link : new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const senders: string[] = [];
  const filter = encodeURIComponent(`receivedDateTime ge ${since}`);
  const select = 'subject,from,receivedDateTime,bodyPreview,internetMessageId';
  let urlp = `${GRAPH}/me/mailFolders/inbox/messages?$filter=${filter}&$select=${select}&$orderby=receivedDateTime%20asc&$top=50`;

  const rows: any[] = [];
  let fetched = 0, matched = 0, maxTs = since;
  for (let page = 0; page < 20 && urlp; page++) {
    const r = await gget(urlp);
    if (!r.ok) break;
    const b = await r.json().catch(() => null);
    const items = b?.value || [];
    fetched += items.length;
    for (const msg of items) {
      const ts = msg.receivedDateTime;
      if (ts && ts > maxTs) maxTs = ts;
      const from = String(msg.from?.emailAddress?.address || '').trim().toLowerCase();
      if (opts.debug && senders.length < 15 && from) senders.push(from);
      const hit = emailToDeal.get(from);
      if (!hit) continue;
      matched++;
      const mid = msg.internetMessageId || null;
      if (!mid || seen.has(mid)) continue;
      seen.add(mid);
      rows.push({
        client_id: cid, deal_id: hit.deal.id, contact_id: hit.contactId, type: 'email',
        title: msg.subject || '(sem assunto)', notes: msg.bodyPreview || '',
        owner_member_id: conn.member_id, done: true, done_at: ts || null,
        email_direction: 'in', email_msg_id: mid,
      });
    }
    urlp = b?.['@odata.nextLink'] || '';
  }
  let created = 0;
  if (rows.length) { const { data } = await admin.from('crm_activities').insert(rows).select('id'); created = (data || []).length; }
  await admin.from('crm_outlook_connections').update({ delta_link: maxTs, updated_at: new Date().toISOString() }).eq('member_id', conn.member_id);
  const debug = opts.debug ? {
    since, emailToDealSize: emailToDeal.size,
    sampleContactEmails: [...emailToDeal.keys()].slice(0, 10),
    sampleSenders: senders,
  } : undefined;
  return { fetched, matched, created, debug };
}
