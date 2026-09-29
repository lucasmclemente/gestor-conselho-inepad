import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../services/supabaseClient';
import {
  MessageSquare, Plus, QrCode, ExternalLink, Copy, CheckCircle2, Lock, Unlock,
  Trash2, Archive, RotateCcw, ChevronLeft, RefreshCw, Paperclip, FileText, X,
  BarChart3, Edit2
} from 'lucide-react';

// Módulo de moderação "Perguntas ao Vivo" (staff). O público envia pelo link/QR
// (página PublicQA via Edge Function qa-public); aqui a secretária modera em tempo real.
export const LiveQA: React.FC<{ currentUser: any; activeClientId: string | null; addLog: (a: string, d: string) => void }> = ({ currentUser, activeClientId, addLog }) => {
  const clientId = activeClientId || currentUser?.client_id;
  const [sessions, setSessions] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState(false);
  const [surveyDraft, setSurveyDraft] = useState<any[]>([]);
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [responses, setResponses] = useState<any[]>([]);

  const materials: any[] = Array.isArray(selected?.materials) ? selected.materials : [];
  const mode = selected?.mode || 'questions';
  const survey: any[] = Array.isArray(selected?.survey) ? selected.survey : [];

  const publicUrl = selected ? `${window.location.origin}/?perguntas=${selected.code}` : '';

  const loadSessions = useCallback(async () => {
    const { data } = await supabase.from('qa_sessions').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    setSessions(data || []); setLoading(false);
  }, [clientId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Polling das perguntas da sessão selecionada
  const loadQuestions = useCallback(async () => {
    if (!selected) return;
    const { data } = await supabase.from('qa_questions').select('*').eq('session_id', selected.id)
      .order('votes', { ascending: false }).order('created_at', { ascending: true });
    setQuestions(data || []);
  }, [selected]);

  useEffect(() => {
    if (!selected) { setQuestions([]); return; }
    loadQuestions();
    const t = setInterval(loadQuestions, 5000);
    return () => clearInterval(t);
  }, [selected, loadQuestions]);

  // Gera o QR quando abre uma sessão
  useEffect(() => {
    if (!selected) { setQr(''); return; }
    QRCode.toDataURL(publicUrl, { margin: 1, width: 320 }).then(setQr).catch(() => setQr(''));
  }, [selected, publicUrl]);

  const genCode = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I/L
    let c = ''; for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  };

  const createSession = async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    let lastErr: any = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = genCode();
      const { data, error } = await supabase.from('qa_sessions').insert({
        client_id: clientId, title: newTitle.trim(), code,
        created_by: currentUser?.name || currentUser?.email || null
      }).select().single();
      if (!error && data) {
        setSessions(prev => [data, ...prev]);
        setNewTitle(''); setSelected(data);
        addLog('Cadastro', `Sessão de perguntas criada: ${data.title}`);
        setCreating(false); return;
      }
      lastErr = error;
      if (error && !/duplicate|unique/i.test(error.message || '')) break; // erro que não é colisão de code
    }
    alert('Não foi possível criar a sessão: ' + (lastErr?.message || 'erro desconhecido'));
    setCreating(false);
  };

  const toggleOpen = async () => {
    if (!selected) return;
    const { data, error } = await supabase.from('qa_sessions').update({ open: !selected.open }).eq('id', selected.id).select().single();
    if (!error && data) {
      setSelected(data);
      setSessions(prev => prev.map(s => s.id === data.id ? data : s));
      addLog('Configuração', `Sessão "${data.title}" ${data.open ? 'reaberta' : 'encerrada'}`);
    }
  };

  const deleteSession = async () => {
    if (!selected) return;
    if (!window.confirm(`Excluir a sessão "${selected.title}" e todas as suas perguntas? Ação irreversível.`)) return;
    const { error } = await supabase.from('qa_sessions').delete().eq('id', selected.id);
    if (!error) {
      setSessions(prev => prev.filter(s => s.id !== selected.id));
      addLog('Exclusão', `Sessão de perguntas excluída: ${selected.title}`);
      setSelected(null);
    } else alert('Erro ao excluir: ' + error.message);
  };

  const setStatus = async (q: any, status: string) => {
    const { error } = await supabase.from('qa_questions').update({ status }).eq('id', q.id);
    if (!error) setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, status } : x));
  };

  const deleteQuestion = async (q: any) => {
    if (!window.confirm('Excluir esta pergunta?')) return;
    const { error } = await supabase.from('qa_questions').delete().eq('id', q.id);
    if (!error) setQuestions(prev => prev.filter(x => x.id !== q.id));
  };

  const copyLink = () => { navigator.clipboard?.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // ── Materiais anexos (o público baixa pela página; a Edge Function assina na hora) ──
  const saveMaterials = async (mats: any[]) => {
    const { data, error } = await supabase.from('qa_sessions').update({ materials: mats }).eq('id', selected.id).select().single();
    if (!error && data) { setSelected(data); setSessions(prev => prev.map(s => s.id === data.id ? data : s)); }
    return !error;
  };

  const uploadMaterial = async (file: File) => {
    if (!file || !selected) return;
    setUploading(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `qa/${clientId}/${selected.id}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from('meeting-files').upload(path, file, { upsert: true });
    if (upErr) { alert('Erro ao enviar o arquivo: ' + upErr.message); setUploading(false); return; }
    const next = [...materials, { name: file.name, path, uploadedAt: new Date().toISOString() }];
    const ok = await saveMaterials(next);
    if (ok) addLog('Upload', `Material anexado à sessão de perguntas "${selected.title}": ${file.name}`);
    else alert('Arquivo enviado, mas não foi possível salvar na sessão.');
    setUploading(false);
  };

  const removeMaterial = async (m: any) => {
    if (!window.confirm(`Remover "${m.name}"?`)) return;
    if (m.path) await supabase.storage.from('meeting-files').remove([m.path]).catch(() => {});
    await saveMaterials(materials.filter(x => x !== m));
  };

  const openMaterial = async (m: any) => {
    if (!m?.path) return;
    const { data, error } = await supabase.storage.from('meeting-files').createSignedUrl(m.path, 300);
    if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank');
    else alert('Não foi possível abrir o arquivo.');
  };

  // ── Pesquisa de satisfação: modo, questionário e resultados ──
  const setMode = async (m: string) => {
    if (!selected) return;
    if (m === 'survey' && survey.length === 0) { alert('Monte o questionário antes de ativar o modo pesquisa.'); setEditingSurvey(true); setSurveyDraft([]); return; }
    const { data, error } = await supabase.from('qa_sessions').update({ mode: m }).eq('id', selected.id).select().single();
    if (!error && data) {
      setSelected(data); setSessions(prev => prev.map(s => s.id === data.id ? data : s));
      addLog('Configuração', `Sessão "${data.title}" alternada para modo ${m === 'survey' ? 'Pesquisa' : 'Perguntas'}`);
    }
  };

  const openSurveyEditor = () => { setSurveyDraft(JSON.parse(JSON.stringify(survey))); setEditingSurvey(true); };
  const addSurveyQuestion = (type: string) => setSurveyDraft(prev => [...prev, { id: (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)), type, label: '', options: type === 'choice' ? ['', ''] : undefined, multi: false }]);
  const updateSurveyQuestion = (i: number, patch: any) => setSurveyDraft(prev => prev.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  const removeSurveyQuestion = (i: number) => setSurveyDraft(prev => prev.filter((_, idx) => idx !== i));
  const addOption = (i: number) => setSurveyDraft(prev => prev.map((q, idx) => idx === i ? { ...q, options: [...(q.options || []), ''] } : q));
  const updateOption = (i: number, oi: number, val: string) => setSurveyDraft(prev => prev.map((q, idx) => idx === i ? { ...q, options: (q.options || []).map((o: string, k: number) => k === oi ? val : o) } : q));
  const removeOption = (i: number, oi: number) => setSurveyDraft(prev => prev.map((q, idx) => idx === i ? { ...q, options: (q.options || []).filter((_: string, k: number) => k !== oi) } : q));

  const saveSurvey = async () => {
    // validação
    for (const q of surveyDraft) {
      if (!q.label.trim()) { alert('Toda pergunta precisa de um enunciado.'); return; }
      if (q.type === 'choice') {
        const opts = (q.options || []).map((o: string) => o.trim()).filter(Boolean);
        if (opts.length < 2) { alert(`A pergunta "${q.label}" precisa de ao menos 2 opções.`); return; }
      }
    }
    // limpa opções vazias
    const clean = surveyDraft.map(q => q.type === 'choice' ? { ...q, options: (q.options || []).map((o: string) => o.trim()).filter(Boolean) } : { id: q.id, type: q.type, label: q.label.trim() });
    setSavingSurvey(true);
    const { data, error } = await supabase.from('qa_sessions').update({ survey: clean }).eq('id', selected.id).select().single();
    setSavingSurvey(false);
    if (!error && data) {
      setSelected(data); setSessions(prev => prev.map(s => s.id === data.id ? data : s));
      setEditingSurvey(false);
      addLog('Configuração', `Questionário da pesquisa "${data.title}" salvo`);
    } else alert('Erro ao salvar o questionário.');
  };

  const loadResponses = useCallback(async () => {
    if (!selected) return;
    const { data } = await supabase.from('qa_survey_responses').select('answers, created_at').eq('session_id', selected.id).order('created_at', { ascending: false });
    setResponses(data || []);
  }, [selected]);

  useEffect(() => { if (selected && mode === 'survey' && !editingSurvey) loadResponses(); }, [selected, mode, editingSurvey, loadResponses]);

  // ── Lista de sessões ──
  if (!selected) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-2"><MessageSquare className="text-amber-600" /> Perguntas ao Vivo</h1>
            <p className="text-sm text-slate-500 mt-1">Crie uma sessão, projete o QR code e receba as perguntas do público em tempo real — sem exigir login.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Nova sessão</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={120}
              onKeyDown={e => { if (e.key === 'Enter') createSession(); }}
              placeholder="Ex: Assembleia Geral 2026 — Perguntas" className="flex-1 p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" />
            <button onClick={createSession} disabled={creating || !newTitle.trim()} className="px-5 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 disabled:opacity-50">
              <Plus size={16} /> {creating ? 'Criando…' : 'Criar sessão'}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-slate-400 py-10 animate-pulse font-bold uppercase text-xs">Carregando…</p>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
            <MessageSquare className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="text-slate-500 font-bold">Nenhuma sessão ainda</p>
            <p className="text-sm text-slate-400 mt-1">Crie a primeira sessão acima para gerar o QR code do evento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map(s => (
              <button key={s.id} onClick={() => setSelected(s)} className="text-left bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-amber-300 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${s.open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{s.open ? '● Aberta' : 'Encerrada'}</span>
                  <QrCode size={16} className="text-amber-500" />
                </div>
                <p className="font-bold text-slate-800 italic leading-tight">{s.title}</p>
                <p className="text-[10px] text-slate-400 mt-2 font-mono uppercase tracking-widest">código: {s.code}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Detalhe da sessão (QR + moderação) ──
  const visible = questions.filter(q => showArchived ? q.status === 'archived' : q.status !== 'archived');
  const answeredCount = questions.filter(q => q.status === 'answered').length;

  return (
    <div className="space-y-6 animate-in fade-in">
      <button onClick={() => setSelected(null)} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-amber-600 flex items-center gap-1"><ChevronLeft size={14} /> Todas as sessões</button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel do QR / link */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-fit">
          <h2 className="font-bold text-slate-800 italic leading-tight">{selected.title}</h2>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${mode === 'survey' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>{mode === 'survey' ? '📊 Modo pesquisa' : '💬 Modo perguntas'}</span>
            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${selected.open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{selected.open ? '● Aberta' : 'Encerrada'}</span>
          </div>

          {qr && <img src={qr} alt="QR code" className="w-full max-w-[260px] mx-auto mt-4 rounded-lg border border-slate-100" />}

          <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2">
            <span className="flex-1 text-[11px] text-slate-600 break-all font-mono">{publicUrl}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={copyLink} className="py-2 rounded-lg bg-slate-900 text-amber-500 font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5">{copied ? <><CheckCircle2 size={13} /> Copiado</> : <><Copy size={13} /> Copiar link</>}</button>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="py-2 rounded-lg bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5"><ExternalLink size={13} /> Abrir</a>
          </div>

          {/* Modo da sessão: Perguntas ↔ Pesquisa (muda o que o público vê no mesmo link) */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><BarChart3 size={12} /> O que o público vê</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setMode('questions')} className={`py-2 rounded-lg font-bold uppercase tracking-wider text-[10px] border transition-all ${mode === 'questions' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'}`}>Perguntas</button>
              <button onClick={() => setMode('survey')} className={`py-2 rounded-lg font-bold uppercase tracking-wider text-[10px] border transition-all ${mode === 'survey' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-500 border-slate-200 hover:border-sky-300'}`}>Pesquisa</button>
            </div>
            <button onClick={openSurveyEditor} className="w-full mt-1.5 py-2 rounded-lg font-bold uppercase tracking-wider text-[10px] bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center gap-1.5"><Edit2 size={13} /> {survey.length ? `Editar questionário (${survey.length})` : 'Montar questionário'}</button>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            <button onClick={toggleOpen} className={`w-full py-2.5 rounded-lg font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-2 ${selected.open ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-600 text-white'}`}>
              {selected.open ? <><Lock size={14} /> {mode === 'survey' ? 'Encerrar pesquisa' : 'Encerrar perguntas'}</> : <><Unlock size={14} /> {mode === 'survey' ? 'Reabrir pesquisa' : 'Reabrir perguntas'}</>}
            </button>
            <button onClick={deleteSession} className="w-full py-2.5 rounded-lg font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 border border-red-100"><Trash2 size={14} /> Excluir sessão</button>
          </div>

          {/* Materiais para download do público */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Paperclip size={12} /> Materiais para o público</p>
            {materials.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {materials.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <FileText size={14} className="text-amber-500 shrink-0" />
                    <button onClick={() => openMaterial(m)} className="flex-1 text-left text-[11px] text-slate-700 truncate hover:text-amber-700">{m.name}</button>
                    <button onClick={() => removeMaterial(m)} className="text-slate-300 hover:text-red-500 shrink-0" title="Remover"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <label className={`w-full py-2.5 rounded-lg font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-2 cursor-pointer border ${uploading ? 'opacity-50 pointer-events-none' : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-amber-300'}`}>
              <Plus size={14} /> {uploading ? 'Enviando…' : 'Anexar material'}
              <input type="file" className="hidden" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadMaterial(f); (e.target as HTMLInputElement).value = ''; }} />
            </label>
            <p className="text-[9px] text-slate-400 mt-1.5 text-center">Aparecem na página pública para os participantes baixarem.</p>
          </div>
        </div>

        {/* Painel direito: construtor de pesquisa | resultados | perguntas */}
        <div className="lg:col-span-2 space-y-3">
          {editingSurvey ? (
            /* ===== CONSTRUTOR DO QUESTIONÁRIO ===== */
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 italic">Questionário da pesquisa</h3>
                <button onClick={() => setEditingSurvey(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
              </div>
              {surveyDraft.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Adicione perguntas abaixo.</p>}
              {surveyDraft.map((q, i) => (
                <div key={q.id} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-slate-400 mt-2.5">{i + 1}.</span>
                    <input value={q.label} onChange={e => updateSurveyQuestion(i, { label: e.target.value })} maxLength={200}
                      placeholder="Enunciado da pergunta" className="flex-1 p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-400" />
                    <button onClick={() => removeSurveyQuestion(i)} className="text-slate-300 hover:text-red-500 mt-2"><Trash2 size={16} /></button>
                  </div>
                  <div className="flex items-center gap-2 pl-5">
                    <select value={q.type} onChange={e => updateSurveyQuestion(i, { type: e.target.value, options: e.target.value === 'choice' ? (q.options || ['', '']) : undefined })}
                      className="text-xs border border-slate-200 rounded-lg p-1.5 outline-none bg-white">
                      <option value="text">Resposta aberta</option>
                      <option value="choice">Múltipla escolha</option>
                    </select>
                    {q.type === 'choice' && (
                      <label className="text-[11px] text-slate-500 flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!q.multi} onChange={e => updateSurveyQuestion(i, { multi: e.target.checked })} /> permitir várias respostas
                      </label>
                    )}
                  </div>
                  {q.type === 'choice' && (
                    <div className="pl-5 space-y-1.5">
                      {(q.options || []).map((opt: string, oi: number) => (
                        <div key={oi} className="flex items-center gap-2">
                          <span className={`w-3.5 h-3.5 border border-slate-300 ${q.multi ? 'rounded' : 'rounded-full'}`} />
                          <input value={opt} onChange={e => updateOption(i, oi, e.target.value)} maxLength={120}
                            placeholder={`Opção ${oi + 1}`} className="flex-1 p-1.5 border border-slate-200 rounded text-sm outline-none focus:border-amber-400" />
                          <button onClick={() => removeOption(i, oi)} className="text-slate-300 hover:text-red-500"><X size={14} /></button>
                        </div>
                      ))}
                      <button onClick={() => addOption(i)} className="text-[11px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 pl-5"><Plus size={12} /> opção</button>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={() => addSurveyQuestion('text')} className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center gap-1.5"><Plus size={14} /> Pergunta aberta</button>
                <button onClick={() => addSurveyQuestion('choice')} className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center gap-1.5"><Plus size={14} /> Múltipla escolha</button>
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => setEditingSurvey(false)} className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-white border border-slate-200 text-slate-600">Cancelar</button>
                <button onClick={saveSurvey} disabled={savingSurvey} className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">{savingSurvey ? 'Salvando…' : 'Salvar questionário'}</button>
              </div>
            </div>
          ) : mode === 'survey' ? (
            /* ===== RESULTADOS DA PESQUISA ===== */
            <>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Resultados · {responses.length} {responses.length === 1 ? 'resposta' : 'respostas'}</p>
                <button onClick={loadResponses} className="text-slate-400 hover:text-amber-600" title="Atualizar"><RefreshCw size={14} /></button>
              </div>
              {survey.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
                  <BarChart3 className="mx-auto text-slate-300 mb-3" size={36} />
                  <p className="text-slate-500 font-bold">Sem questionário</p>
                  <p className="text-sm text-slate-400 mt-1">Clique em "Montar questionário" no painel ao lado.</p>
                </div>
              ) : survey.map((q, qi) => {
                const answersForQ = responses.map(r => r.answers?.[q.id]).filter(a => a != null && (Array.isArray(a) ? a.length : String(a).trim() !== ''));
                return (
                  <div key={q.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <p className="text-sm font-bold text-slate-800 mb-3">{qi + 1}. {q.label} <span className="text-[10px] font-normal text-slate-400">({answersForQ.length})</span></p>
                    {q.type === 'choice' ? (
                      <div className="space-y-2">
                        {(q.options || []).map((opt: string, oi: number) => {
                          const count = responses.filter(r => { const a = r.answers?.[q.id]; return Array.isArray(a) ? a.includes(opt) : a === opt; }).length;
                          const pct = answersForQ.length ? Math.round((count / answersForQ.length) * 100) : 0;
                          return (
                            <div key={oi}>
                              <div className="flex items-center justify-between text-xs mb-0.5">
                                <span className="text-slate-700">{opt}</span>
                                <span className="font-bold text-slate-500">{count} · {pct}%</span>
                              </div>
                              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      answersForQ.length === 0
                        ? <p className="text-xs text-slate-400">Sem respostas ainda.</p>
                        : <div className="space-y-1.5 max-h-64 overflow-y-auto">{answersForQ.map((a, ai) => <p key={ai} className="text-sm text-slate-700 bg-slate-50 rounded-lg p-2.5 border border-slate-100">"{String(a)}"</p>)}</div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            /* ===== MODERAÇÃO DE PERGUNTAS ===== */
            <>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {showArchived ? `Arquivadas` : `Perguntas (${questions.filter(q => q.status !== 'archived').length})`}{answeredCount > 0 && !showArchived ? ` · ${answeredCount} respondidas` : ''}
                </p>
                <div className="flex items-center gap-3">
                  <button onClick={loadQuestions} className="text-slate-400 hover:text-amber-600" title="Atualizar"><RefreshCw size={14} /></button>
                  <button onClick={() => setShowArchived(v => !v)} className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-amber-600">{showArchived ? 'Ver ativas' : 'Ver arquivadas'}</button>
                </div>
              </div>

              {visible.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
                  <MessageSquare className="mx-auto text-slate-300 mb-3" size={36} />
                  <p className="text-slate-500 font-bold">{showArchived ? 'Nada arquivado' : 'Aguardando perguntas…'}</p>
                  {!showArchived && <p className="text-sm text-slate-400 mt-1">Projete o QR code. As perguntas aparecem aqui automaticamente.</p>}
                </div>
              ) : visible.map(q => {
                const answered = q.status === 'answered';
                return (
                  <div key={q.id} className={`bg-white rounded-xl border shadow-sm p-4 flex items-start gap-3 ${answered ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
                    <div className="flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 bg-slate-50 border border-slate-200 shrink-0">
                      <span className="text-xs text-amber-600 leading-none">▲</span>
                      <span className="text-sm font-bold text-slate-700 mt-0.5">{q.votes || 0}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${answered ? 'text-slate-500' : 'text-slate-800'}`}>{q.body}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{q.author_name || 'Anônimo'} · {new Date(q.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {q.status !== 'archived' && (
                        <button onClick={() => setStatus(q, answered ? 'new' : 'answered')} title={answered ? 'Marcar como não respondida' : 'Marcar como respondida'}
                          className={`p-1.5 rounded-md ${answered ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:text-emerald-600'}`}><CheckCircle2 size={15} /></button>
                      )}
                      {q.status === 'archived'
                        ? <button onClick={() => setStatus(q, 'new')} title="Restaurar" className="p-1.5 rounded-md bg-slate-100 text-slate-500 hover:text-amber-600"><RotateCcw size={15} /></button>
                        : <button onClick={() => setStatus(q, 'archived')} title="Arquivar" className="p-1.5 rounded-md bg-slate-100 text-slate-500 hover:text-slate-800"><Archive size={15} /></button>}
                      <button onClick={() => deleteQuestion(q)} title="Excluir" className="p-1.5 rounded-md bg-slate-100 text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
