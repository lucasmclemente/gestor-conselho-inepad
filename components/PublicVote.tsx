import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

// Página pública de voto por e-mail (sem login) — acessada via ?votetoken=
export const PublicVote: React.FC<{ token: string }> = ({ token }) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'error'>('loading');
  const [info, setInfo] = useState<any>(null);
  const [errMsg, setErrMsg] = useState('');
  const [casting, setCasting] = useState(false);
  const [chosen, setChosen] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('vote-by-token', { body: { token, action: 'info' } });
        if (error || data?.error) throw new Error(error?.message || data?.error);
        setInfo(data); setStatus('ready');
      } catch (e: any) { setErrMsg(e?.message || 'Link inválido ou expirado.'); setStatus('error'); }
    })();
  }, [token]);

  const cast = async (choice: string) => {
    setCasting(true);
    try {
      const { data, error } = await supabase.functions.invoke('vote-by-token', { body: { token, action: 'cast', choice } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setChosen(choice); setStatus('done');
    } catch (e: any) { setErrMsg(e?.message || 'Erro ao registrar o voto.'); setStatus('error'); }
    finally { setCasting(false); }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 p-6 text-center border-b-4 border-amber-600">
          <p className="text-amber-500 text-[10px] font-bold uppercase tracking-[2px]">Votação de Deliberação • Conselho</p>
        </div>
        <div className="p-8">
          {status === 'loading' && <p className="text-center text-amber-600 font-bold uppercase animate-pulse py-8">Carregando...</p>}
          {status === 'error' && <div className="text-center py-4"><div className="text-5xl mb-3">⚠️</div><p className="font-bold text-slate-800">Não foi possível abrir a votação</p><p className="text-sm text-slate-500 mt-2">{errMsg}</p></div>}
          {status === 'ready' && info && (
            <>
              <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-amber-600 rounded-lg p-4 italic font-bold text-slate-800">"{info.title}"</div>
              <p className="text-xs text-slate-500 my-4">Registrando o voto de <b className="text-slate-800">{info.voter}</b>{info.currentVote ? <span> — voto atual: <b>{info.currentVote}</b> (pode alterar abaixo)</span> : null}</p>
              <div className="flex flex-col gap-3">
                <button disabled={casting} onClick={() => cast('Favor')} className="py-4 rounded-lg font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 transition-all disabled:opacity-50">👍 A Favor</button>
                <button disabled={casting} onClick={() => cast('Contra')} className="py-4 rounded-lg font-bold uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50">👎 Contra</button>
                <button disabled={casting} onClick={() => cast('Abstenção')} className="py-4 rounded-lg font-bold uppercase tracking-wider text-white bg-slate-500 hover:bg-slate-600 transition-all disabled:opacity-50">⊘ Abster-se</button>
              </div>
            </>
          )}
          {status === 'done' && (
            <div className="text-center py-4"><div className="text-5xl mb-3">✅</div><p className="font-bold text-slate-800 text-lg">Voto registrado!</p><p className="text-sm text-slate-500 mt-2">Seu voto <b>"{chosen}"</b> foi registrado com sucesso.</p><p className="text-xs text-slate-400 mt-3">Você já pode fechar esta página.</p></div>
          )}
        </div>
        <div className="bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400 py-3 font-bold uppercase tracking-widest">Boardplan • INEPAD Governança e Sucessão</div>
      </div>
    </div>
  );
};
