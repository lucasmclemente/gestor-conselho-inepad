// Token de voto assinado (HMAC-SHA256) — permite registrar UM voto de UM votante
// numa deliberação específica, sem login, de forma não-forjável e com expiração.

const enc = new TextEncoder();

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacBytes(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return new Uint8Array(sig);
}

export async function signVoteToken(secret: string, payload: Record<string, unknown>): Promise<string> {
  const p = b64urlFromBytes(enc.encode(JSON.stringify(payload)));
  const sig = b64urlFromBytes(await hmacBytes(secret, p));
  return `${p}.${sig}`;
}

export async function verifyVoteToken(secret: string, token: string): Promise<any | null> {
  const parts = (token || '').split('.');
  if (parts.length !== 2) return null;
  const [p, sig] = parts;
  const expected = b64urlFromBytes(await hmacBytes(secret, p));
  // comparação em tempo constante
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  let payload: any;
  try { payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))); } catch { return null; }
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}
