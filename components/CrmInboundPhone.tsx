import React, { useEffect, useReducer } from 'react';
import { supabase } from '../services/supabaseClient';
import { TelnyxRTC } from '@telnyx/webrtc';
import { PhoneIncoming, PhoneOff, Phone, Mic, MicOff } from 'lucide-react';

// Webfone de PLANTÃO (recebimento). Registra com a credencial COMPARTILHADA de
// entrada enquanto o CRM está aberto; com "simultaneous ring" na Telnyx, toca em
// todos os usuários do grupo ao mesmo tempo. Quem atender primeiro pega.
//
// O estado vive num SINGLETON de módulo (fora do React) → a conexão e o áudio
// NÃO caem ao alternar de tela (funil ↔ negócio ↔ carteira). O componente é só a UI.

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const digits = (s: string) => (s || '').replace(/\D/g, '');
const phoneKey = (s: string) => { const d = digits(s); return d.length >= 8 ? d.slice(-8) : d; };

type Sng = {
  client: any; call: any;
  phase: 'idle' | 'ringing' | 'active'; caller: string; seconds: number; muted: boolean;
  timer: any; secondsRef: number; answeredAt: number;
  cid: string; userId: string | null;
  subs: Set<() => void>; started: boolean; reinit: any;
};
let S: Sng | null = null;
const emit = () => { S?.subs.forEach(fn => { try { fn(); } catch { /* */ } }); };

const ensureAudio = () => {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('telnyx-inbound-audio')) {
    const el = document.createElement('audio');
    el.id = 'telnyx-inbound-audio'; (el as any).autoplay = true; el.style.display = 'none';
    document.body.appendChild(el);
  }
};

const stopTimer = () => { if (S?.timer) { clearInterval(S.timer); S.timer = null; } };
const startTimer = () => { stopTimer(); if (!S) return; S.seconds = 0; S.secondsRef = 0; S.timer = setInterval(() => { if (!S) return; S.secondsRef += 1; S.seconds = S.secondsRef; emit(); }, 1000); };

// registra a ligação recebida (atendida) no negócio casado pelo número
async function logInbound(num: string, secs: number) {
  if (!S) return;
  const cid = S.cid, uid = S.userId;
  try {
    const key = phoneKey(num);
    if (!key) return;
    const [{ data: cts }, { data: orgs }] = await Promise.all([
      supabase.from('crm_contacts').select('id, organization_id, phone').eq('client_id', cid).not('phone', 'is', null),
      supabase.from('crm_organizations').select('id, phone').eq('client_id', cid).not('phone', 'is', null),
    ]);
    const ct = (cts || []).find((c: any) => phoneKey(c.phone) === key);
    const orgId = ct?.organization_id || (orgs || []).find((o: any) => phoneKey(o.phone) === key)?.id || null;
    let dealId: string | null = null;
    if (orgId) { const { data } = await supabase.from('crm_deals').select('id').eq('client_id', cid).eq('organization_id', orgId).order('created_at', { ascending: false }).limit(1).maybeSingle(); dealId = data?.id || null; }
    if (!dealId && ct?.id) { const { data } = await supabase.from('crm_deals').select('id').eq('client_id', cid).eq('contact_id', ct.id).order('created_at', { ascending: false }).limit(1).maybeSingle(); dealId = data?.id || null; }
    if (!dealId) return;
    await supabase.from('crm_activities').insert({
      client_id: cid, deal_id: dealId, type: 'call',
      title: `Ligação recebida — ${num}`, notes: 'Atendida pelo webfone.',
      owner_member_id: uid || null, call_direction: 'in', call_answered: true, call_seconds: secs,
      call_number: num, call_cause: 'answered',
    });
  } catch { /* */ }
}

