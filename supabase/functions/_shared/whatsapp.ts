// Envio de WhatsApp via Twilio (BSP) — substitui a Meta Cloud API direta.
// Empacotado no deploy de cada função que importa (igual ics.ts/triggers.ts).
// INERTE sem os secrets: se faltar ACCOUNT_SID/AUTH_TOKEN, devolve ok:false
// sem lançar — o fluxo de e-mail NUNCA quebra por causa do WhatsApp.
//
// Secrets (por ambiente):
//   TWILIO_ACCOUNT_SID      (ex: AC...)
//   TWILIO_AUTH_TOKEN       (segredo — colar no Supabase, nunca no código)
//   TWILIO_WHATSAPP_FROM    (ex: 'whatsapp:+14155238886' = número da Sandbox)
//
// Sandbox: manda TEXTO livre (sendText) para quem fez o "join" — ótimo p/ validar.
// Produção: manda TEMPLATE aprovado (sendTemplate) via Content SID do Twilio.

const TWILIO_API = 'https://api.twilio.com/2010-04-01';
const SANDBOX_FROM = 'whatsapp:+14155238886'; // número padrão da Sandbox do Twilio

// Normaliza telefone para E.164 do Brasil (+55DDDNÚMERO). Devolve null se inválido.
export function toE164BR(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let d = raw.replace(/\D/g, '');          // só dígitos
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);  // 00 = prefixo internacional
  if (!d.startsWith('55')) {
    // 10 (fixo DDD) ou 11 (celular DDD+9) dígitos → acrescenta o 55 do Brasil
    if (d.length === 10 || d.length === 11) d = '55' + d;
    else return null;
  }
  // 55 + DDD(2) + 8 ou 9 dígitos = 12 ou 13 no total
  if (d.length < 12 || d.length > 13) return null;
  return '+' + d;
}

function creds() {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM') || SANDBOX_FROM;
  return { sid, token, from };
}

async function post(sid: string, token: string, params: Record<string, string>): Promise<{ ok: boolean; wam_id?: string; error?: string }> {
  try {
    const res = await fetch(`${TWILIO_API}/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${sid}:${token}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: j?.message || `HTTP ${res.status}` };
    return { ok: true, wam_id: j?.sid };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Mensagem de TEXTO livre (Sandbox, ou dentro da janela de 24h de serviço).
export async function sendText(opts: { to: string; body: string }): Promise<{ ok: boolean; wam_id?: string; error?: string }> {
  const { sid, token, from } = creds();
  if (!sid || !token) return { ok: false, error: 'WhatsApp (Twilio) não configurado' };
  const to = toE164BR(opts.to);
  if (!to) return { ok: false, error: 'Telefone inválido' };
  return post(sid, token, {
    From: from,
    To: `whatsapp:${to}`,
    Body: String(opts.body ?? '').slice(0, 1500),
  });
}

export interface SendTemplateOpts {
  to: string;                          // telefone do membro (qualquer formato; normalizamos)
  contentSid: string;                  // Content SID do template aprovado no Twilio (HX...)
  variables?: Record<string, string>;  // {"1":"...","2":"..."} do corpo/botão
}

// TEMPLATE aprovado (produção) via Content SID do Twilio.
export async function sendTemplate(opts: SendTemplateOpts): Promise<{ ok: boolean; wam_id?: string; error?: string }> {
  const { sid, token, from } = creds();
  if (!sid || !token) return { ok: false, error: 'WhatsApp (Twilio) não configurado' };
  if (!opts.contentSid) return { ok: false, error: 'contentSid obrigatório' };
  const to = toE164BR(opts.to);
  if (!to) return { ok: false, error: 'Telefone inválido' };
  const params: Record<string, string> = {
    From: from,
    To: `whatsapp:${to}`,
    ContentSid: opts.contentSid,
  };
  if (opts.variables && Object.keys(opts.variables).length > 0) {
    params['ContentVariables'] = JSON.stringify(opts.variables);
  }
  return post(sid, token, params);
}
