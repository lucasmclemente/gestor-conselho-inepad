import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { TelnyxRTC } from '@telnyx/webrtc';
import { PhoneIncoming, PhoneOff, Phone, Mic, MicOff } from 'lucide-react';

// Webfone de PLANTÃO (recebimento). Fica registrado com a credencial COMPARTILHADA
// de entrada enquanto o CRM está aberto; com "simultaneous ring" na Telnyx, toca em
// todos os usuários logados ao mesmo tempo. Quem atender primeiro pega a ligação.
type Props = { cid: string; currentUser: any };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const digits = (s: string) => (s || '').replace(/\D/g, '');
const phoneKey = (s: string) => { const d = digits(s); return d.length >= 8 ? d.slice(-8) : d; };

export const CrmInboundPhone: React.FC<Props> = ({ cid, currentUser }) => {
  const [phase, setPhase] = useState<'idle' | 'ringing' | 'active'>('idle');
  const [caller, setCaller] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const clientRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const secondsRef = useRef(0);
  const answeredAtRef = useRef(0);
  const reinitRef = useRef<any>(null);
  const callerRef = useRef('');
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const startTimer = () => { stopTimer(); setSeconds(0); secondsRef.current = 0; timerRef.current = setInterval(() => setSeconds(s => { const n = s + 1; secondsRef.current = n; return n; }), 1000); };

  // registra a ligação recebida (atendida) no negócio casado pelo número
  const logInbound = async (num: string, secs: number) => {
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
      if (!dealId) return; // sem correspondência: não cria nada (evita ruído em ligação ao vivo)
      await supabase.from('crm_activities').insert({
        client_id: cid, deal_id: dealId, type: 'call',
        title: `Ligação recebida — ${num}`, notes: 'Atendida pelo webfone.',
        owner_member_id: currentUser?.id || null,
        call_direction: 'in', call_answered: true, call_seconds: secs,
      });
    } catch { /* */ }
  };

  const teardown = () => {
    stopTimer();
    try { callRef.current?.hangup(); } catch { /* */ }
    try { clientRef.current?.disconnect(); } catch { /* */ }
    callRef.current = null; clientRef.current = null;
  };

  const init = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('telnyx-webrtc-token', { body: { action: 'inbound' } });
      if (error || !(data as any)?.token) return; // recebimento não configurado ainda: silencioso
      const client = new TelnyxRTC({ login_token: (data as any).token });
      (client as any).remoteElement = 'telnyx-inbound-audio';
      clientRef.current = client;
      client.on('telnyx.notification', (n: any) => {
        if (n?.type !== 'callUpdate' || !n.call) return;
        const call = n.call;
        const st = call.state;
        // este cliente nunca origina chamadas → qualquer chamada aqui é RECEBIDA
        if (st === 'ringing') {
          callRef.current = call;
          const num = call.options?.remoteCallerNumber || call.remoteCallerNumber || 'Número desconhecido';
          callerRef.current = num;
          setCaller(num);
          setPhase('ringing');
        } else if (st === 'active') {
          answeredAtRef.current = Date.now();
          setPhase('active'); startTimer();
        } else if (st === 'hangup' || st === 'destroy' || st === 'purge') {
          const wasActive = answeredAtRef.current > 0;
          const secs = secondsRef.current;
          const num = callerRef.current;
          stopTimer();
          if (wasActive) logInbound(num, secs);
          answeredAtRef.current = 0;
          callRef.current = null; setPhase('idle'); setMuted(false); setCaller('');
        }
      });
      client.on('telnyx.error', () => { /* deixa o reinit periódico recuperar */ });
      client.connect();
    } catch { /* */ }
  };

  useEffect(() => {
    init();
    // re-registra a cada 45 min quando ocioso (renova o token/conexão)
    reinitRef.current = setInterval(() => {
      if (phaseRef.current === 'idle') { try { clientRef.current?.disconnect(); } catch { /* */ } clientRef.current = null; init(); }
    }, 45 * 60 * 1000);
    return () => { if (reinitRef.current) clearInterval(reinitRef.current); teardown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = () => { try { callRef.current?.answer(); } catch { /* */ } };
  const reject = () => { try { callRef.current?.hangup(); } catch { /* */ } setPhase('idle'); setCaller(''); };
  const hangup = () => { try { callRef.current?.hangup(); } catch { /* */ } };
  const toggleMute = () => { const c = callRef.current; if (!c) return; try { if (muted) c.unmuteAudio(); else c.muteAudio(); setMuted(!muted); } catch { /* */ } };

  return (
    <>
      <audio id="telnyx-inbound-audio" autoPlay />
      {phase !== 'idle' && (
        <div className="fixed bottom-5 left-5 z-50 w-72 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 mb-1">
            <PhoneIncoming size={16} className={phase === 'ringing' ? 'text-emerald-400 animate-pulse' : 'text-emerald-400'} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{phase === 'ringing' ? 'Ligação recebida' : 'Em ligação'}</span>
            {phase === 'active' && <span className="ml-auto text-sm font-bold tabular-nums">{fmt(seconds)}</span>}
          </div>
          <p className="text-base font-bold italic truncate">{caller || 'Número desconhecido'}</p>

          {phase === 'ringing' ? (
            <div className="flex items-center justify-center gap-4 mt-4">
              <button onClick={reject} title="Recusar" className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg"><PhoneOff size={22} /></button>
              <button onClick={answer} title="Atender" className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all shadow-lg animate-pulse"><Phone size={22} /></button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={toggleMute} title={muted ? 'Reativar microfone' : 'Mudo'} className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${muted ? 'bg-amber-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>{muted ? <MicOff size={18} /> : <Mic size={18} />}</button>
              <button onClick={hangup} title="Encerrar" className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg"><PhoneOff size={22} /></button>
            </div>
          )}
          <p className="text-[9px] text-slate-500 text-center mt-3 flex items-center justify-center gap-1"><Phone size={9} /> Boardplan · Recebimento</p>
        </div>
      )}
    </>
  );
};
