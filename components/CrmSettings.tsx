import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChevronLeft, Plus, X, Save, Trash2, ChevronUp, ChevronDown, Edit2, Check, Star, Tag } from 'lucide-react';

const PALETTE = ['#64748b', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

type Props = {
  cid: string;
  addLog?: (action: string, details: string) => Promise<void> | void;
  onBack: () => void;
};

export const CrmSettings: React.FC<Props> = ({ cid, addLog, onBack }) => {
  const log = async (a: string, d: string) => { try { await addLog?.(a, d); } catch { /* noop */ } };

  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [pid, setPid] = useState<string | null>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [newStage, setNewStage] = useState('');
  const [newPipeline, setNewPipeline] = useState('');
  const [editStageId, setEditStageId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState('');
  const [editPipeName, setEditPipeName] = useState('');
  const [editingPipe, setEditingPipe] = useState(false);
  // Campos personalizados
  const [fields, setFields] = useState<any[]>([]);
  const [nfLabel, setNfLabel] = useState('');
  const [nfType, setNfType] = useState('text');
  const [nfOptions, setNfOptions] = useState('');
  const [editFieldId, setEditFieldId] = useState<string | null>(null);
  const [editFieldLabel, setEditFieldLabel] = useState('');
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [tags, setTags] = useState<any[]>([]);
  const [ntName, setNtName] = useState('');
  const [ntColor, setNtColor] = useState(PALETTE[1]);
  const [editTagId, setEditTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');

  const loadPipelines = useCallback(async () => {
    const { data } = await supabase.from('crm_pipelines').select('*').eq('client_id', cid).eq('active', true).order('position');
    const list = data || [];
    setPipelines(list);
    setPid(prev => (prev && list.some((p: any) => p.id === prev)) ? prev : (list.find((p: any) => p.is_default)?.id || list[0]?.id || null));
    setLoading(false);
  }, [cid]);

  const loadStages = useCallback(async () => {
    if (!pid) { setStages([]); return; }
    const { data } = await supabase.from('crm_stages').select('*').eq('pipeline_id', pid).eq('active', true).order('position');
    setStages(data || []);
  }, [pid]);

  const loadFields = useCallback(async () => {
    const { data } = await supabase.from('crm_field_defs').select('*').eq('client_id', cid).eq('active', true).order('position');
    setFields(data || []);
  }, [cid]);
  const loadTags = useCallback(async () => {
    const { data } = await supabase.from('crm_tags').select('*').eq('client_id', cid).order('position');
    setTags(data || []);
  }, [cid]);

  useEffect(() => { loadPipelines(); }, [loadPipelines]);
  useEffect(() => { loadStages(); }, [loadStages]);
  useEffect(() => { loadFields(); }, [loadFields]);
  useEffect(() => { loadTags(); }, [loadTags]);

  const addTag = async () => {
    if (!ntName.trim()) return;
    const pos = tags.length ? Math.max(...tags.map(t => t.position)) + 1 : 0;
    const { error } = await supabase.from('crm_tags').insert({ client_id: cid, name: ntName.trim(), color: ntColor, position: pos });
    if (error) { alert('Erro: ' + error.message); return; }
    setNtName(''); log('CRM', `Etiqueta "${ntName.trim()}" criada`); loadTags();
  };
  const renameTag = async (t: any) => {
    if (!editTagName.trim()) { setEditTagId(null); return; }
    await supabase.from('crm_tags').update({ name: editTagName.trim() }).eq('id', t.id);
    setEditTagId(null); loadTags();
  };
  const deleteTag = async (t: any) => {
    if (!window.confirm(`Excluir a etiqueta "${t.name}"?`)) return;
    await supabase.from('crm_tags').delete().eq('id', t.id);
    log('CRM', `Etiqueta "${t.name}" excluída`); loadTags();
  };

  const currentPipe = pipelines.find(p => p.id === pid);

  const TYPE_LABEL: Record<string, string> = { text: 'Texto', number: 'Número', select: 'Seleção', date: 'Data', checkbox: 'Sim/Não' };
  const addField = async () => {
    if (!nfLabel.trim()) return;
    const pos = fields.length ? Math.max(...fields.map(f => f.position)) + 1 : 0;
    const options = nfType === 'select' ? nfOptions.split(',').map(s => s.trim()).filter(Boolean) : [];
    const { error } = await supabase.from('crm_field_defs').insert({ client_id: cid, label: nfLabel.trim(), type: nfType, options, position: pos });
    if (error) { alert('Erro: ' + error.message); return; }
    setNfLabel(''); setNfOptions(''); setNfType('text'); log('CRM', `Campo "${nfLabel.trim()}" criado`); loadFields();
  };
  const toggleStageField = async (stage: any, fieldId: string) => {
    const cur = Array.isArray(stage.required_field_ids) ? stage.required_field_ids : [];
    const next = cur.includes(fieldId) ? cur.filter((id: string) => id !== fieldId) : [...cur, fieldId];
    const { error } = await supabase.from('crm_stages').update({ required_field_ids: next }).eq('id', stage.id);
    if (error) { alert('Erro: ' + error.message); return; }
    loadStages();
  };
  const renameField = async (f: any) => {
    if (!editFieldLabel.trim()) { setEditFieldId(null); return; }
    const { error } = await supabase.from('crm_field_defs').update({ label: editFieldLabel.trim() }).eq('id', f.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setEditFieldId(null); loadFields();
  };
  const deleteField = async (f: any) => {
    if (!window.confirm(`Excluir o campo "${f.label}"? Os valores já preenchidos nos negócios deixam de aparecer.`)) return;
    const { error } = await supabase.from('crm_field_defs').delete().eq('id', f.id);
    if (error) { alert('Erro: ' + error.message); return; }
    log('CRM', `Campo "${f.label}" excluído`); loadFields();
  };
  const moveField = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= fields.length) return;
    const arr = [...fields];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setFields(arr.map((f, i) => ({ ...f, position: i })));
    await Promise.all(arr.map((f, i) => supabase.from('crm_field_defs').update({ position: i }).eq('id', f.id)));
  };

  // ── Etapas ──────────────────────────────────────────────
  const addStage = async () => {
    if (!newStage.trim() || !pid) return;
    const pos = stages.length ? Math.max(...stages.map(s => s.position)) + 1 : 0;
    const { error } = await supabase.from('crm_stages').insert({ client_id: cid, pipeline_id: pid, name: newStage.trim(), position: pos });
    if (error) { alert('Erro: ' + error.message); return; }
    setNewStage(''); log('CRM', `Etapa "${newStage.trim()}" criada`); loadStages();
  };

  const renameStage = async (s: any) => {
    if (!editStageName.trim()) { setEditStageId(null); return; }
    const { error } = await supabase.from('crm_stages').update({ name: editStageName.trim() }).eq('id', s.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setEditStageId(null); loadStages();
  };

  const persistOrder = async (arr: any[]) => {
    await Promise.all(arr.map((s, i) => supabase.from('crm_stages').update({ position: i }).eq('id', s.id)));
  };
  const moveStage = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= stages.length) return;
    const arr = [...stages];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setStages(arr.map((s, i) => ({ ...s, position: i }))); // otimista
    await persistOrder(arr);
  };

  const deleteStage = async (s: any) => {
    if (!window.confirm(`Excluir a etapa "${s.name}"?`)) return;
    const { error } = await supabase.from('crm_stages').delete().eq('id', s.id);
    if (error) {
      // FK on delete restrict → há negócios nesta etapa
      alert('Não é possível excluir: mova os negócios desta etapa para outra antes de excluí-la.');
      return;
    }
    log('CRM', `Etapa "${s.name}" excluída`); loadStages();
  };

  // ── Funis ───────────────────────────────────────────────
  const addPipeline = async () => {
    if (!newPipeline.trim()) return;
    const pos = pipelines.length ? Math.max(...pipelines.map(p => p.position)) + 1 : 0;
    const { data, error } = await supabase.from('crm_pipelines').insert({ client_id: cid, name: newPipeline.trim(), position: pos, is_default: pipelines.length === 0 }).select().single();
    if (error) { alert('Erro: ' + error.message); return; }
    setNewPipeline(''); log('CRM', `Funil "${newPipeline.trim()}" criado`);
    await loadPipelines(); setPid(data.id);
  };

  const renamePipeline = async () => {
    if (!editPipeName.trim() || !currentPipe) { setEditingPipe(false); return; }
    const { error } = await supabase.from('crm_pipelines').update({ name: editPipeName.trim() }).eq('id', currentPipe.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setEditingPipe(false); loadPipelines();
  };

  const setDefaultPipeline = async () => {
    if (!currentPipe || currentPipe.is_default) return;
    await supabase.from('crm_pipelines').update({ is_default: false }).eq('client_id', cid);
    await supabase.from('crm_pipelines').update({ is_default: true }).eq('id', currentPipe.id);
    log('CRM', `Funil "${currentPipe.name}" definido como padrão`); loadPipelines();
  };

  const deletePipeline = async () => {
    if (!currentPipe) return;
    if (pipelines.length <= 1) { alert('Não é possível excluir o único funil.'); return; }
    if (!window.confirm(`Excluir o funil "${currentPipe.name}"? TODAS as etapas e negócios dele serão apagados. Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('crm_pipelines').delete().eq('id', currentPipe.id);
    if (error) { alert('Erro: ' + error.message); return; }
    log('CRM', `Funil "${currentPipe.name}" excluído`);
    setPid(null); await loadPipelines();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-amber-600 font-bold uppercase animate-pulse">Carregando...</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1"><ChevronLeft size={14} /> Voltar ao funil</button>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Gerenciar Funil</h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Crie, renomeie e reordene as etapas e os funis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funis */}
        <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 h-fit">
          <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Funis</h3>
          <div className="space-y-1">
            {pipelines.map(p => (
              <button key={p.id} onClick={() => { setPid(p.id); setEditingPipe(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold italic flex items-center justify-between gap-2 transition-all ${p.id === pid ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
                <span className="truncate">{p.name}</span>
                {p.is_default && <Star size={12} className="text-amber-500 shrink-0 fill-amber-500" />}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <input type="text" placeholder="Novo funil" className="flex-1 min-w-0 p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={newPipeline} onChange={e => setNewPipeline(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPipeline()} />
            <button onClick={addPipeline} className="px-3 py-2 bg-slate-900 text-amber-500 rounded-lg shrink-0"><Plus size={16} /></button>
          </div>
        </div>

        {/* Etapas do funil selecionado */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          {currentPipe && (
            <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-3">
              {editingPipe ? (
                <div className="flex items-center gap-2 flex-1">
                  <input autoFocus type="text" className="flex-1 p-2 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500" value={editPipeName} onChange={e => setEditPipeName(e.target.value)} onKeyDown={e => e.key === 'Enter' && renamePipeline()} />
                  <button onClick={renamePipeline} className="p-2 bg-amber-600 text-white rounded-lg"><Check size={14} /></button>
                  <button onClick={() => setEditingPipe(false)} className="p-2 bg-slate-100 text-slate-500 rounded-lg"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-bold text-slate-800 italic flex items-center gap-2">{currentPipe.name} <button onClick={() => { setEditPipeName(currentPipe.name); setEditingPipe(true); }} className="text-slate-300 hover:text-amber-600"><Edit2 size={13} /></button></h3>
                  <div className="flex items-center gap-2">
                    {!currentPipe.is_default && <button onClick={setDefaultPipeline} className="text-[9px] font-bold uppercase tracking-wide text-slate-400 hover:text-amber-600 flex items-center gap-1"><Star size={11} /> Tornar padrão</button>}
                    <button onClick={deletePipeline} className="text-[9px] font-bold uppercase tracking-wide text-slate-400 hover:text-red-500 flex items-center gap-1"><Trash2 size={11} /> Excluir funil</button>
                  </div>
                </>
              )}
            </div>
          )}

          <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Etapas</h3>
          <div className="space-y-2">
            {stages.map((s, idx) => {
              const reqIds = Array.isArray(s.required_field_ids) ? s.required_field_ids : [];
              return (
              <div key={s.id} className="bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 p-2">
                  <div className="flex flex-col">
                    <button onClick={() => moveStage(idx, -1)} disabled={idx === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronUp size={14} /></button>
                    <button onClick={() => moveStage(idx, 1)} disabled={idx === stages.length - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronDown size={14} /></button>
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 w-5 text-center shrink-0">{idx + 1}</span>
                  {editStageId === s.id ? (
                    <>
                      <input autoFocus type="text" className="flex-1 p-2 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500" value={editStageName} onChange={e => setEditStageName(e.target.value)} onKeyDown={e => e.key === 'Enter' && renameStage(s)} />
                      <button onClick={() => renameStage(s)} className="p-2 bg-amber-600 text-white rounded-lg"><Check size={14} /></button>
                      <button onClick={() => setEditStageId(null)} className="p-2 bg-slate-100 text-slate-500 rounded-lg"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-bold text-slate-700 italic truncate">{s.name}</span>
                      {fields.length > 0 && <button onClick={() => setExpandedStage(expandedStage === s.id ? null : s.id)} title="Campos exigidos para avançar desta etapa" className={`text-[9px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 border transition-all not-italic ${reqIds.length ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-slate-400 border-slate-200 hover:text-amber-600'}`}>Exigências ({reqIds.length})</button>}
                      <button onClick={() => { setEditStageId(s.id); setEditStageName(s.name); }} className="text-slate-300 hover:text-amber-600 p-1"><Edit2 size={14} /></button>
                      <button onClick={() => deleteStage(s)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
                {expandedStage === s.id && fields.length > 0 && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-200 space-y-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Exigir preenchidos para avançar desta etapa:</p>
                    <div className="flex flex-wrap gap-2">
                      {fields.map(f => {
                        const on = reqIds.includes(f.id);
                        return <button key={f.id} onClick={() => toggleStageField(s, f.id)} className={`text-[10px] font-bold rounded-full px-2.5 py-1 border transition-all not-italic ${on ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'}`}>{f.label}</button>;
                      })}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
            {stages.length === 0 && <p className="text-xs text-slate-400 italic">Nenhuma etapa. Adicione a primeira abaixo.</p>}
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <input type="text" placeholder="Nova etapa" className="flex-1 p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={newStage} onChange={e => setNewStage(e.target.value)} onKeyDown={e => e.key === 'Enter' && addStage()} />
            <button onClick={addStage} className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all"><Plus size={14} /> Adicionar</button>
          </div>
        </div>
      </div>

      {/* Campos personalizados */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Campos personalizados do negócio</h3>
        <p className="text-[11px] text-slate-500">Ex.: Lead Score, faturamento, respostas de qualificação. Aparecem no card de cada negócio.</p>
        <div className="space-y-2">
          {fields.map((f, idx) => (
            <div key={f.id} className="flex items-center gap-2 bg-slate-50 rounded-lg border border-slate-200 p-2">
              <div className="flex flex-col">
                <button onClick={() => moveField(idx, -1)} disabled={idx === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronUp size={14} /></button>
                <button onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronDown size={14} /></button>
              </div>
              {editFieldId === f.id ? (
                <>
                  <input autoFocus type="text" className="flex-1 p-2 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500" value={editFieldLabel} onChange={e => setEditFieldLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && renameField(f)} />
                  <button onClick={() => renameField(f)} className="p-2 bg-amber-600 text-white rounded-lg"><Check size={14} /></button>
                  <button onClick={() => setEditFieldId(null)} className="p-2 bg-slate-100 text-slate-500 rounded-lg"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-bold text-slate-700 italic truncate">{f.label}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5 not-italic">{TYPE_LABEL[f.type]}{f.type === 'select' && Array.isArray(f.options) ? ` (${f.options.length})` : ''}</span>
                  <button onClick={() => { setEditFieldId(f.id); setEditFieldLabel(f.label); }} className="text-slate-300 hover:text-amber-600 p-1"><Edit2 size={14} /></button>
                  <button onClick={() => deleteField(f)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
          {fields.length === 0 && <p className="text-xs text-slate-400 italic">Nenhum campo personalizado.</p>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
          <input type="text" placeholder="Nome do campo (ex: Lead Score)" className="flex-1 p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={nfLabel} onChange={e => setNfLabel(e.target.value)} />
          <select value={nfType} onChange={e => setNfType(e.target.value)} className="p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white">
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="select">Seleção</option>
            <option value="date">Data</option>
            <option value="checkbox">Sim/Não</option>
          </select>
          {nfType === 'select' && (
            <input type="text" placeholder="Opções, separadas por vírgula" className="flex-1 p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={nfOptions} onChange={e => setNfOptions(e.target.value)} />
          )}
          <button onClick={addField} className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shrink-0"><Plus size={14} /> Adicionar</button>
        </div>
      </div>

      {/* Etiquetas */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><Tag size={13} className="text-amber-600" /> Etiquetas</h3>
        <p className="text-[11px] text-slate-500">Segmente os negócios (ex.: Quente, Agro, Indicação). Aparecem no card e permitem filtrar.</p>
        <div className="flex flex-wrap gap-2">
          {tags.map(t => (
            <div key={t.id} className="flex items-center gap-1.5 rounded-full border pl-2.5 pr-2 py-1" style={{ backgroundColor: t.color + '18', borderColor: t.color + '55' }}>
              {editTagId === t.id ? (
                <input autoFocus type="text" className="w-24 bg-transparent text-xs font-bold outline-none not-italic" style={{ color: t.color }} value={editTagName} onChange={e => setEditTagName(e.target.value)} onKeyDown={e => e.key === 'Enter' && renameTag(t)} onBlur={() => renameTag(t)} />
              ) : (
                <button onClick={() => { setEditTagId(t.id); setEditTagName(t.name); }} className="text-xs font-bold not-italic" style={{ color: t.color }}>{t.name}</button>
              )}
              <button onClick={() => deleteTag(t)} className="opacity-60 hover:opacity-100" style={{ color: t.color }}><X size={12} /></button>
            </div>
          ))}
          {tags.length === 0 && <p className="text-xs text-slate-400 italic">Nenhuma etiqueta ainda.</p>}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <div className="flex gap-1 shrink-0">
            {PALETTE.map(c => <button key={c} onClick={() => setNtColor(c)} title="Cor" className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110" style={{ backgroundColor: c, borderColor: ntColor === c ? '#0f172a' : 'transparent' }} />)}
          </div>
          <input type="text" placeholder="Nova etiqueta" className="flex-1 p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={ntName} onChange={e => setNtName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} />
          <button onClick={addTag} className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shrink-0"><Plus size={14} /> Adicionar</button>
        </div>
      </div>
    </div>
  );
};
