import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

// Página pública de coleta de indicadores (sem login) — acessada via ?coleta=
export const PublicCollect: React.FC<{ token: string }> = ({ token }) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'error'>('loading');
  const [info, setInfo] = useState<any>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('collect-readings', { body: { token, action: 'info' } });
        if (error || data?.error) throw new Error(error?.message || data?.error);
        const pref: Record<string, string> = {};
        (data.indicators || []).forEach((i: any) => { if (i.current !== null && i.current !== undefined) pref[i.id] = String(i.current); });
        setVals(pref); setInfo(data); setStatus('ready');
      } catch (e: any) { setErrMsg(e?.message || 'Link inválido ou expirado.'); setStatus('error'); }
    })();
  }, [token]);

  const submit = async () => {
    const values = (info.indicators || [])
      .filter((i: any) => { const v = vals[i.id]; return v !== undefined && v !== '' && !isNaN(Number(v)); })
      .map((i: any) => ({ indicator_id: i.id, value: Number(vals[i.id]) }));
    if (values.length === 0) { setErrMsg('Preencha ao menos um valor.'); return; }
    setSaving(true); setErrMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('collect-readings', { body: { token, action: 'submit', values } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setSavedCount(data.ok || 0); setStatus('done');
    } catch (e: any) { setErrMsg(e?.message || 'Erro ao enviar os dados.'); }
    finally { setSaving(false); }
  };

  const periodLabel = info?.period ? new Date(info.period + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '';

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 p-6 text-center border-b-4 border-amber-600">
          <p className="text-amber-500 text-[10px] font-bold uppercase tracking-[2px]">Coleta de Indicadores • Governança</p>
          {info && <p className="text-white font-bold italic mt-1">{info.clientName} — {periodLabel}</p>}
        </div>
        <div className="p-8">
          {status === 'loading' && <p className="text-center text-amber-600 font-bold uppercase animate-pulse py-8">Carregando...</p>}
          {status === 'error' && <div className="text-center py-4"><div className="text-5xl mb-3">⚠️</div><p className="font-bold text-slate-800">Não foi possível abrir a coleta</p><p className="text-sm text-slate-500 mt-2">{errMsg}</p></div>}
          {status === 'ready' && info && (
            <>
              <p className="text-xs text-slate-500 mb-4">Preencha os valores dos indicadores referentes a <b className="text-slate-800">{periodLabel}</b>. Campos em branco são ignorados.</p>
              {info.indicators.length === 0 ? <p className="text-sm text-slate-400">Nenhum indicador cadastrado para esta empresa.</p> : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {info.indicators.map((i: any) => (
                    <div key={i.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-800 italic truncate">{i.name}</p>{i.category && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{i.category}</p>}</div>
                      <input type="number" step="any" value={vals[i.id] ?? ''} onChange={e => setVals({ ...vals, [i.id]: e.target.value })} placeholder="—" className="w-28 p-2.5 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm text-right" />
                      <span className="text-[11px] text-slate-400 w-8">{i.unit || ''}</span>
                    </div>
                  ))}
                </div>
              )}
              {errMsg && <p className="text-xs text-red-500 mt-3">{errMsg}</p>}
              <button disabled={saving} onClick={submit} className="w-full mt-5 bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-xl font-bold uppercase text-[11px] tracking-[2px] flex items-center justify-center gap-2 transition-all shadow-xl disabled:opacity-50">{saving ? 'Enviando...' : 'Enviar dados'}</button>
            </>
          )}
          {status === 'done' && (
            <div className="text-center py-4"><div className="text-5xl mb-3">✅</div><p className="font-bold text-slate-800 text-lg">Dados enviados!</p><p className="text-sm text-slate-500 mt-2"><b>{savedCount}</b> indicador(es) registrado(s) para {periodLabel}.</p><p className="text-xs text-slate-400 mt-3">Obrigado. Você já pode fechar esta página.</p></div>
          )}
        </div>
        <div className="bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400 py-3 font-bold uppercase tracking-widest">Boardplan • INEPAD Governança e Sucessão</div>
      </div>
    </div>
  );
};
