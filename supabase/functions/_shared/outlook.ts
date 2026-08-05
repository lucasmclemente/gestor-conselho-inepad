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