async function connect() {
  if (!S) return;
  try {
    // só registra (toca) se o usuário estiver no grupo "quem recebe ligações"
    const { data: agent } = await supabase.from('crm_inbound_agents').select('member_id').eq('client_id', S.cid).eq('member_id', S.userId).maybeSingle();
    if (!agent) return;
    const { data, error } = await supabase.functions.invoke('telnyx-webrtc-token', { body: { action: 'inbound' } });
    if (error || !(data as any)?.token) return;
    ensureAudio();
    const client = new TelnyxRTC({ login_token: (data as any).token });
    (client as any).remoteElement = 'telnyx-inbound-audio';
    S.client = client;
    client.on('telnyx.notification', (n: any) => {
      if (n?.type !== 'callUpdate' || !n.call || !S) return;
      const call = n.call; const st = call.state;
      if (st === 'ringing') {
        S.call = call;
        S.caller = call.options?.remoteCallerNumber || call.remoteCallerNumber || 'Número desconhecido';
        S.phase = 'ringing'; emit();
      } else if (st === 'active') {
        S.answeredAt = Date.now(); S.phase = 'active'; startTimer(); emit();
      } else if (st === 'hangup' || st === 'destroy' || st === 'purge') {
        const wasActive = S.answeredAt > 0; const secs = S.secondsRef; const num = S.caller;
        stopTimer(); if (wasActive) logInbound(num, secs);
        S.answeredAt = 0; S.call = null; S.phase = 'idle'; S.muted = false; S.caller = ''; emit();
      }
    });
    client.on('telnyx.error', () => { /* reinit periódico recupera */ });
    client.connect();
  } catch { /* */ }
}

// inicia uma única vez; chamadas seguintes só atualizam cid/userId
async function ensureStarted(cid: string, currentUser: any) {
  if (S && S.started) { S.cid = cid; S.userId = currentUser?.id || null; return; }
  S = { client: null, call: null, phase: 'idle', caller: '', seconds: 0, muted: false, timer: null, secondsRef: 0, answeredAt: 0, cid, userId: currentUser?.id || null, subs: S?.subs || new Set(), started: true, reinit: null };
  await connect();
  S.reinit = setInterval(() => { if (S && S.phase === 'idle') { try { S.client?.disconnect(); } catch { /* */ } S.client = null; connect(); } }, 45 * 60 * 1000);
}

const answerCall = () => { try { S?.call?.answer(); } catch { /* */ } };
const rejectCall = () => { try { S?.call?.hangup(); } catch { /* */ } if (S) { S.phase = 'idle'; S.caller = ''; emit(); } };
const hangupCall = () => { try { S?.call?.hangup(); } catch { /* */ } };
const toggleMuteCall = () => { const c = S?.call; if (!c || !S) return; try { if (S.muted) c.unmuteAudio(); else c.muteAudio(); S.muted = !S.muted; emit(); } catch { /* */ } };

export const CrmInboundPhone: React.FC<{ cid: string; currentUser: any }> = ({ cid, currentUser }) => {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    ensureStarted(cid, currentUser);
    const fn = () => force();
    const subs = (S as Sng).subs; subs.add(fn);
    return () => { subs.delete(fn); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, currentUser?.id]);

  const s = S;
  if (!s || s.phase === 'idle') return null;
  return (
    <div className="fixed bottom-5 left-5 z-50 w-72 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 mb-1">
        <PhoneIncoming size={16} className="text-emerald-400 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{s.phase === 'ringing' ? 'Ligação recebida' : 'Em ligação'}</span>
        {s.phase === 'active' && <span className="ml-auto text-sm font-bold tabular-nums">{fmt(s.seconds)}</span>}
      </div>
      <p className="text-base font-bold italic truncate">{s.caller || 'Número desconhecido'}</p>
      {s.phase === 'ringing' ? (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button onClick={rejectCall} title="Recusar" className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg"><PhoneOff size={22} /></button>
          <button onClick={answerCall} title="Atender" className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all shadow-lg animate-pulse"><Phone size={22} /></button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={toggleMuteCall} title={s.muted ? 'Reativar microfone' : 'Mudo'} className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${s.muted ? 'bg-amber-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>{s.muted ? <MicOff size={18} /> : <Mic size={18} />}</button>
          <button onClick={hangupCall} title="Encerrar" className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg"><PhoneOff size={22} /></button>
        </div>
      )}
      <p className="text-[9px] text-slate-500 text-center mt-3 flex items-center justify-center gap-1"><Phone size={9} /> Boardplan · Recebimento</p>
    </div>
  );
};
