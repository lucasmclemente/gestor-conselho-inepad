import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { TelnyxRTC } from '@telnyx/webrtc';
import { PhoneOff, Mic, MicOff, Phone, Grid3x3 } from 'lucide-react';

type Props = {
  number: string;        // destino em E.164 (+55...)
  contactName?: string;
  dealId: string;
  cid: string;
  contactId?: string | null;
  ownerId?: string | null;      // usuário que discou (atribuição)
  onLogged?: (activity: any) => void;  // devolve a atividade criada ao abrir a ligação
  onClose: () => void;
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const CrmWebphone: React.FC<Props> = ({ number, contactName, dealId, cid, contactId, ownerId, onLogged, onClose }) => {
  const [status, setStatus] = useState('Conectando…');
  const [live, setLive] = useState(false);   // ligação ativa (áudio)
  const [muted, setMuted] = useState(false);
  const [showPad, setShowPad] = useState(false);
  const [dtmfLog, setDtmfLog] = useState('');
  const [seconds, setSeconds] = useState(0);
  const clientRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const answeredRef = useRef(false);   // ligação chegou a ser atendida?
  const secondsRef = useRef(0);        // duração falada (espelho do state p/ closures)
  const finalizedRef = useRef(false);  // evita gravar métricas 2x
  const activityIdRef = useRef<string | null>(null);        // criada só quando a chamada toca
  const createPromiseRef = useRef<Promise<string | null> | null>(null); // single-flight da criação

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const startTimer = () => { stopTimer(); timerRef.current = setInterval(() => setSeconds(s => { const n = s + 1; secondsRef.current = n; return n; }), 1000); };

  // cria a atividade da ligação — SÓ na 1ª vez que a chamada toca/conecta (não no clique).
  // Se a chamada falhar antes de tocar, nada é registrado.
  const ensureActivity = (): Promise<string | null> => {
    if (activityIdRef.current) return Promise.resolve(activityIdRef.current);
    if (createPromiseRef.current) return createPromiseRef.current;
    createPromiseRef.current = (async () => {
      try {
        const { data } = await supabase.from('crm_activities').insert({
          client_id: cid, deal_id: dealId, contact_id: contactId || null, type: 'call',
          title: `Ligação (webphone) — ${contactName || number}`, notes: `Número: ${number}`,
          owner_member_id: ownerId || null,
        }).select().single();
        if (data) { activityIdRef.current = data.id; onLogged?.(data); return data.id; }
      } catch { /* */ }
      return null;
    })();
    return createPromiseRef.current;
  };

  // grava métricas da ligação (atendida/duração/direção) — só se a atividade chegou a existir
  const finalize = async () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    // se a criação (ao tocar) ainda está em andamento, espera para gravar as métricas
    const id = activityIdRef.current || (createPromiseRef.current ? await createPromiseRef.current : null);
    if (!id) return; // nunca tocou → não registra ligação
    try {
      await supabase.from('crm_activities').update({
        call_answered: answeredRef.current,
        call_seconds: secondsRef.current,
        call_direction: 'out',
      }).eq('id', id);
    } catch { /* */ }
  };

  const cleanup = () => {
    stopTimer();
    try { callRef.current?.hangup(); } catch { /* */ }
    try { clientRef.current?.disconnect(); } catch { /* */ }
    callRef.current = null; clientRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke('telnyx-webrtc-token', { body: {} });
      if (cancelled) return;
      if (error || !(data as any)?.token) {
        let m = error?.message || 'sem token';
        try { const b = await (error as any)?.context?.json?.(); if (b?.error) m = b.error; } catch { /* */ }
        setStatus('Erro: ' + m);
        return;
      }
      const token = (data as any).token;
      const callerId = (data as any).callerId;
      const client = new TelnyxRTC({ login_token: token });
      (client as any).remoteElement = 'telnyx-remote-audio';
      clientRef.current = client;

      client.on('telnyx.ready', () => {
        if (cancelled) return;
        setStatus('Chamando…');
        try {
          callRef.current = (client as any).newCall({ destinationNumber: number, callerNumber: callerId, audio: true, video: false });
        } catch (e) { setStatus('Falha ao discar'); }
      });
      client.on('telnyx.error', () => setStatus('Erro de conexão'));
      client.on('telnyx.socket.error', () => setStatus('Erro de conexão'));
      client.on('telnyx.notification', (n: any) => {
        if (n?.type === 'callUpdate' && n.call) {
          const st = n.call.state;
          if (st === 'ringing' || st === 'early') { setStatus('Chamando…'); ensureActivity(); } // tocou → registra a ligação
          else if (st === 'requesting' || st === 'trying') setStatus('Chamando…');               // ainda não tocou
          else if (st === 'active') {
            setStatus('Em ligação'); setLive(true); answeredRef.current = true; startTimer();
            // guarda o call_session_id da Telnyx na atividade → o webhook casa a gravação
            try {
              const ids = (callRef.current as any)?.telnyxIDs || n.call?.telnyxIDs;
              const sid = ids?.telnyxSessionId;
              ensureActivity().then(id => { if (sid && id) supabase.from('crm_activities').update({ external_id: sid }).eq('id', id).then(() => {}, () => {}); });
            } catch { /* */ }
          }
          else if (st === 'hangup' || st === 'destroy' || st === 'purge') {
            const cause = n.call?.cause || n.call?.causeCode || n.call?.sipCode || '';
            console.log('[webphone] hangup', { cause, causeCode: n.call?.causeCode, sipCode: n.call?.sipCode, call: n.call });
            setStatus(cause ? `Encerrada — ${cause}` : 'Encerrada');
            setLive(false); stopTimer(); finalize();
          }
        }
      });
      client.connect();
    })();
    return () => { cancelled = true; finalize(); cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendDtmf = (d: string) => {
    try { (callRef.current as any)?.dtmf(d); setDtmfLog(prev => (prev + d).slice(-16)); } catch { /* */ }
  };
  const hangup = () => { finalize(); cleanup(); onClose(); };
  const toggleMute = () => {
    const c = callRef.current; if (!c) return;
    try { if (muted) c.unmuteAudio(); else c.muteAudio(); setMuted(!muted); } catch { /* */ }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 w-72 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-4 animate-in fade-in slide-in-from-bottom-2">
      <audio id="telnyx-remote-audio" autoPlay />
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{status}</span>
        {live && <span className="ml-auto text-sm font-bold tabular-nums">{fmt(seconds)}</span>}
      </div>
      <p className="text-sm font-bold italic truncate">{contactName || 'Contato'}</p>
      <p className="text-xs text-slate-400">{number}</p>
      {dtmfLog && <p className="text-[11px] text-amber-400 font-bold tabular-nums mt-1 flex items-center gap-1"><Grid3x3 size={11} /> {dtmfLog}</p>}

      {showPad && (
        <div className="grid grid-cols-3 gap-1.5 my-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k => (
            <button key={k} onClick={() => sendDtmf(k)} className="py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-amber-600 text-white text-lg font-bold transition-all">{k}</button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-3 mt-4">
        <button onClick={toggleMute} disabled={!live} title={muted ? 'Reativar microfone' : 'Mudo'}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all disabled:opacity-40 ${muted ? 'bg-amber-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>
          {muted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button onClick={() => setShowPad(p => !p)} title="Teclado (menus/ramais)"
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${showPad ? 'bg-amber-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>
          <Grid3x3 size={18} />
        </button>
        <button onClick={hangup} title="Encerrar"
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg">
          <PhoneOff size={22} />
        </button>
      </div>
      <p className="text-[9px] text-slate-500 text-center mt-3 flex items-center justify-center gap-1"><Phone size={9} /> Boardplan Webphone · Telnyx</p>
    </div>
  );
};
