import React, { useState } from 'react';
import { Phone, X, Delete } from 'lucide-react';

// Discador avulso: teclado para digitar/colar um número e ligar (sem precisar de negócio).
const digits = (s: string) => (s || '').replace(/\D/g, '');
const toE164 = (s: string) => { const d = digits(s); if (d.length >= 12 && d.startsWith('55')) return '+' + d; if (d.length === 10 || d.length === 11) return '+55' + d; return (s || '').trim(); };
const isValidBR = (s: string) => { const d = digits(toE164(s)); return (d.length === 12 || d.length === 13) && d.startsWith('55'); };

export const CrmDialer: React.FC<{ onCall: (e164: string) => void; onClose: () => void }> = ({ onCall, onClose }) => {
  const [num, setNum] = useState('');
  const ok = isValidBR(num);
  const press = (k: string) => setNum(n => n + k);
  const ligar = () => { if (ok) onCall(toE164(num)); };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl w-full max-w-xs p-5 animate-in zoom-in-95" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Discar</span>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full text-slate-300"><X size={18} /></button>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 mb-4">
          <input autoFocus value={num} onChange={e => setNum(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ligar(); }}
            placeholder="Digite ou cole o número" inputMode="tel"
            className="flex-1 bg-transparent outline-none text-lg font-bold tracking-wide placeholder:text-slate-500 placeholder:text-sm placeholder:font-normal" />
          {num && <button onClick={() => setNum(n => n.slice(0, -1))} className="text-slate-400 hover:text-white"><Delete size={18} /></button>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']].map(([d, sub]) => (
            <button key={d} onClick={() => press(d)} className="py-3 rounded-xl bg-white/5 hover:bg-white/15 active:bg-amber-600 transition-all flex flex-col items-center">
              <span className="text-xl font-bold leading-none">{d}</span>
              {sub && <span className="text-[8px] tracking-widest text-slate-400 mt-0.5">{sub}</span>}
            </button>
          ))}
        </div>
        <button onClick={ligar} disabled={!ok} title={ok ? '' : 'Informe um número BR válido (DDD + número)'}
          className="mt-4 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all">
          <Phone size={16} /> Ligar
        </button>
        {num && !ok && <p className="text-[10px] text-amber-400 text-center mt-2">Número inválido — use DDD + número.</p>}
      </div>
    </div>
  );
};
