import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  'https://conselho.inepadconsulting.com',
  'http://localhost:3000',
]

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const isVercelPreview = /^https:\/\/gestor-conselho-inepad[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || isVercelPreview ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verifica autenticação
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user: callerUser }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !callerUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Verifica autorização — apenas Administrador e SuperAdmin podem criar usuários
  const callerRole = callerUser.user_metadata?.role
  const callerClientId = callerUser.user_metadata?.client_id
  const callerSecClients = Array.isArray(callerUser.user_metadata?.secretary_clients) ? callerUser.user_metadata.secretary_clients : []

  if (!['Administrador', 'SuperAdmin'].includes(callerRole)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.json();
    const { name, email, password, role, client_id, created_by } = body;

    if (!name || !email || !password || !role || !client_id) {
      return new Response(
        JSON.stringify({ error: "Todos os campos são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Administrador só cria usuários no próprio client_id ou nos clientes atribuídos (multi-cliente)
    if (callerRole === 'Administrador' && client_id !== callerClientId && !callerSecClients.includes(client_id)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Administrador não pode criar SuperAdmin
    if (callerRole === 'Administrador' && role === 'SuperAdmin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Cria o usuário no Auth
    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, client_id },
    });

    if (authCreateError) {
      return new Response(
        JSON.stringify({ error: authCreateError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Grava na tabela members com upsert para tolerar tentativas repetidas
    const { error: memberError } = await supabaseAdmin.from("members").upsert([{
      id: authData.user.id,
      name,
      email,
      role,
      client_id,
    }], { onConflict: 'email' });

    if (memberError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: "Erro ao gravar perfil: " + memberError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Log de auditoria — não bloqueia o cadastro se falhar
    try {
      await supabaseAdmin.from("audit_logs").insert([{
        username: created_by || "Sistema",
        action: "Cadastro",
        details: `Novo membro: ${name} (${role}) — ${client_id}`,
        client_id,
      }]);
    } catch (_) { /* silencioso */ }

    return new Response(
      JSON.stringify({ user_id: authData.user.id, message: "Membro cadastrado com sucesso." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno: " + err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
