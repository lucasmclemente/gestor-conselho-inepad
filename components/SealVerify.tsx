import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { ShieldCheck, XCircle, Clock, Ban } from 'lucide-react';

const TIERS: Record<string, { label: string; color: string; bg: string }> = {
  ouro: { label: 'Ouro', color: '#b45309', bg: '#fffbeb' },
  prata: { label: 'Prata', color: '#475569', bg: '#f1f5f9' },
  bronze: { label: 'Bronze', color: '#9a3412', bg: '#fff7ed' },
};

const fmt = (d: string) => { try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return '—'; } };

export const SealVerify = ({ code }: { code: string }) => {
  const [loading, setLoading] = useState(true);
  const [res, setRes] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('verify-seal', { body: { code } });
        setRes(data);
      } catch { setRes({ found: false }); }
      finally { setLoading(false); }
    })();
  }, [code]);

  const t = res?.level ? TIERS[res.level] : null;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-slate-900 px-8 py-6 text-center border-b-4 border-amber-600">
          <p className="text-amber-500 text-[11px] font-bold uppercase tracking-[3px]">Selo de Governança</p>
          <p className="text-white text-sm font-bold mt-1">INEPAD Governança e Sucessão</p>
        </div>

        <div className="p-8">
          {loading ? (
            <p className="text-center text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse py-10">Verificando…</p>
          ) : !res?.found ? (
            <div className="text-center py-6">
              <XCircle size={48} className="mx-auto text-red-400 mb-3" />
              <p className="font-bold text-slate-800 text-lg">Selo não encontrado</p>
              <p className="text-sm text-slate-500 mt-1">O código <b>{code}</b> não corresponde a nenhum selo emitido.</p>
            </div>
          ) : (
            <div className="text-center">
              {res.valid ? (
                <>
                  <div className="w-28 h-28 mx-auto rounded-full flex flex-col items-center justify-center text-white shadow-lg mb-4" style={{ background: t?.color }}>
                    <ShieldCheck size={34} />
                    <span className="text-[11px] font-black uppercase tracking-widest mt-1">{t?.label}</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full"><ShieldCheck size={12} /> Selo válido</span>
                </>
              ) : (
                <>
                  <div className="w-28 h-28 mx-auto rounded-full flex items-center justify-center bg-slate-100 text-slate-400 mb-4">
                    {res.status === 'revogado' ? <Ban size={34} /> : <Clock size={34} />}
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
                    {res.status === 'revogado' ? 'Selo revogado' : 'Selo expirado'}
                  </span>
                </>
              )}

              <p className="text-2xl font-black text-slate-800 italic mt-4">{res.client_name}</p>
              <p className="text-sm text-slate-500">Selo de Governança nível <b style={{ color: t?.color }}>{t?.label}</b></p>

              <div className="mt-5 grid grid-cols-2 gap-3 text-left">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Emitido em</p>
                  <p className="text-sm font-bold text-slate-700">{fmt(res.issued_at)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Válido até</p>
                  <p className="text-sm font-bold text-slate-700">{fmt(res.valid_until)}</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-4">Código de verificação: <b className="text-slate-600">{res.code}</b></p>
            </div>
          )}
        </div>

        <div className="px-8 py-4 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400">Verificação oficial · Boardplan • INEPAD Governança e Sucessão</p>
        </div>
      </div>
    </div>
  );
};
