import React from 'react';
import { X, AlertTriangle, Clock, CheckSquare, Bell } from 'lucide-react';

const ACT_LABEL: Record<string, string> = { call: 'Ligação', meeting: 'Reunião', email: 'E-mail', whatsapp: 'WhatsApp', task: 'Tarefa', note: 'Nota' };
const fmtTime = (s: string) => { try { return new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString('pt-BR'); } catch { return ''; } };

type Props = {
  overdue: any[];
  today: any[];
  canNotify: boolean;
  onEnableNotify: () => void;
  onOpenDeal: (id: string) => void;
  onClose: () => void;
};

export const CrmBriefing: React.FC<Props> = ({ overdue, today, canNotify, onEnableNotify, onOpenDeal, onClose }) => {
  const Row = ({ t, late }: { t: any; late?: boolean }) => (
    <button onClick={() => t.deal_id && onOpenDeal(t.deal_id)} className="w-full px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-all text-left rounded-lg">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800 italic truncate">{t.title || ACT_LABEL[t.type] || 'Tarefa'}</p>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide truncate">{ACT_LABEL[t.type] || t.type}{t.deal?.title ? ` • ${t.deal.title}` : ''}</p>
      </div>
      <span className={`text-[11px] font-bold shrink-0 ${late ? 'text-red-500' : 'text-amber-600'}`}>{late ? fmtDate(t.due_at) : fmtTime(t.due_at)}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 italic tracking-tight flex items-center gap-2"><CheckSquare size={18} className="text-amber-600" /> Suas tarefas de hoje</h3>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          {overdue.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase text-red-500 tracking-widest flex items-center gap-1.5 px-1"><AlertTriangle size={12} /> Atrasadas ({overdue.length})</p>
              <div className="space-y-0.5">{overdue.map(t => <Row key={t.id} t={t} late />)}</div>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase text-amber-600 tracking-widest flex items-center gap-1.5 px-1"><Clock size={12} /> Para hoje ({today.length})</p>
            {today.length === 0
              ? <p className="px-4 py-3 text-sm text-slate-400 italic">Nada vencendo hoje. 🎉</p>
              : <div className="space-y-0.5">{today.map(t => <Row key={t.id} t={t} />)}</div>}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {!canNotify
            ? <button onClick={onEnableNotify} className="text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:text-amber-600 flex items-center gap-1"><Bell size={12} /> Ativar avisos do navegador</button>
            : <span className="text-[10px] text-slate-400 italic flex items-center gap-1"><Bell size={11} /> Avisos ativados</span>}
          <button onClick={onClose} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest">Entendi</button>
        </div>
      </div>
    </div>
  );
};
