import React, { useState } from 'react';
import { X, Ban } from 'lucide-react';

const PRESETS = ['Preço', 'Sem orçamento', 'Timing / adiado', 'Escolheu concorrente', 'Sem retorno', 'Não era o perfil'];

type Props = {
  dealTitle?: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
};

export const CrmLostModal: React.FC<Props> = ({ dealTitle, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-in fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2"><Ban size={20} className="text-red-500" /> Marcar como Perdido</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        {dealTitle && <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest truncate">{dealTitle}</p>}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Motivo da perda</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button key={p} onClick={() => setReason(p)} className={`text-[11px] font-bold rounded-full px-3 py-1.5 border transition-all ${reason === p ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-500 border-slate-200 hover:border-red-300'}`}>{p}</button>
            ))}
          </div>
        </div>
        <input autoFocus type="text" placeholder="Ou escreva o motivo..." className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-400" value={reason} onChange={e => setReason(e.target.value)} onKeyDown={e => e.key === 'Enter' && onConfirm(reason)} />
        <div className="flex gap-2">
          <button onClick={() => onConfirm(reason)} className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all"><Ban size={16} /> Confirmar perda</button>
          <button onClick={onClose} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg font-bold text-[10px] uppercase tracking-widest">Cancelar</button>
        </div>
      </div>
    </div>
  );
};
