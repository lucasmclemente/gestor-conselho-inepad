import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

// id anônimo do dispositivo (para não votar 2x na mesma pergunta)
const deviceId = (() => {
  try {
    let d = localStorage.getItem('qa_device');
    if (!d) { d = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('qa_device', d); }
    return d;
  } catch { return Math.random().toString(36).slice(2); }
})();

// Página pública de perguntas ao vivo (sem login) — acessada via ?perguntas=CODE
export const PublicQA: React.FC<{ code: string }> = ({ code }) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [info, setInfo] = useState<any>(null);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [myVotes, setMyVotes] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('qa_myvotes_' + code) || '[]')); } catch { return new Set(); }
  });

  const load = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('qa-public', { body: { action: 'info', code } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setInfo(data); setStatus('ready');
    } catch (e: any) { setErrMsg(e?.message || 'Sessão indisponível.'); setStatus('error'); }
  };

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [code]);

  const submit = async () => {
    if (text.trim().length < 2 || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('qa-public', { body: { action: 'submit', code, body: text.trim(), name: name.trim() } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setText(''); setSent(true); setTimeout(() => setSent(false), 3000); load();
    } catch (e: any) { alert(e?.message || 'Erro ao enviar.'); }
    finally { setSending(false); }
  };

  const vote = async (qid: string) => {
    const next = new Set(myVotes);
    if (next.has(qid)) next.delete(qid); else next.add(qid);
    setMyVotes(next);
    try { localStorage.setItem('qa_myvotes_' + code, JSON.stringify([...next])); } catch { /* */ }
    try { await supabase.functions.invoke('qa-public', { body: { action: 'vote', code, questionId: qid, deviceId } }); load(); } catch { /* */ }
  };

  const questions: any[] = info?.questions || [];
  const isSurvey = info?.mode === 'survey';
  const survey: any[] = info?.survey || [];

  // ── Estado das respostas da pesquisa ──
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [surveySent, setSurveySent] = useState<boolean>(() => {
    try { return localStorage.getItem('qa_survey_done_' + code) === '1'; } catch { return false; }
  });
  const setAns = (qid: string, val: any) => setAnswers(prev => ({ ...prev, [qid]: val }));
  const toggleChoice = (qid: string, opt: string) => {
    setAnswers(prev => {
      const cur: string[] = Array.isArray(prev[qid]) ? prev[qid] : [];
      return { ...prev, [qid]: cur.includes(opt) ? cur.filter(o => o !== opt) : [...cur, opt] };
    });
  };

  const submitSurvey = async () => {
    if (sending) return;
    // exige ao menos uma resposta preenchida
    const anyFilled = survey.some(q => {
      const a = answers[q.id];
      return Array.isArray(a) ? a.length > 0 : (a != null && String(a).trim() !== '');
    });
    if (!anyFilled) { alert('Responda ao menos uma pergunta.'); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('qa-public', { body: { action: 'surveySubmit', code, deviceId, answers } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      try { localStorage.setItem('qa_survey_done_' + code, '1'); } catch { /* */ }
      setSurveySent(true);
    } catch (e: any) { alert(e?.message || 'Erro ao enviar a pesquisa.'); }
    finally { setSending(false); }
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center mb-5">
          <p className="text-amber-500 text-[10px] font-bold uppercase tracking-[2px]">{isSurvey ? 'Pesquisa de satisfação' : 'Perguntas ao vivo'}</p>
          <h1 className="text-white text-xl font-bold italic mt-1">{info?.title || (isSurvey ? 'Sua opinião' : 'Envie sua pergunta')}</h1>
        </div>

        {status === 'loading' && <p className="text-center text-amber-500 font-bold uppercase animate-pulse py-10">Carregando…</p>}
        {status === 'error' && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-xl">
            <div className="text-5xl mb-3">⚠️</div>
            <p className="font-bold text-slate-800">Não foi possível abrir</p>
            <p className="text-sm text-slate-500 mt-2">{errMsg}</p>
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* Materiais para download */}
            {(info?.materials || []).length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-4 mb-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">📎 Materiais do evento</p>
                <div className="space-y-1.5">
                  {info.materials.map((m: any, i: number) => (
                    <a key={i} href={m.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 hover:border-amber-300 transition-colors">
                      <span className="text-amber-500 shrink-0">📄</span>
                      <span className="flex-1 text-sm text-slate-700 truncate">{m.name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 shrink-0">Baixar</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* ===== MODO PESQUISA ===== */}
            {isSurvey ? (
              surveySent ? (
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-5 text-center">
                  <div className="text-5xl mb-3">✅</div>
                  <p className="font-bold text-slate-800">Obrigado pela sua resposta!</p>
                  <p className="text-sm text-slate-500 mt-1">Sua avaliação foi registrada.</p>
                </div>
              ) : !info?.open ? (
                <div className="bg-white rounded-2xl shadow-xl p-5 mb-5 text-center">
                  <p className="font-bold text-slate-700">🔒 A pesquisa foi encerrada.</p>
                </div>
              ) : survey.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-xl p-5 mb-5 text-center">
                  <p className="font-bold text-slate-700">A pesquisa ainda não tem perguntas.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-xl p-5 mb-5 space-y-5">
                  {survey.map((q: any, idx: number) => (
                    <div key={q.id}>
                      <p className="text-sm font-bold text-slate-800 mb-2">{idx + 1}. {q.label}</p>
                      {q.type === 'scale' ? (
                        <div>
                          <div className="flex gap-1.5">
                            {Array.from({ length: q.max || 5 }, (_, k) => k + 1).map(n => {
                              const sel = answers[q.id] === n;
                              return (
                                <button key={n} type="button" onClick={() => setAns(q.id, n)}
                                  className={`flex-1 py-3 rounded-lg border font-bold text-sm transition-all ${sel ? 'border-amber-500 bg-amber-600 text-white' : 'border-slate-200 text-slate-600 hover:border-amber-300'}`}>{n}</button>
                              );
                            })}
                          </div>
                          {(q.minLabel || q.maxLabel) && (
                            <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 px-0.5"><span>{q.minLabel}</span><span>{q.maxLabel}</span></div>
                          )}
                        </div>
                      ) : q.type === 'choice' ? (
                        <div className="space-y-2">
                          {(q.options || []).map((opt: string, oi: number) => {
                            const selected = q.multi ? (Array.isArray(answers[q.id]) && answers[q.id].includes(opt)) : answers[q.id] === opt;
                            return (
                              <button key={oi} type="button" onClick={() => q.multi ? toggleChoice(q.id, opt) : setAns(q.id, opt)}
                                className={`w-full text-left p-3 rounded-lg border text-sm flex items-center gap-2.5 transition-all ${selected ? 'border-amber-500 bg-amber-50 text-slate-800' : 'border-slate-200 text-slate-600 hover:border-amber-300'}`}>
                                <span className={`w-4 h-4 shrink-0 flex items-center justify-center ${q.multi ? 'rounded' : 'rounded-full'} border ${selected ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300'}`}>{selected ? '✓' : ''}</span>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <textarea value={answers[q.id] || ''} onChange={e => setAns(q.id, e.target.value)} rows={3} maxLength={2000}
                          placeholder="Sua resposta…"
                          className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-400 resize-none" />
                      )}
                    </div>
                  ))}
                  <button disabled={sending} onClick={submitSurvey}
                    className="w-full py-3.5 rounded-lg font-bold uppercase tracking-wider text-white bg-amber-600 hover:bg-amber-700 transition-all disabled:opacity-50">
                    {sending ? 'Enviando…' : 'Enviar respostas'}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center">Anônima. Sem login.</p>
                </div>
              )
            ) : (
            <>
            {/* Formulário de envio */}
            {info?.open ? (
              <div className="bg-white rounded-2xl shadow-xl p-5 mb-5">
                <textarea value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={1000}
                  placeholder="Escreva sua pergunta…"
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-400 resize-none" />
                <input value={name} onChange={e => setName(e.target.value)} maxLength={80}
                  placeholder="Seu nome (opcional)"
                  className="w-full mt-2 p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-400" />
                <button disabled={sending || text.trim().length < 2} onClick={submit}
                  className="w-full mt-3 py-3.5 rounded-lg font-bold uppercase tracking-wider text-white bg-amber-600 hover:bg-amber-700 transition-all disabled:opacity-50">
                  {sending ? 'Enviando…' : sent ? '✓ Enviada! Envie outra' : 'Enviar pergunta'}
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-2">Anônima para os demais participantes. Sem login.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xl p-5 mb-5 text-center">
                <p className="font-bold text-slate-700">🔒 As perguntas desta sessão foram encerradas.</p>
              </div>
            )}

            {/* Lista de perguntas (curtir = as mais votadas sobem) */}
            {questions.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Perguntas ({questions.length}) — curta as que quer ver respondidas</p>
                {questions.map((q: any) => {
                  const mine = myVotes.has(q.id);
                  const answered = q.status === 'answered';
                  return (
                    <div key={q.id} className={`bg-white rounded-xl shadow p-3.5 flex items-start gap-3 ${answered ? 'opacity-70' : ''}`}>
                      <button onClick={() => vote(q.id)}
                        className={`flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 shrink-0 border transition-all ${mine ? 'bg-amber-600 text-white border-amber-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-amber-400'}`}>
                        <span className="text-sm leading-none">▲</span>
                        <span className="text-xs font-bold mt-0.5">{q.votes || 0}</span>
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800">{q.body}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{q.author_name || 'Anônimo'}{answered ? ' · ✓ respondida' : ''}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </>
            )}
          </>
        )}
        <p className="text-center text-[10px] text-slate-500 mt-6 uppercase tracking-widest font-bold">Boardplan • INEPAD Governança</p>
      </div>
    </div>
  );
};
