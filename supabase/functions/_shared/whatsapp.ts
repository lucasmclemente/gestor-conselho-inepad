// Envio de templates do WhatsApp via Meta Cloud API (direta, sem BSP).
// Empacotado no deploy de cada função que importa (igual ics.ts/triggers.ts).
// INERTE sem os secrets: se faltar PHONE_NUMBER_ID/ACCESS_TOKEN, devolve ok:false
// sem lançar — o fluxo de e-mail NUNCA quebra por causa do WhatsApp.
//
// Secrets (por ambiente): WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN.
// A API de templates recusa parâmetros com \n, \t ou 4+ espaços → sanitizamos.

const GRAPH_VERSION = 'v21.0';

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

// Remove quebras/tabs/sequências de espaço que a Meta reprova em parâmetro de template.
function sanitizeParam(s: unknown): string {
  return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 1024);
}

export interface SendTemplateOpts {
  to: string;                 // telefone do membro (qualquer formato; normalizamos)
  template: string;           // ex: 'convocacao_reuniao'
  lang?: string;              // default 'pt_BR'
  bodyParams?: string[];      // {{1}}, {{2}}... do corpo
  urlButtonSuffix?: string;   // sufixo dinâmico do botão URL (ex: token/id)
}

export async function sendTemplate(opts: SendTemplateOpts): Promise<{ ok: boolean; wam_id?: string; error?: string }> {
  const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return { ok: false, error: 'WhatsApp não configurado' };

  const to = toE164BR(opts.to);
  if (!to) return { ok: false, error: 'Telefone inválido' };

  const components: any[] = [];
  const bodyParams = (opts.bodyParams || []).map((p) => ({ type: 'text', text: sanitizeParam(p) }));
  if (bodyParams.length > 0) components.push({ type: 'body', parameters: bodyParams });
  if (opts.urlButtonSuffix != null && opts.urlButtonSuffix !== '') {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: sanitizeParam(opts.urlButtonSuffix) }],
    });
  }

  const body = {
    messaging_product: 'whatsapp',
    to: to.replace(/^\+/, ''),   // a Meta aceita sem o '+'
    type: 'template',
    template: {
      name: opts.template,
      language: { code: opts.lang || 'pt_BR' },
      ...(components.length > 0 ? { components } : {}),
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: j?.error?.message || `HTTP ${res.status}` };
    const wam_id = j?.messages?.[0]?.id;
    return { ok: true, wam_id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
