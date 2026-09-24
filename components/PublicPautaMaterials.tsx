import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

// Página pública (sem login) para o responsável enviar os materiais das suas pautas.
// Acessada via ?pautamat=<token>. Usa URL de upload assinada (aguenta arquivos grandes).
export const PublicPautaMaterials: React.FC<{ token: string }> = ({ token }) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [info, setInfo] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null); // uid|index em upload

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('pauta-materials', { body: { token, action: 'info' } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setInfo(data); setStatus('ready');
    } catch (e: any) { setErrMsg(e?.message || 'Link inválido ou expirado.'); setStatus('error'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const keyOf = (p: any) => p.uid || `i${p.index}`;

  const upload = async (p: any, file: File) => {
    if (!file) return;
    setBusy(keyOf(p));
    try {
      const target = p.uid ? { pautaUid: p.uid } : { pautaIndex: p.index };
      const { data: su, error: e1 } = await supabase.functions.invoke('pauta-materials', { body: { token, action: 'signUpload', fileName: file.name, ...target } });
      if (e1 || su?.error) throw new Error(e1?.message || su?.error);
      const upRes = await supabase.storage.from('meeting-files').uploadToSignedUrl(su.path, su.token, file);
      if (upRes.error) throw new Error(upRes.error.message);
      const { data: cf, error: e2 } = await supabase.functions.invoke('pauta-materials', { body: { token, action: 'confirm', path: su.path, fileName: file.name, ...target } });
      if (e2 || cf?.error) throw new Error(e2?.message || cf?.error);
      // atualiza a lista localmente
      setInfo((prev: any) => ({ ...prev, pautas: prev.pautas.map((x: any) => keyOf(x) === keyOf(p) ? { ...x, materiais: cf.materiais } : x) }));
    } catch (e: any) { alert('Erro ao enviar: ' + (e?.message || e)); }
    finally { setBusy(null); }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 p-6 text-center border-b-4 border-amber-600">
          <p className="text-amber-500 text-[10px] font-bold uppercase tracking-[2px]">Materiais das Pautas • Conselho</p>
        </div>
        <div className="p-8">
          {status === 'loading' && <p className="text-center text-amber-600 font-bold uppercase animate-pulse py-8">Carregando...</p>}
          {status === 'error' && <div className="text-center py-4"><div className="text-5xl mb-3">⚠️</div><p className="font-bold text-slate-800">Não foi possível abrir</p><p className="text-sm text-slate-500 mt-2">{errMsg}</p></div>}
          {status === 'ready' && info && (
            <>
              <p className="text-sm text-slate-500">Olá, <b className="text-slate-800">{info.resp}</b>. Anexe os materiais de apoio das suas pautas em:</p>
              <p className="text-base font-bold italic text-slate-800 mt-1">{info.meetingTitle}</p>
              <p className="text-[11px] text-slate-400 mb-5">{info.date || ''}{info.time ? ` às ${info.time}` : ''}</p>
              {info.pautas.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-6 text-center">Você não tem pautas com materiais a enviar nesta reunião.</p>
              ) : (
                <div className="space-y-3">
                  {info.pautas.map((p: any, i: number) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {p.tema && <span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">{p.tema}</span>}
                        <p className="text-sm font-bold text-slate-800 italic">{p.title}</p>
                      </div>
                      {(p.materiais || []).length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {p.materiais.map((m: any, mi: number) => <li key={mi} className="text-[12px] text-slate-600 flex items-center gap-1.5">📎 {m.name}</li>)}
                        </ul>
                      )}
                      <label className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all ${busy === keyOf(p) ? 'bg-slate-100 text-slate-400' : 'bg-amber-600 text-white hover:bg-amber-700'}`}>
                        {busy === keyOf(p) ? 'Enviando...' : '+ Anexar material'}
                        <input type="file" className="hidden" disabled={busy === keyOf(p)} onChange={e => { const f = e.target.files?.[0]; if (f) upload(p, f); (e.target as HTMLInputElement).value = ''; }} />
                      </label>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-400 text-center mt-6">Os materiais ficam disponíveis à secretaria na plataforma. Você pode voltar a este link para enviar mais.</p>
            </>
          )}
        </div>
        <div className="bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400 py-3 font-bold uppercase tracking-widest">Boardplan • INEPAD Governança e Sucessão</div>
      </div>
    </div>
  );
};
