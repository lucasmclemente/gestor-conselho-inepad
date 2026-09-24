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
  cid: string; userId: string | null; ext: string;
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

// som de "telefone tocando" enquanto chama (gerado no navegador)
let ringCtx: any = null, ringTimer: any = null;
const startRing = () => {
  if (ringTimer) return;
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ringCtx = new AC();
    const burst = () => {
      if (!ringCtx) return;
      const t = ringCtx.currentTime;
      [440, 480].forEach((f: number) => {
        const o = ringCtx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = ringCtx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
        g.gain.setValueAtTime(0.12, t + 1.0);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        o.connect(g); g.connect(ringCtx.destination); o.start(t); o.stop(t + 1.15);
      });
    };
    try { ringCtx.resume?.(); } catch { /* */ }
    burst(); ringTimer = setInterval(burst, 3000);
  } catch { /* */ }
};
const stopRing = () => { if (ringTimer) { clearInterval(ringTimer); ringTimer = null; } try { ringCtx?.close(); } catch { /* */ } ringCtx = null; };

// REGISTRA a ligação assim que TOCA (não só a atendida) para virar item de retorno.
// Como o "toque simultâneo" faz o telefone tocar em várias abas ao mesmo tempo,
// usamos uma CHAVE COMPARTILHADA (número + janela de tempo) no external_id: o índice
// único (client_id, external_id) garante que só a 1ª aba grave — as demais tomam
// 23505 e saem em silêncio. A aba que atender depois só ATUALIZA esse registro.
async function claimInbound(ext: string, num: string) {
  if (!S) return;
  const cid = S.cid;
  try {
    const key = phoneKey(num);
    let dealId: string | null = null, contactId: string | null = null, orgId: string | null = null, matchedName: string | null = null;
    if (key) {
      const { data: cts } = await supabase.from('crm_contacts').select('id, name, organization_id, phone').eq('client_id', cid).ilike('phone', `%${key}%`).limit(10);
      const ct = (cts || []).find((c: any) => phoneKey(c.phone) === key) || (cts || [])[0];
      if (ct) { contactId = ct.id; orgId = ct.organization_id || null; matchedName = ct.name || null; }
      if (!orgId) { const { data: os } = await supabase.from('crm_organizations').select('id, name, phone').eq('client_id', cid).ilike('phone', `%${key}%`).limit(10); const o = (os || []).find((x: any) => phoneKey(x.phone) === key) || (os || [])[0]; if (o) { orgId = o.id; if (!matchedName) matchedName = o.name || null; } }
      if (orgId) { const { data } = await supabase.from('crm_deals').select('id').eq('client_id', cid).eq('organization_id', orgId).order('created_at', { ascending: false }).limit(1).maybeSingle(); dealId = data?.id || null; }
      if (!dealId && contactId) { const { data } = await supabase.from('crm_deals').select('id').eq('client_id', cid).eq('contact_id', contactId).order('created_at', { ascending: false }).limit(1).maybeSingle(); dealId = data?.id || null; }
    }
    const title = `Ligação recebida — ${matchedName || num || 'número desconhecido'}`;
    // claim atômico: só a 1ª aba grava (índice único em external_id barra o resto)
    const { data: act, error } = await supabase.from('crm_activities').insert({
      client_id: cid, type: 'call', call_direction: 'in', call_answered: false,
      call_number: num || null, external_id: ext, done: false,
      title, notes: 'Ligação recebida — aguardando retorno.',
      contact_id: contactId, organization_id: orgId, deal_id: dealId,
    }).select('id').single();
    if (error || !act) return; // 23505 (outra aba já registrou) ou falha → sai silencioso
    // número desconhecido → cria um lead com o número para poderem retornar
    if (!orgId) {
      const { data: pipe } = await supabase.from('crm_pipelines').select('id').eq('client_id', cid).eq('is_default', true).limit(1).maybeSingle();
      const pipeId = pipe?.id || (await supabase.from('crm_pipelines').select('id').eq('client_id', cid).order('position').limit(1).maybeSingle()).data?.id;
      if (pipeId) {
        const { data: stg } = await supabase.from('crm_stages').select('id').eq('pipeline_id', pipeId).order('position').limit(1).maybeSingle();
        const nm = `Lead ${num || 'desconhecido'}`;
        const { data: org } = await supabase.from('crm_organizations').insert({ client_id: cid, name: nm, phone: num || null }).select('id').single();
        const { data: ctc } = org ? await supabase.from('crm_contacts').insert({ client_id: cid, organization_id: org.id, name: 'Contato (ligação recebida)', phone: num || null }).select('id').single() : { data: null } as any;
        if (org && stg?.id) { const { data: dl } = await supabase.from('crm_deals').insert({ client_id: cid, pipeline_id: pipeId, stage_id: stg.id, title: nm, organization_id: org.id, contact_id: ctc?.id || null, status: 'open', source: 'Ligação recebida' }).select('id').single(); await supabase.from('crm_activities').update({ deal_id: dl?.id || null, contact_id: ctc?.id || null, organization_id: org.id }).eq('id', act.id); }
      }
    }
  } catch { /* */ }
}

