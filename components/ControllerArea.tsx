import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Calendar, ChevronLeft, Paperclip, Plus, FileText, ListChecks, Clock, MapPin } from 'lucide-react';

// Área restrita do perfil Controller.
// view='pautas': só as reuniões onde ele é responsável de alguma pauta → vê APENAS as pautas dele,
//   com os materiais daquela pauta e um botão para anexar material (reusa a Edge Function pauta-materials).
// view='acoes': o Plano de Ação dele (ações onde ele é responsável), somente leitura.
// Nunca expõe ordem do dia completa, atas, deliberações nem a aba de materiais da reunião.
export const ControllerArea: React.FC<{ currentUser: any; meetings: any[]; onMeetingUpdated: (m: any) => void; view: 'pautas' | 'acoes' }> = ({ currentUser, meetings, onMeetingUpdated, view }) => {
  const myName = currentUser?.name || '';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);

  const isMine = (p: any) => p && p.type !== 'intervalo' && p.resp === myName;
  const myMeetings = meetings.filter(m => (m.pautas || []).some(isMine));
  const selected = myMeetings.find(m => m.id === selectedId) || null;

  const fmtDate = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '';
  const statusColor = (s: string) => s === 'Concluída' ? 'bg-emerald-100 text-emerald-700' : s === 'Em Andamento' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';

  // Abre um material re-assinando a URL (as URLs salvas expiram em 7 dias)
  const openSigned = async (url: string) => {
    try {
      const m = String(url || '').match(/\/(?:sign|public)\/meeting-files\/(.+?)(?:\?|$)/);
      if (!m) { window.open(url, '_blank'); return; }
      const path = decodeURIComponent(m[1]);
      const { data } = await supabase.storage.from('meeting-files').createSignedUrl(path, 60 * 60 * 24 * 7);
      window.open(data?.signedUrl || url, '_blank');
    } catch { window.open(url, '_blank'); }
  };

  const uploadToPauta = async (meeting: any, pautaIndex: number, file: File) => {
    if (!file) return;
    const p = (meeting.pautas || [])[pautaIndex];
    const target: any = p?.uid ? { pautaUid: p.uid } : { pautaIndex };
    setBusyIdx(pautaIndex);
    try {
      const { data: su, error: e1 } = await supabase.functions.invoke('pauta-materials', { body: { action: 'signUpload', meetingId: meeting.id, fileName: file.name, ...target } });
      if (e1 || su?.error) throw new Error(e1?.message || su?.error);
      const up = await supabase.storage.from('meeting-files').uploadToSignedUrl(su.path, su.token, file);
      if (up.error) throw new Error(up.error.message);
      const { data: cf, error: e2 } = await supabase.functions.invoke('pauta-materials', { body: { action: 'confirm', meetingId: meeting.id, path: su.path, fileName: file.name, ...target } });
      if (e2 || cf?.error) throw new Error(e2?.message || cf?.error);
      const { data: fresh } = await supabase.from('meetings').select('*').eq('id', meeting.id).single();
      if (fresh) onMeetingUpdated(fresh);
    } catch (e: any) { alert('Erro ao anexar: ' + (e?.message || e)); }
    finally { setBusyIdx(null); }
  };

  // ===================== MINHAS AÇÕES =====================
  if (view === 'acoes') {
    const myActions = meetings.flatMap((m: any) => (m.acoes || [])
      .filter((a: any) => { const resps = a.resps?.length > 0 ? a.resps : (a.resp ? [a.resp] : []); return resps.includes(myName); })
      .map((a: any) => ({ ...a, meetingTitle: m.title })));
    const order = (s: string) => s === 'Atrasada' ? 0 : s === 'Pendente' ? 1 : s === 'Em Andamento' ? 2 : 3;
    myActions.sort((a: any, b: any) => order(a.status) - order(b.status));
    const actStatus = (s: string) => s === 'Concluída' ? 'bg-emerald-100 text-emerald-700' : s === 'Atrasada' ? 'bg-red-100 text-red-700' : s === 'Em Andamento' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
    return (
      <div className="space-y-6 animate-in fade-in">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-2"><ListChecks className="text-amber-600" /> Meu Plano de Ação</h1>
          <p className="text-sm text-slate-500 mt-1">As ações sob sua responsabilidade.</p>
        </div>
        {myActions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
            <ListChecks className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="text-slate-500 font-bold">Nenhuma ação atribuída a você</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myActions.map((a: any, i: number) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-slate-800 flex-1">{a.title}</p>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${actStatus(a.status)}`}>{a.status || 'Pendente'}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><Calendar size={11} /> {a.meetingTitle}</span>
                  {a.date && <span className="flex items-center gap-1"><Clock size={11} /> prazo {fmtDate(a.date)}</span>}
                </div>
                {a.obs && <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg p-2 border border-slate-100">{a.obs}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ===================== MINHAS PAUTAS — DETALHE =====================
  if (selected) {
    const myPautas = (selected.pautas || []).map((p: any, idx: number) => ({ p, idx })).filter((x: any) => isMine(x.p));
    return (
      <div className="space-y-6 animate-in fade-in">
        <button onClick={() => setSelectedId(null)} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-amber-600 flex items-center gap-1"><ChevronLeft size={14} /> Minhas pautas</button>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h1 className="text-xl font-bold text-slate-800 italic">{selected.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-slate-400">
            {selected.date && <span className="flex items-center gap-1"><Calendar size={11} /> {fmtDate(selected.date)}{selected.time ? ` · ${selected.time}` : ''}</span>}
            {selected.type && <span className="flex items-center gap-1"><MapPin size={11} /> {selected.type}</span>}
            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor(selected.status)}`}>{selected.status}</span>
          </div>
        </div>

        {myPautas.map(({ p, idx }: any) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-start gap-2">
              <FileText size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800">{p.title || 'Pauta'}</h3>
                {p.tema && <p className="text-sm text-slate-500 mt-0.5">{p.tema}</p>}
                {p.desc && <p className="text-sm text-slate-500 mt-0.5">{p.desc}</p>}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Paperclip size={12} /> Materiais da pauta</p>
              {(p.materiais || []).length > 0 ? (
                <div className="space-y-1.5 mb-3">
                  {(p.materiais || []).map((mat: any, mi: number) => (
                    <button key={mi} onClick={() => openSigned(mat.url)} className="w-full flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 hover:border-amber-300 transition-colors text-left">
                      <FileText size={14} className="text-amber-500 shrink-0" />
                      <span className="flex-1 text-sm text-slate-700 truncate">{mat.name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 shrink-0">Abrir</span>
                    </button>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400 mb-3">Nenhum material ainda.</p>}
              <label className={`w-full py-2.5 rounded-lg font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-2 cursor-pointer border ${busyIdx === idx ? 'opacity-50 pointer-events-none' : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-amber-300'}`}>
                <Plus size={14} /> {busyIdx === idx ? 'Enviando…' : 'Anexar material'}
                <input type="file" className="hidden" disabled={busyIdx !== null} onChange={e => { const f = e.target.files?.[0]; if (f) uploadToPauta(selected, idx, f); (e.target as HTMLInputElement).value = ''; }} />
              </label>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ===================== MINHAS PAUTAS — LISTA =====================
  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-2"><Calendar className="text-amber-600" /> Minhas Pautas</h1>
        <p className="text-sm text-slate-500 mt-1">Reuniões em que você é responsável por algum tema. Você vê apenas as suas pautas e pode anexar os materiais delas.</p>
      </div>
      {myMeetings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
          <Calendar className="mx-auto text-slate-300 mb-3" size={40} />
          <p className="text-slate-500 font-bold">Você não é responsável por nenhuma pauta</p>
          <p className="text-sm text-slate-400 mt-1">Quando a secretaria incluir você como responsável de um tema, a reunião aparecerá aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {myMeetings.map(m => {
            const count = (m.pautas || []).filter(isMine).length;
            return (
              <button key={m.id} onClick={() => setSelectedId(m.id)} className="text-left bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-amber-300 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${statusColor(m.status)}`}>{m.status}</span>
                  <span className="text-[10px] font-bold text-amber-600">{count} pauta{count > 1 ? 's' : ''}</span>
                </div>
                <p className="font-bold text-slate-800 italic leading-tight">{m.title}</p>
                {m.date && <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1"><Calendar size={11} /> {fmtDate(m.date)}{m.time ? ` · ${m.time}` : ''}</p>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
