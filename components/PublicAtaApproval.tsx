import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

// Página pública de aprovação de ata por e-mail (sem login) — acessada via ?atatoken=
export const PublicAtaApproval: React.FC<{ token: string }> = ({ token }) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'error'>('loading');
  const [info, setInfo] = useState<any>(null);
  const [errMsg, setErrMsg] = useState('');
  const [casting, setCasting] = useState(false);
  const [chosen, setChosen] = useState('');
  const [note, setNote] = useState('');

  const LABELS: Record<string, string> = { aprovada: 'Aprovada', ressalva: 'Aprovada com ressalvas', reprovada: 'Reprovada' };

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('ata-approve-by-token', { body: { token, action: 'info' } });
        if (error || data?.error) throw new Error(error?.message || data?.error);
        setInfo(data); setNote(data?.currentNote || ''); setStatus('ready');
      } catch (e: any) { setErrMsg(e?.message || 'Link inválido ou expirado.'); setStatus('error'); }
    })();
  }, [token]);

  const cast = async (choice: string) => {
    if ((choice === 'ressalva' || choice === 'reprovada') && !note.trim()) {
      alert('Descreva o motivo para ressalva ou reprovação.');
      return;
    }
    setCasting(true);
    try {
      const { data, error } = await supabase.functions.invoke('ata-approve-by-token', { body: { token, action: 'cast', choice, note } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setChosen(choice); setStatus('done');
    } catch (e: any) { setErrMsg(e?.message || 'Erro ao registrar a aprovação.'); setStatus('error'); }
    finally { setCasting(false); }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 p-6 text-center border-b-4 border-amber-600">
          <p className="text-amber-500 text-[10px] font-bold uppercase tracking-[2px]">Aprovação de Ata • Conselho</p>
        </div>
        <div className="p-8">
          {status === 'loading' && <p className="text-center text-amber-600 font-bold uppercase animate-pulse py-8">Carregando...</p>}
          {status === 'error' && <div className="text-center py-4"><div className="text-5xl mb-3">⚠️</div><p className="font-bold text-slate-800">Não foi possível abrir a aprovação</p><p className="text-sm text-slate-500 mt-2">{errMsg}</p></div>}
          {status === 'ready' && info && (
            <>
              <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-amber-600 rounded-lg p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{info.meetingTitle}</p>
                <p className="font-bold text-slate-800 italic mt-0.5">{info.ataName}</p>
                {info.ataUrl && <a href={info.ataUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs font-bold text-amber-700 hover:text-amber-800">⬇ Ver / baixar a ata</a>}
              </div>
              <p className="text-xs text-slate-500 my-4">Registrando a manifestação de <b className="text-slate-800">{info.approver}</b>{info.currentStatus ? <span> — atual: <b>{LABELS[info.currentStatus] || info.currentStatus}</b> (pode alterar)</span> : null}</p>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Comentário (obrigatório para ressalvas ou reprovação)" rows={3} className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-400 mb-4 resize-none" />
              <div className="flex flex-col gap-3">
                <button disabled={casting} onClick={() => cast('aprovada')} className="py-4 rounded-lg font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 transition-all disabled:opacity-50">👍 Aprovar</button>
                <button disabled={casting} onClick={() => cast('ressalva')} className="py-4 rounded-lg font-bold uppercase tracking-wider text-white bg-amber-600 hover:bg-amber-700 transition-all disabled:opacity-50">✎ Aprovar com ressalvas</button>
                <button disabled={casting} onClick={() => cast('reprovada')} className="py-4 rounded-lg font-bold uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50">👎 Reprovar</button>
              </div>
            </>
          )}
          {status === 'done' && (
            <div className="text-center py-4"><div className="text-5xl mb-3">✅</div><p className="font-bold text-slate-800 text-lg">Manifestação registrada!</p><p className="text-sm text-slate-500 mt-2">Você registrou: <b>"{LABELS[chosen] || chosen}"</b>.</p><p className="text-xs text-slate-400 mt-3">Você já pode fechar esta página.</p></div>
          )}
        </div>
        <div className="bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400 py-3 font-bold uppercase tracking-widest">Boardplan • INEPAD Governança e Sucessão</div>
      </div>
    </div>
  );
};
