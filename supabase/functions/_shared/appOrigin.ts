// Valida o `appOrigin` recebido no corpo contra o allowlist de origens conhecidas
// (as mesmas do CORS), evitando que um link/token caia num host arbitrário
// (open-redirect). Cai no `fallback` em qualquer divergência de host/esquema.
// Baixo B2 da auditoria 18/11/2026.

const ALLOWED_ORIGINS = [
  'https://conselho.inepadconsulting.com',
  'https://app.boardplan.com.br',
  'http://localhost:3000',
];
const PREVIEW = /^https:\/\/gestor-conselho-in[a-z0-9-]*\.vercel\.app$/;

export function safeAppOrigin(appOrigin: unknown, fallback = 'https://app.boardplan.com.br'): string {
  if (typeof appOrigin !== 'string') return fallback;
  const o = appOrigin.trim().replace(/\/+$/, '');
  return (ALLOWED_ORIGINS.includes(o) || PREVIEW.test(o)) ? o : fallback;
}
