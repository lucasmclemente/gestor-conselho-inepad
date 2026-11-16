import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// provision-sso — chamada pelo frontend logo após um login via SSO (SAML).
//
// Por que existe: o SSO do Supabase NÃO vincula a contas existentes — quem entra
// por SSO vira um usuário novo (UUID diferente), SEM papel/empresa no app_metadata.
// Esta função aplica o modelo ALLOWLIST combinado com o Lucas:
//   • descobre o domínio do e-mail do usuário SSO;
//   • acha o(s) cliente(s) com SSO habilitado que são donos desse domínio;
//   • exige que o e-mail JÁ seja um membro cadastrado de um desses clientes;
//       - se for: grava role + client_id no app_metadata do usuário SSO, reconcilia
//         o registro de membro para apontar ao usuário SSO e remove a conta antiga
//         (senha) duplicada, deixando SSO como único login;
//       - se NÃO for: remove a conta SSO avulsa e devolve ok:false (o front desloga
//         e mostra a mensagem). Ninguém fora da lista entra.
// Não exige 2FA do app (decisão: o MFA dos funcionários vem do próprio provedor).
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://conselho.inepadconsulting.com', 'https://app.boardplan.com.br',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const isVercelPreview = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/.test(origin);
  const allowed = ALLOWED_ORIGINS.includes(origin) || isVercelPreview ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ ok: false, reason: 'unauthorized' }, 401, cors);

  // Identifica o usuário recém-logado pelo próprio JWT
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
  if (authErr || !user) return json({ ok: false, reason: 'unauthorized' }, 401, cors);

  const email = (user.email || '').trim().toLowerCase();
  const domain = email.split('@')[1] || '';
  if (!email || !domain) return json({ ok: false, reason: 'no_email' }, 400, cors);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // 1) Clientes com SSO habilitado donos deste domínio
    const { data: clients } = await admin
      .from('clients')
      .select('client_id, sso_enabled, sso_domains')
      .eq('sso_enabled', true)
      .contains('sso_domains', [domain]);
    const clientIds = (clients || []).map((c: any) => c.client_id);
    if (clientIds.length === 0) {
      await admin.auth.admin.deleteUser(user.id).catch(() => {});
      return json({ ok: false, reason: 'domain_not_enabled' }, 200, cors);
    }

    // 2) Allowlist: o e-mail precisa já ser membro de um desses clientes
    const { data: members } = await admin
      .from('members')
      .select('id, name, role, client_id, email')
      .ilike('email', email)
      .in('client_id', clientIds);
    const member = (members || [])[0];
    if (!member) {
      await admin.auth.admin.deleteUser(user.id).catch(() => {});
      return json({ ok: false, reason: 'not_member' }, 200, cors);
    }

    // 3) Provisiona: grava papel + empresa no usuário SSO (app_metadata = segurança)
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { role: member.role, client_id: member.client_id },
    });

    // 4) Reconcilia: aponta o registro de membro ao usuário SSO e remove a conta
    //    (senha) antiga duplicada — SSO passa a ser o único login daquela pessoa.
    if (member.id && member.id !== user.id) {
      await admin.from('members').update({ id: user.id }).eq('email', member.email);
      await admin.auth.admin.deleteUser(member.id).catch(() => {});
    }

    await admin.from('audit_logs').insert([{
      username: member.name || email,
      action: 'Login SSO',
      details: `Acesso via SSO (domínio ${domain})`,
      client_id: member.client_id,
    }]).catch(() => {});

    return json({ ok: true, client_id: member.client_id, role: member.role }, 200, cors);
  } catch (err) {
    return json({ ok: false, reason: 'error', message: (err as Error).message }, 500, cors);
  }
});