// a aba que ATENDEU atualiza o registro compartilhado (por external_id): atendida + fora da fila de retorno
async function markAnswered(ext: string, num: string, secs: number) {
  if (!S) return;
  const cid = S.cid, uid = S.userId;
  try {
    // o claim (feito ao tocar) pode ter sido gravado por OUTRA aba → tenta algumas vezes
    for (let i = 0; i < 4; i++) {
      const { data } = await supabase.from('crm_activities')
        .update({ call_answered: true, done: true, done_at: new Date().toISOString(), owner_member_id: uid || null, call_seconds: secs, call_cause: 'answered', notes: 'Atendida pelo webfone.' })
        .eq('client_id', cid).eq('external_id', ext).select('id');
      if (data && data.length) return;
      await new Promise(r => setTimeout(r, 700));
    }
    // fallback: nenhum claim gravou (falha de rede ao tocar) → cria já o registro atendido
    await supabase.from('crm_activities').insert({
      client_id: cid, type: 'call', call_direction: 'in', call_answered: true, done: true,
      done_at: new Date().toISOString(), owner_member_id: uid || null, call_seconds: secs,
      call_number: num || null, external_id: ext, title: `Ligação recebida — ${num || 'número desconhecido'}`,
      notes: 'Atendida pelo webfone.',
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
    // isola ruído externo (supressão de ruído + cancelamento de eco + ganho automático)
    try { (client as any).setAudioSettings?.({ echoCancellation: true, noiseSuppression: true, autoGainControl: true }); } catch { /* */ }
    S.client = client;
    client.on('telnyx.notification', (n: any) => {
      if (n?.type !== 'callUpdate' || !n.call || !S) return;
      const call = n.call; const st = call.state;
      if (st === 'ringing') {
        S.call = call;
        S.caller = call.options?.remoteCallerNumber || call.remoteCallerNumber || 'Número desconhecido';
        // chave compartilhada entre as abas que tocam juntas (número + janela de 2min)
        S.ext = `in:${phoneKey(S.caller)}:${Math.floor(Date.now() / 120000)}`;
        S.phase = 'ringing'; startRing(); emit();
        claimInbound(S.ext, S.caller); // registra já ao tocar; se ninguém atender fica na fila de retorno
        try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('📞 Ligação recebida', { body: S.caller }); } catch { /* */ }
      } else if (st === 'active') {
        stopRing(); S.answeredAt = Date.now(); S.phase = 'active'; startTimer(); emit();
      } else if (st === 'hangup' || st === 'destroy' || st === 'purge') {
        stopRing();
        const wasActive = S.answeredAt > 0; const secs = S.secondsRef; const num = S.caller; const ext = S.ext;
        stopTimer(); if (wasActive) markAnswered(ext, num, secs);
        S.answeredAt = 0; S.call = null; S.phase = 'idle'; S.muted = false; S.caller = ''; S.ext = ''; emit();
      }
    });
    client.on('telnyx.error', () => { /* reinit periódico recupera */ });
    client.connect();
  } catch { /* */ }
}

// inicia uma única vez; chamadas seguintes só atualizam cid/userId
async function ensureStarted(cid: string, currentUser: any) {
  if (S && S.started) { S.cid = cid; S.userId = currentUser?.id || null; return; }
  S = { client: null, call: null, phase: 'idle', caller: '', seconds: 0, muted: false, timer: null, secondsRef: 0, answeredAt: 0, cid, userId: currentUser?.id || null, ext: '', subs: S?.subs || new Set(), started: true, reinit: null };
  await connect();
  S.reinit = setInterval(() => { if (S && S.phase === 'idle') { try { S.client?.disconnect(); } catch { /* */ } S.client = null; connect(); } }, 45 * 60 * 1000);
}

const answerCall = () => { try { S?.call?.answer(); } catch { /* */ } };
const rejectCall = () => { stopRing(); try { S?.call?.hangup(); } catch { /* */ } if (S) { S.phase = 'idle'; S.caller = ''; emit(); } };
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
