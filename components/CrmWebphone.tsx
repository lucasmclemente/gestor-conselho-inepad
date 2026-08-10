import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { TelnyxRTC } from '@telnyx/webrtc';
import { PhoneOff, Mic, MicOff, Phone } from 'lucide-react';

type Props = {
  number: string;        // destino em E.164 (+55...)
  contactName?: string;
  onClose: () => void;
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const CrmWebphone: React.FC<Props> = ({ number, contactName, onClose }) => {
  const [status, setStatus] = useState('Conectando…');
  const [live, setLive] = useState(false);   // ligação ativa (áudio)
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const clientRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const startTimer = () => { stopTimer(); timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000); };

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
          if (st === 'ringing' || st === 'early' || st === 'requesting' || st === 'trying') setStatus('Chamando…');
          else if (st === 'active') { setStatus('Em ligação'); setLive(true); startTimer(); }
          else if (st === 'hangup' || st === 'destroy' || st === 'purge') {
            const cause = n.call?.cause || n.call?.causeCode || n.call?.sipCode || '';
            console.log('[webphone] hangup', { cause, causeCode: n.call?.causeCode, sipCode: n.call?.sipCode, call: n.call });
            setStatus(cause ? `Encerrada — ${cause}` : 'Encerrada');
            setLive(false); stopTimer();
          }
        }
      });
      client.connect();
    })();
    return () => { cancelled = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hangup = () => { cleanup(); onClose(); };
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
      <p className="text-xs text-slate-400 mb-4">{number}</p>
      <div className="flex items-center justify-center gap-3">
        <button onClick={toggleMute} disabled={!live} title={muted ? 'Reativar microfone' : 'Mudo'}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all disabled:opacity-40 ${muted ? 'bg-amber-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>
          {muted ? <MicOff size={18} /> : <Mic size={18} />}
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
