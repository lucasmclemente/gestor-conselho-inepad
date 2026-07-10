import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Okr } from './Okr';
import { generateStrategyPDF } from '../services/generateStrategyPDF';
import {
  Compass, Target, Plus, X, Save, Edit2, Trash2, ChevronLeft, ChevronUp, ChevronDown,
  Gauge, Link2, TrendingUp, CheckCircle2, AlertCircle, PenLine, Building2, Sparkles, Download,
} from 'lucide-react';

const DEFAULT_PERSPECTIVES = ['Financeira', 'Clientes', 'Processos Internos', 'Aprendizado & Crescimento'];
const SEM = {
  0: { dot: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-600', label: 'No alvo', border: 'border-l-emerald-500' },
  1: { dot: 'bg-amber-500', ring: 'ring-amber-200', text: 'text-amber-600', label: 'Atenção', border: 'border-l-amber-500' },
  2: { dot: 'bg-red-600', ring: 'ring-red-200', text: 'text-red-600', label: 'Crítico', border: 'border-l-red-600' },
} as const;

type Props = {
  currentUser: any;
  activeClientId: string | null;
  canEdit: boolean;
  addLog?: (action: string, details: string) => void;
};

export const Estrategia: React.FC<Props> = ({ currentUser, activeClientId, canEdit, addLog }) => {
  const cid = activeClientId || currentUser?.client_id;
  const clientLabel = cid;

  const [view, setView] = useState<'painel' | 'mapa' | 'okrs' | 'swot'>('painel');
  const [swot, setSwot] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [framework, setFramework] = useState<any>({ mission: '', vision: '', values_text: '', success_factors: '' });
  const [perspectives, setPerspectives] = useState<any[]>([]);
  const [objectives, setObjectives] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, number>>({});

  const [detailObj, setDetailObj] = useState<any>(null);
  const [fwModal, setFwModal] = useState<any>(null);
  const [perspModal, setPerspModal] = useState(false);
  const [objModal, setObjModal] = useState<any>(null);
  const [linkModal, setLinkModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const log = (a: string, d: string) => { try { addLog && addLog(a, d); } catch { /* noop */ } };

  const load = useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    const [fw, ps, obj, lk, ind, st, sw] = await Promise.all([
      supabase.from('strategy_framework').select('*').eq('client_id', cid).maybeSingle(),
      supabase.from('perspectives').select('*').eq('client_id', cid).eq('active', true).order('position'),
      supabase.from('objectives').select('*').eq('client_id', cid).eq('active', true).order('position'),
      supabase.from('objective_links').select('*').eq('client_id', cid),
      supabase.from('indicators').select('id, name, unit, category, objective_id').eq('client_id', cid).eq('active', true).order('name'),
      supabase.from('indicator_current_status').select('indicator_id, breach_level').eq('client_id', cid),
      supabase.from('swot_items').select('*').eq('client_id', cid).order('created_at'),
    ]) as any;
    setFramework(fw?.data || { mission: '', vision: '', values_text: '', success_factors: '' });
    setPerspectives(ps.data || []);
    setObjectives(obj.data || []);
    setLinks(lk.data || []);
    setIndicators(ind.data || []);
    setSwot(sw.data || []);
    const sm: Record<string, number> = {};
    (st.data || []).forEach((r: any) => { sm[r.indicator_id] = r.breach_level || 0; });
    setStatusMap(sm);
    setLoading(false);
  }, [cid]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setDetailObj(null); setView('painel'); }, [cid]);

  // Farol de um objetivo = pior semáforo entre os indicadores vinculados
  const objIndicators = (objId: string) => indicators.filter(i => i.objective_id === objId);
  const objFarol = (objId: string): number | null => {
    const inds = objIndicators(objId);
    if (inds.length === 0) return null;
    return Math.max(...inds.map(i => statusMap[i.id] ?? 0));
  };
  const objName = (id: string) => objectives.find(o => o.id === id)?.name || '—';

  // ---------- handlers ----------
  const saveFramework = async () => {
    setSaving(true);
    try {
      const payload = { client_id: cid, mission: fwModal.mission || null, vision: fwModal.vision || null, values_text: fwModal.values_text || null, success_factors: fwModal.success_factors || null, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('strategy_framework').upsert([payload], { onConflict: 'client_id' });
      if (error) throw error;
      setFramework(fwModal); setFwModal(null); log('Estratégia', 'Identidade estratégica atualizada.');
    } catch (e: any) { alert('Erro ao salvar: ' + (e.message || e)); } finally { setSaving(false); }
  };

  const createDefaultPerspectives = async () => {
    setSaving(true);
    try {
      const rows = DEFAULT_PERSPECTIVES.map((name, i) => ({ client_id: cid, name, position: i }));
      const { error } = await supabase.from('perspectives').insert(rows);
      if (error) throw error;
      log('Estratégia', 'Perspectivas padrão criadas.'); await load();
    } catch (e: any) { alert('Erro: ' + (e.message || e)); } finally { setSaving(false); }
  };
  const addPerspective = async (name: string) => {
    const { error } = await supabase.from('perspectives').insert([{ client_id: cid, name, position: perspectives.length }]);
    if (error) { alert('Erro: ' + error.message); return; } await load();
  };
  const renamePerspective = async (id: string, name: string) => {
    await supabase.from('perspectives').update({ name }).eq('id', id);
    setPerspectives(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };
  const deletePerspective = async (p: any) => {
    if (!window.confirm(`Excluir a perspectiva "${p.name}"? Os objetivos dela também serão removidos.`)) return;
    await supabase.from('perspectives').delete().eq('id', p.id); await load();
  };
  const movePerspective = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir; if (j < 0 || j >= perspectives.length) return;
    const a = perspectives[idx], b = perspectives[j];
    await Promise.all([
      supabase.from('perspectives').update({ position: b.position }).eq('id', a.id),
      supabase.from('perspectives').update({ position: a.position }).eq('id', b.id),
    ]);
    await load();
  };

  const saveObjective = async () => {
    if (!objModal.name?.trim()) return alert('Informe o nome do objetivo.');
    if (!objModal.perspective_id) return alert('Escolha a perspectiva.');
    setSaving(true);
    try {
      const payload = { name: objModal.name.trim(), description: objModal.description?.trim() || null, perspective_id: objModal.perspective_id };
      if (objModal.id) {
        await supabase.from('objectives').update(payload).eq('id', objModal.id);
      } else {
        const pos = objectives.filter(o => o.perspective_id === objModal.perspective_id).length;
        await supabase.from('objectives').insert([{ ...payload, client_id: cid, position: pos }]);
      }
      log('Estratégia', `${objModal.id ? 'Objetivo atualizado' : 'Objetivo criado'}: ${payload.name}`);
      setObjModal(null); await load();
    } catch (e: any) { alert('Erro ao salvar objetivo: ' + (e.message || e)); } finally { setSaving(false); }
  };
  const deleteObjective = async (o: any) => {
    if (!window.confirm(`Excluir o objetivo "${o.name}"?`)) return;
    await supabase.from('objectives').delete().eq('id', o.id);
    log('Estratégia', `Objetivo excluído: ${o.name}`);
    setDetailObj(null); await load();
  };

  const linkIndicator = async (indId: string, objId: string | null) => {
    await supabase.from('indicators').update({ objective_id: objId }).eq('id', indId);
    setIndicators(prev => prev.map(i => i.id === indId ? { ...i, objective_id: objId } : i));
  };
  const addLink = async (from: string, to: string) => {
    if (from === to) return alert('Escolha dois objetivos diferentes.');
    const { error } = await supabase.from('objective_links').insert([{ client_id: cid, from_objective: from, to_objective: to }]);
    if (error) { alert(error.message.includes('duplicate') ? 'Esse vínculo já existe.' : 'Erro: ' + error.message); return; }
    await load();
  };
  const removeLink = async (id: string) => { await supabase.from('objective_links').delete().eq('id', id); await load(); };
  const exportPDF = async () => {
    setExporting(true);
    try {
      const [{ data: st }, { data: tg }, { data: cyc }, { data: oob }, { data: kr }, { data: cks }] = await Promise.all([
        supabase.from('indicator_current_status').select('indicator_id, name, unit, direction, current_value, current_period, breach_level').eq('client_id', cid),
        supabase.from('indicator_targets').select('indicator_id, period, target_value').eq('client_id', cid),
        supabase.from('okr_cycles').select('*').eq('client_id', cid).order('created_at', { ascending: false }),
        supabase.from('okr_objectives').select('*').eq('client_id', cid).order('position'),
        supabase.from('key_results').select('*').eq('client_id', cid).order('position'),
        supabase.from('key_result_checkins').select('key_result_id, confidence, created_at').eq('client_id', cid).order('created_at', { ascending: false }),
      ]) as any;
      const stArr = st || []; const stMap: any = {}; stArr.forEach((s: any) => { stMap[s.indicator_id] = s; });
      const tMap: any = {}; (tg || []).forEach((t: any) => { tMap[`${t.indicator_id}|${String(t.period).slice(0, 7)}`] = Number(t.target_value); });
      const indicatorsPdf = stArr.map((s: any) => { const per = s.current_period ? String(s.current_period).slice(0, 7) : ''; return { name: s.name, current: s.current_value, meta: tMap[`${s.indicator_id}|${per}`] ?? null, unit: s.unit, lvl: s.breach_level || 0 }; });
      const objsPdf = objectives.map((o: any) => ({ id: o.id, name: o.name, perspective_id: o.perspective_id, farol: objFarol(o.id) ?? 0 }));
      const krCurrent = (k: any) => { if (k.indicator_id) { const s = stMap[k.indicator_id]; return s && s.current_value != null ? Number(s.current_value) : null; } return k.current_value != null ? Number(k.current_value) : null; };
      const krPct = (k: any) => { const c = krCurrent(k); if (c == null) return 0; const s = Number(k.start_value ?? 0), t = Number(k.target_value); if (t === s) return c >= t ? 100 : 0; return Math.round(Math.max(0, (c - s) / (t - s)) * 100); };
      const okrPdf = (cyc || []).map((cy: any) => ({ cycleName: cy.name, objectives: (oob || []).filter((o: any) => o.cycle_id === cy.id).map((o: any) => { const list = (kr || []).filter((k: any) => k.okr_objective_id === o.id); const prog = list.length ? Math.round(list.reduce((a: number, k: any) => a + Math.min(100, krPct(k)), 0) / list.length) : 0; return { name: o.name, progress: prog, krs: list.map((k: any) => ({ name: k.name, pct: krPct(k) })) }; }) }));
      generateStrategyPDF({ clientName: String(clientLabel || ''), framework, perspectives, objectives: objsPdf, indicators: indicatorsPdf, okr: okrPdf });
    } catch (e: any) { alert('Erro ao gerar PDF: ' + (e?.message || e)); }
    finally { setExporting(false); }
  };
  const addSwot = async (category: string, text: string) => {
    if (!text.trim()) return;
    const { error } = await supabase.from('swot_items').insert([{ client_id: cid, category, text: text.trim() }]);
    if (error) { alert('Erro: ' + error.message); return; }
    await load();
  };
  const deleteSwot = async (id: string) => { await supabase.from('swot_items').delete().eq('id', id); setSwot(prev => prev.filter(s => s.id !== id)); };

  // ---------- render helpers ----------
  const farolCounts = () => {
    let g = 0, y = 0, r = 0, n = 0;
    objectives.forEach(o => { const f = objFarol(o.id); if (f === null) n++; else if (f === 2) r++; else if (f === 1) y++; else g++; });
    return { g, y, r, n };
  };

  if (loading) return <div className="p-8 text-slate-500 text-sm">Carregando estratégia…</div>;

  const fc = farolCounts();

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Cabeçalho + abas */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-2"><Compass size={24} className="text-amber-600" /> Estratégia</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Planejamento estratégico • {clientLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(['painel', 'mapa', 'okrs', 'swot'] as const).map(v => (
              <button key={v} onClick={() => { setDetailObj(null); setView(v); }} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${view === v && !detailObj ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{v === 'painel' ? 'Painel' : v === 'mapa' ? 'Mapa' : v === 'okrs' ? 'OKRs' : 'SWOT'}</button>
            ))}
          </div>
          <button onClick={exportPDF} disabled={exporting} className="border border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-600 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-all disabled:opacity-50"><Download size={14} /> {exporting ? 'Gerando...' : 'Exportar PDF'}</button>
          {canEdit && <button onClick={() => setFwModal({ ...framework })} className="border border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-600 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-all"><PenLine size={14} /> Identidade</button>}
        </div>
      </div>

      {/* ======= DETALHE DO OBJETIVO ======= */}
      {detailObj ? (() => {
        const o = objectives.find(x => x.id === detailObj.id) || detailObj;
        const f = objFarol(o.id);
        const sem = f === null ? null : SEM[f as 0 | 1 | 2];
        const linked = objIndicators(o.id);
        const unlinked = indicators.filter(i => !i.objective_id || i.objective_id !== o.id);
        const outLinks = links.filter(l => l.from_objective === o.id);
        const inLinks = links.filter(l => l.to_objective === o.id);
        return (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setDetailObj(null)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600 transition-all shrink-0"><ChevronLeft size={18} /></button>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-slate-800 italic flex items-center gap-2 truncate">{sem && <span className={`h-3 w-3 rounded-full shrink-0 ${sem.dot}`} />}{o.name}</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{perspectives.find(p => p.id === o.perspective_id)?.name || 'Sem perspectiva'} · {sem ? sem.label : 'sem indicador'}</p>
                </div>
              </div>
              {canEdit && <div className="flex gap-2">
                <button onClick={() => setObjModal({ ...o })} className="p-2 text-slate-400 hover:text-amber-600 border border-slate-200 hover:border-amber-300 rounded-lg" title="Editar"><Edit2 size={15} /></button>
                <button onClick={() => deleteObjective(o)} className="p-2 text-slate-300 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg" title="Excluir"><Trash2 size={15} /></button>
              </div>}
            </div>
            {o.description && <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-sm text-slate-600">{o.description}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Indicadores vinculados */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest italic flex items-center gap-2"><Gauge size={16} className="text-amber-600" /> Indicadores ({linked.length})</h3>
                  {canEdit && <button onClick={() => setLinkModal(true)} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1"><Link2 size={12} /> Vincular</button>}
                </div>
                <div className="p-3 space-y-2">
                  {linked.length === 0 ? <p className="text-sm text-slate-400 p-2">Nenhum indicador vinculado. {canEdit ? 'Vincule para o objetivo ganhar farol.' : ''}</p> : linked.map(i => {
                    const bl = statusMap[i.id] ?? 0; const s = SEM[bl as 0 | 1 | 2];
                    return (
                      <div key={i.id} className="flex items-center justify-between gap-2 border border-slate-100 rounded-lg p-3">
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-800 italic min-w-0 truncate"><span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.dot}`} />{i.name}{i.unit ? <span className="text-[10px] font-normal text-slate-400">({i.unit})</span> : null}</span>
                        {canEdit && <button onClick={() => linkIndicator(i.id, null)} className="text-slate-300 hover:text-red-600 shrink-0" title="Desvincular"><X size={15} /></button>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Causa e efeito */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                  <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest italic flex items-center gap-2"><TrendingUp size={16} className="text-amber-600" /> Causa &amp; efeito</h3>
                </div>
                <div className="p-3 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Contribui para</p>
                    {outLinks.length === 0 ? <p className="text-[12px] text-slate-400">—</p> : outLinks.map(l => (
                      <div key={l.id} className="flex items-center justify-between gap-2 text-sm text-slate-700 py-1"><span className="truncate">→ {objName(l.to_objective)}</span>{canEdit && <button onClick={() => removeLink(l.id)} className="text-slate-300 hover:text-red-600"><X size={14} /></button>}</div>
                    ))}
                  </div>
                  {inLinks.length > 0 && <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Impulsionado por</p>
                    {inLinks.map(l => <div key={l.id} className="text-sm text-slate-500 py-1">← {objName(l.from_objective)}</div>)}
                  </div>}
                  {canEdit && (objectives.filter(x => x.id !== o.id).length > 0 ? (
                    <div className="pt-2 border-t border-slate-100">
                      <select defaultValue="" onChange={e => { if (e.target.value) { addLink(o.id, e.target.value); e.target.value = ''; } }} className="w-full p-2.5 rounded-lg border border-slate-200 text-sm bg-white cursor-pointer outline-none focus:border-amber-400">
                        <option value="">+ Este objetivo contribui para…</option>
                        {objectives.filter(x => x.id !== o.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <p className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed">Crie ao menos <b>outro objetivo</b> para desenhar relações de causa e efeito — ex.: <i>"Formar sucessores"</i> contribui para <i>"Crescer receita"</i>.</p>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">As <b>ações vinculadas</b> a este objetivo entram na Fase 4 (Planos de Ação 5W2H).</p>
          </div>
        );
      })() : view === 'painel' ? (
        /* ======= PAINEL ======= */
        <div className="space-y-6">
          {(framework.mission || framework.vision) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-900 text-white p-5 rounded-xl shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1">Missão</p><p className="text-sm italic">{framework.mission || '—'}</p></div>
              <div className="bg-slate-900 text-white p-5 rounded-xl shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1">Visão</p><p className="text-sm italic">{framework.vision || '—'}</p></div>
            </div>
          ) : canEdit ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center justify-between gap-3">
              <p className="text-sm text-amber-800">Comece definindo a <b>identidade estratégica</b> da empresa (missão, visão, valores).</p>
              <button onClick={() => setFwModal({ ...framework })} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest shrink-0">Definir</button>
            </div>
          ) : null}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button onClick={() => setView('mapa')} className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm text-left hover:shadow-md transition-all"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No alvo</p></div><p className="text-3xl font-bold text-slate-800 mt-1">{fc.g}</p></button>
            <button onClick={() => setView('mapa')} className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm text-left hover:shadow-md transition-all"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500" /><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Atenção</p></div><p className="text-3xl font-bold text-slate-800 mt-1">{fc.y}</p></button>
            <button onClick={() => setView('mapa')} className="bg-white p-5 rounded-xl border border-red-200 shadow-sm text-left hover:shadow-md transition-all"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-600" /><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Crítico</p></div><p className="text-3xl font-bold text-slate-800 mt-1">{fc.r}</p></button>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><div className="flex items-center gap-2"><Target size={13} className="text-slate-400" /><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Objetivos</p></div><p className="text-3xl font-bold text-slate-800 mt-1">{objectives.length}<span className="text-base text-slate-300 font-bold"> · {fc.n} s/ indicador</span></p></div>
          </div>

          {/* Objetivos em alerta */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-50 bg-slate-50/50"><h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest italic flex items-center gap-2"><AlertCircle size={16} className="text-amber-600" /> Objetivos que pedem atenção</h3></div>
            <div className="p-3 space-y-2">
              {objectives.filter(o => (objFarol(o.id) ?? 0) > 0).length === 0 ? (
                <p className="text-sm text-slate-500 p-2 flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Nenhum objetivo em alerta.</p>
              ) : objectives.filter(o => (objFarol(o.id) ?? 0) > 0).sort((a, b) => (objFarol(b.id) ?? 0) - (objFarol(a.id) ?? 0)).map(o => {
                const s = SEM[(objFarol(o.id) as 1 | 2)];
                return <button key={o.id} onClick={() => setDetailObj(o)} className="w-full flex items-center justify-between gap-2 border border-slate-100 rounded-lg p-3 text-left hover:border-amber-300 transition-all"><span className="flex items-center gap-2 text-sm font-bold text-slate-800 italic"><span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />{o.name}</span><span className={`text-[10px] font-bold uppercase ${s.text}`}>{s.label}</span></button>;
              })}
            </div>
          </div>
        </div>
      ) : view === 'okrs' ? (
        <Okr currentUser={currentUser} activeClientId={activeClientId} canEdit={canEdit} addLog={addLog} />
      ) : view === 'swot' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
          {([['forca', 'Forças', 'border-emerald-200', 'bg-emerald-50/60', 'text-emerald-700'], ['fraqueza', 'Fraquezas', 'border-red-200', 'bg-red-50/60', 'text-red-700'], ['oportunidade', 'Oportunidades', 'border-sky-200', 'bg-sky-50/60', 'text-sky-700'], ['ameaca', 'Ameaças', 'border-amber-200', 'bg-amber-50/60', 'text-amber-700']] as [string, string, string, string, string][]).map(([cat, label, bd, bg, tx]) => {
            const items = swot.filter(s => s.category === cat);
            return (
              <div key={cat} className={`rounded-xl border ${bd} ${bg} p-4 shadow-sm`}>
                <h3 className={`text-sm font-bold uppercase tracking-widest ${tx} mb-3`}>{label} <span className="text-slate-400 font-normal">({items.length})</span></h3>
                <div className="space-y-2">
                  {items.length === 0 && <p className="text-[12px] text-slate-400 italic">Nenhum item.</p>}
                  {items.map(it => (
                    <div key={it.id} className="flex items-start justify-between gap-2 bg-white border border-slate-200 rounded-lg p-2.5">
                      <span className="text-sm text-slate-700">{it.text}</span>
                      {canEdit && <button onClick={() => deleteSwot(it.id)} className="text-slate-300 hover:text-red-600 shrink-0 mt-0.5"><X size={13} /></button>}
                    </div>
                  ))}
                  {canEdit && <AddInline placeholder={`Adicionar em ${label.toLowerCase()}…`} onAdd={(t: string) => addSwot(cat, t)} />}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ======= MAPA ======= */
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-slate-400">Cada objetivo acende pelo pior semáforo dos seus indicadores. Clique para abrir.</p>
            {canEdit && <div className="flex gap-2">
              <button onClick={() => setPerspModal(true)} className="border border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-600 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1"><Building2 size={13} /> Perspectivas</button>
              {perspectives.length > 0 && <button onClick={() => setObjModal({ perspective_id: perspectives[0].id, name: '', description: '' })} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1"><Plus size={14} /> Novo objetivo</button>}
            </div>}
          </div>

          {perspectives.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
              <Compass size={32} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nenhuma perspectiva ainda.</p>
              {canEdit && <button disabled={saving} onClick={createDefaultPerspectives} className="mt-3 bg-slate-900 text-amber-500 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50"><Sparkles size={14} /> Criar as 4 perspectivas padrão</button>}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {perspectives.map(p => {
                const objs = objectives.filter(o => o.perspective_id === p.id);
                return (
                  <div key={p.id} className="grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-3 p-4 border-b border-slate-100 last:border-0 items-center">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-600">{p.name}</div>
                    <div className="flex flex-wrap gap-2">
                      {objs.length === 0 ? <span className="text-[12px] text-slate-300 italic">sem objetivos</span> : objs.map(o => {
                        const f = objFarol(o.id); const s = f === null ? null : SEM[f as 0 | 1 | 2];
                        return (
                          <button key={o.id} onClick={() => setDetailObj(o)} className={`text-left text-[12.5px] font-bold text-slate-800 bg-white border border-slate-200 border-l-4 ${s ? s.border : 'border-l-slate-300'} rounded-lg px-3 py-2 hover:shadow-md transition-all`}>
                            <span className="flex items-center gap-2">{s && <span className={`h-2 w-2 rounded-full ${s.dot}`} />}{o.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== Modal: Identidade (framework) ===== */}
      {fwModal && (
        <Modal title="Identidade estratégica" icon={<PenLine size={20} className="text-amber-600" />} onClose={() => setFwModal(null)}>
          <div className="space-y-3">
            {(['mission', 'vision', 'values_text', 'success_factors'] as const).map(k => (
              <div key={k}>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{k === 'mission' ? 'Missão' : k === 'vision' ? 'Visão' : k === 'values_text' ? 'Valores' : 'Fatores de sucesso'}</label>
                <textarea value={fwModal[k] || ''} onChange={e => setFwModal({ ...fwModal, [k]: e.target.value })} rows={k === 'mission' || k === 'vision' ? 2 : 2} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm resize-none" />
              </div>
            ))}
          </div>
          <ModalFooter onCancel={() => setFwModal(null)} onSave={saveFramework} saving={saving} label="Salvar identidade" />
        </Modal>
      )}

      {/* ===== Modal: Perspectivas ===== */}
      {perspModal && (
        <Modal title="Perspectivas" icon={<Building2 size={20} className="text-amber-600" />} onClose={() => setPerspModal(false)}>
          <div className="space-y-2">
            {perspectives.map((p, idx) => (
              <div key={p.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
                <div className="flex flex-col">
                  <button onClick={() => movePerspective(idx, -1)} disabled={idx === 0} className="text-slate-300 hover:text-amber-600 disabled:opacity-30"><ChevronUp size={14} /></button>
                  <button onClick={() => movePerspective(idx, 1)} disabled={idx === perspectives.length - 1} className="text-slate-300 hover:text-amber-600 disabled:opacity-30"><ChevronDown size={14} /></button>
                </div>
                <input value={p.name} onChange={e => renamePerspective(p.id, e.target.value)} className="flex-1 p-2 rounded-lg border border-slate-100 text-sm outline-none focus:border-amber-400" />
                <button onClick={() => deletePerspective(p)} className="text-slate-300 hover:text-red-600 p-1"><Trash2 size={15} /></button>
              </div>
            ))}
            <AddInline placeholder="Nova perspectiva…" onAdd={addPerspective} />
          </div>
          <div className="p-4 border-t bg-white mt-4 -mx-6 -mb-6 px-6 pb-6"><button onClick={() => setPerspModal(false)} className="w-full border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-50">Fechar</button></div>
        </Modal>
      )}

      {/* ===== Modal: Objetivo ===== */}
      {objModal && (
        <Modal title={objModal.id ? 'Editar objetivo' : 'Novo objetivo'} icon={<Target size={20} className="text-amber-600" />} onClose={() => setObjModal(null)}>
          <div className="space-y-3">
            <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do objetivo *</label><input value={objModal.name} onChange={e => setObjModal({ ...objModal, name: e.target.value })} placeholder="Ex.: Crescer receita 15%" className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm" /></div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Perspectiva *</label>
              <select value={objModal.perspective_id || ''} onChange={e => setObjModal({ ...objModal, perspective_id: e.target.value })} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm bg-white cursor-pointer">
                <option value="">Selecione…</option>
                {perspectives.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição (opcional)</label><textarea value={objModal.description || ''} onChange={e => setObjModal({ ...objModal, description: e.target.value })} rows={2} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm resize-none" /></div>
          </div>
          <ModalFooter onCancel={() => setObjModal(null)} onSave={saveObjective} saving={saving} label="Salvar objetivo" />
        </Modal>
      )}

      {/* ===== Modal: Vincular indicador ===== */}
      {linkModal && detailObj && (
        <Modal title="Vincular indicador" icon={<Link2 size={20} className="text-amber-600" />} onClose={() => setLinkModal(false)}>
          <p className="text-[12px] text-slate-500 mb-3">Escolha indicadores para medir <b>{detailObj.name}</b>.</p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {indicators.length === 0 ? <p className="text-sm text-slate-400">Nenhum indicador cadastrado. Crie indicadores no menu Indicadores.</p> : indicators.map(i => {
              const here = i.objective_id === detailObj.id; const elsewhere = i.objective_id && !here;
              return (
                <label key={i.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${here ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={here} onChange={() => linkIndicator(i.id, here ? null : detailObj.id)} className="accent-amber-600 w-4 h-4" />
                  <div className="min-w-0"><p className="text-sm font-bold text-slate-800 italic truncate">{i.name}{i.unit ? <span className="text-[10px] font-normal text-slate-400"> ({i.unit})</span> : null}</p>{elsewhere && <p className="text-[9px] text-amber-600 uppercase tracking-widest">já vinculado a outro objetivo</p>}</div>
                </label>
              );
            })}
          </div>
          <div className="p-4 border-t bg-white mt-4 -mx-6 -mb-6 px-6 pb-6"><button onClick={() => setLinkModal(false)} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px]">Concluir</button></div>
        </Modal>
      )}
    </div>
  );
};

// ---------- pequenos componentes de UI ----------
const Modal: React.FC<{ title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }> = ({ title, icon, onClose, children }) => (
  <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
      <div className="p-6 border-b flex justify-between items-center bg-slate-50">
        <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2">{icon} {title}</h3>
        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">{children}</div>
    </div>
  </div>
);
const ModalFooter: React.FC<{ onCancel: () => void; onSave: () => void; saving: boolean; label: string }> = ({ onCancel, onSave, saving, label }) => (
  <div className="flex gap-3 mt-5">
    <button onClick={onCancel} className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-50">Cancelar</button>
    <button disabled={saving} onClick={onSave} className="flex-[2] bg-amber-600 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] flex items-center justify-center gap-2 hover:bg-amber-700 shadow-xl disabled:opacity-50"><Save size={16} /> {saving ? 'Salvando...' : label}</button>
  </div>
);
const AddInline: React.FC<{ placeholder: string; onAdd: (v: string) => void }> = ({ placeholder, onAdd }) => {
  const [v, setV] = useState('');
  return (
    <div className="flex gap-2 pt-1">
      <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && v.trim()) { onAdd(v.trim()); setV(''); } }} placeholder={placeholder} className="flex-1 p-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-amber-400" />
      <button onClick={() => { if (v.trim()) { onAdd(v.trim()); setV(''); } }} className="bg-slate-900 text-amber-500 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1 hover:bg-slate-800"><Plus size={14} /></button>
    </div>
  );
};
