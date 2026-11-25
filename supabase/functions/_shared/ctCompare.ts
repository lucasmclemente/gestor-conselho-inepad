// Comparação de segredos em tempo constante: hasheia os dois lados (SHA-256,
// comprimento fixo) e compara byte a byte sem early-return. Evita timing attack
// na validação do CRON_SECRET e não vaza o comprimento do segredo.
// Baixo B5 da auditoria 18/11/2026.

export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a ?? '')),
    crypto.subtle.digest('SHA-256', enc.encode(b ?? '')),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}
