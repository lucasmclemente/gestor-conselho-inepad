import React, { useEffect, useState } from 'react';
import { ShieldCheck, Smartphone, KeyRound, Check, Loader2, LogOut, X, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { BoardplanLogo } from './Brand';

// ─────────────────────────────────────────────────────────────
// MFA (2FA TOTP) — app autenticador (Microsoft/Google Authenticator).
// O fator é gerido pelo Supabase Auth. Aqui tratamos a UX:
//  • EnrollPanel  — cadastra um fator (QR + código)
//  • ChallengePanel — valida o 2º fator no login
//  • MfaGate      — tela cheia (porta de segurança antes do app)
//  • MfaManageModal — gestão self-service (cadastrar/remover) no perfil
// ─────────────────────────────────────────────────────────────

const inputCls = "w-full p-3.5 bg-white border border-slate-200 rounded-lg outline-none font-bold tracking-[0.5em] text-center text-lg focus:border-amber-400 transition-colors";
const primaryBtn = "w-full bg-amber-600 hover:bg-amber-700 text-white py-3.5 rounded-lg font-bold uppercase tracking-widest text-xs shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2";

// Limpa fatores TOTP ainda não verificados (tentativas de cadastro abandonadas)
async function cleanupUnverified() {
  try {
    const { data } = await supabase.auth.mfa.listFactors();
    const stale = (data?.all || []).filter((f: any) => f.status === 'unverified');
    for (const f of stale) { try { await supabase.auth.mfa.unenroll({ factorId: f.id }); } catch { /* ignore */ } }
  } catch { /* ignore */ }
}

// ── Cadastro de um novo fator TOTP ──
const EnrollPanel: React.FC<{ onVerified: () => void }> = ({ onVerified }) => {
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      await cleanupUnverified();
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Boardplan ' + Date.now() });
      if (!alive) return;
      if (error) { setErr(error.message); setStarting(false); return; }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStarting(false);
    })();
    return () => { alive = false; };
  }, []);

  const verify = async () => {
    const c = code.replace(/\D/g, '');
    if (c.length < 6) { setErr('Digite os 6 dígitos do aplicativo.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: c });
    setBusy(false);
    if (error) { setErr('Código inválido ou expirado. Abra o app e tente o código atual.'); setCode(''); return; }
    onVerified();
  };

  if (starting) return <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="animate-spin" size={22} /></div>;

  return (
    <div className="space-y-4">
      <ol className="text-xs text-slate-500 space-y-1.5 list-decimal pl-4 font-semibold">
        <li>Instale um app autenticador (Microsoft Authenticator, Google Authenticator, etc.).</li>
        <li>No app, toque em <b>+</b> e escaneie o QR code abaixo.</li>
        <li>Digite o código de 6 dígitos que o app mostrar.</li>
      </ol>
      {qr && (
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-white border border-slate-200 rounded-xl" style={{ width: 200 }} dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ou digite a chave manualmente</p>
            <code className="text-[11px] font-mono text-slate-600 break-all select-all">{secret}</code>
          </div>
        </div>
      )}
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código do aplicativo</label>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" className={inputCls + " mt-1.5"}
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={e => { if (e.key === 'Enter') verify(); }} autoFocus />
      </div>
      {err && <p className="text-xs text-red-600 font-bold">{err}</p>}
      <button disabled={busy || !factorId} onClick={verify} className={primaryBtn}>
        {busy ? <><Loader2 className="animate-spin" size={16} /> Validando...</> : <><Check size={16} /> Ativar verificação em 2 fatores</>}
      </button>
    </div>
  );
};

// ── Desafio no login (usuário já tem fator) ──
const ChallengePanel: React.FC<{ onVerified: () => void }> = ({ onVerified }) => {
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      if (!alive) return;
      const totp = (data?.totp || [])[0];
      if (totp) setFactorId(totp.id);
    })();
    return () => { alive = false; };
  }, []);

  const verify = async () => {
    const c = code.replace(/\D/g, '');
    if (c.length < 6) { setErr('Digite os 6 dígitos do aplicativo.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: c });
    setBusy(false);
    if (error) { setErr('Código inválido ou expirado. Abra o app e tente o código atual.'); setCode(''); return; }
    onVerified();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
        <Smartphone size={16} className="text-amber-600" /> Abra seu app autenticador e digite o código atual.
      </div>
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código de verificação</label>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" className={inputCls + " mt-1.5"}
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={e => { if (e.key === 'Enter') verify(); }} autoFocus />
      </div>
      {err && <p className="text-xs text-red-600 font-bold">{err}</p>}
      <button disabled={busy || !factorId} onClick={verify} className={primaryBtn}>
        {busy ? <><Loader2 className="animate-spin" size={16} /> Validando...</> : <>Verificar e entrar</>}
      </button>
    </div>
  );
};

// ── Tela cheia: porta de segurança antes de liberar o app ──
export const MfaGate: React.FC<{ stage: 'challenge' | 'enroll'; email?: string; onVerified: () => void; onSignOut: () => void }> = ({ stage, email, onVerified, onSignOut }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans text-slate-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-[#0F172A] px-7 py-6">
          <BoardplanLogo tone="dark" height={34} />
          <div className="mt-4 flex items-center gap-2 text-amber-500 text-[10px] font-bold uppercase tracking-[2px]"><ShieldCheck size={14} /> Verificação em 2 fatores</div>
          <h1 className="text-white text-xl font-bold italic mt-1">{stage === 'enroll' ? 'Ative a verificação em 2 fatores' : 'Confirme sua identidade'}</h1>
          <p className="text-slate-400 text-xs mt-1">{stage === 'enroll' ? 'Sua empresa exige um 2º fator de segurança para acessar o portal.' : (email || 'Falta só mais um passo para entrar.')}</p>
        </div>
        <div className="p-7">
          {stage === 'enroll' ? <EnrollPanel onVerified={onVerified} /> : <ChallengePanel onVerified={onVerified} />}
          <button onClick={onSignOut} className="w-full mt-4 text-center text-xs text-slate-400 hover:text-slate-600 transition-colors font-bold flex items-center justify-center gap-1.5">
            <LogOut size={13} /> Sair
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Modal de gestão (perfil): cadastrar ou remover o 2º fator ──
export const MfaManageModal: React.FC<{ onClose: () => void; required: boolean }> = ({ onClose, required }) => {
  const [loading, setLoading] = useState(true);
  const [hasFactor, setHasFactor] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = (data?.totp || [])[0];
    setHasFactor(!!totp);
    setFactorId(totp?.id || '');
    setEnrolling(false);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const remove = async () => {
    if (required) { alert('Sua empresa exige a verificação em 2 fatores — não é possível removê-la.'); return; }
    if (!confirm('Remover a verificação em 2 fatores desta conta?')) return;
    setRemoving(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setRemoving(false);
    if (error) { alert('Erro ao remover: ' + error.message); return; }
    load();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 not-italic" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-900 px-6 py-5 border-b-4 border-amber-600 flex items-start justify-between">
          <div>
            <p className="text-amber-500 text-[10px] font-bold uppercase tracking-[2px]">Segurança da conta</p>
            <h3 className="text-white text-lg font-bold italic mt-0.5">Verificação em 2 fatores</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="animate-spin" size={22} /></div>
          ) : enrolling ? (
            <EnrollPanel onVerified={load} />
          ) : hasFactor ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <ShieldCheck size={22} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-700">Ativa nesta conta</p>
                  <p className="text-[11px] text-emerald-600">Pedimos o código do seu app a cada login.</p>
                </div>
              </div>
              {required
                ? <p className="text-[11px] text-slate-400 font-semibold">Exigida pela sua empresa — não pode ser removida.</p>
                : <button disabled={removing} onClick={remove} className="w-full py-3 rounded-lg border border-red-200 text-red-600 font-bold text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"><Trash2 size={14} /> {removing ? 'Removendo...' : 'Remover 2 fatores'}</button>}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <KeyRound size={22} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-slate-700">Não configurada</p>
                  <p className="text-[11px] text-slate-500">Adicione uma camada extra de segurança com um app autenticador.</p>
                </div>
              </div>
              <button onClick={() => setEnrolling(true)} className={primaryBtn}><ShieldCheck size={16} /> Configurar agora</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
