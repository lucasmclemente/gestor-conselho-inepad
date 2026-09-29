import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChevronLeft, ArrowRightLeft, Check, Filter } from 'lucide-react';

type Props = { cid: string; currentUser: any; members: any[]; onBack: () => void; onDone: () => void };
const BRL = (n: any) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const CrmBulkMove: React.FC<Props> = ({ cid, currentUser, members, onBack, onDone }) => {
  const crmUsers = members.filter((m: any) => ['SuperAdmin', 'Administrador', 'Comercial'].includes(m.role));
  const nameOf = (id: string | null) => !id ? 'Sem responsável' : (crmUsers.find((m: any) => m.id === id)?.name || (id === currentUser?.id ? currentUser?.name : '—'));

  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]); // todas as etapas de todos os funis
  const [origin, setOrigin] = useState('');
  const [owner, setOwner] = useState('all');
  const [originStage, setOriginStage] = useState('all');
  const [target, setTarget] = useState('');
  const [targetStage, setTargetStage] = useState('');
  const [deals, setDeals] = useState<any[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);

  // funis + etapas
  useEffect(() => {
    (async () => {
      const { data: pp } = await supabase.from('crm_pipelines').select('id, name').eq('client_id', cid).eq('active', true).order('position');
      const list = pp || []; setPipelines(list);
      const ids = list.map((p: any) => p.id);
      if (ids.length) { const { data: st } = await supabase.from('crm_stages').select('id, name, pipeline_id, position').in('pipeline_id', ids).eq('active', true).order('position'); setStages(st || []); }
      if (list.length) { setOrigin(list[0].id); setTarget(list.length > 1 ? list[1].id : list[0].id); }
    })();
  }, [cid]);

  const originStages = useMemo(() => stages.filter(s => s.pipeline_id === origin), [stages, origin]);
  const targetStages = useMemo(() => stages.filter(s => s.pipeline_id === target), [stages, target]);
  useEffect(() => { setOriginStage('all'); }, [origin]);
  useEffect(() => { setTargetStage(targetStages[0]?.id || ''); }, [target, targetStages.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const stageName = (id: string) => stages.find(s => s.id === id)?.name || '—';

  const load = useCallback(async () => {
    if (!origin) return;
    setLoading(true); setSel(new Set());
    let q = supabase.from('crm_deals').select('id, title, value, stage_id, owner_member_id').eq('client_id', cid).eq('pipeline_id', origin).eq('status', 'open');
    if (owner === 'none') q = q.is('owner_member_id', null); else if (owner !== 'all') q = q.eq('owner_member_id', owner);
    if (originStage !== 'all') q = q.eq('stage_id', originStage);
    const out: any[] = [];
    for (let from = 0; from < 50000; from += 1000) {
      const { data, error } = await q.range(from, from + 999).order('id');
      if (error || !data || !data.length) break;
      out.push(...data); if (data.length < 1000) break;
    }
    setDeals(out); setLoading(false);
  }, [cid, origin, owner, originStage]);
  useEffect(() => { load(); }, [load]);

  const allSel = deals.length > 0 && sel.size === deals.length;
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel(allSel ? new Set() : new Set(deals.map(d => d.id)));

  const move = async () => {
    if (!sel.size) { alert('Selecione ao menos um negócio.'); return; }
    if (!target || !targetStage) { alert('Escolha o funil e a etapa de destino.'); return; }
    if (target === origin && targetStages.find(s => s.id === targetStage) && originStage !== 'all' && targetStage === originStage) { if (!window.confirm('Origem e destino são a mesma etapa. Continuar mesmo assim?')) return; }
    const tName = pipelines.find(p => p.id === target)?.name || '';
    if (!window.confirm(`Mover ${sel.size} negócio(s) para o funil "${tName}", etapa "${stageName(targetStage)}"?`)) return;
    setMoving(true);
    const ids = [...sel];
    let done = 0, err = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const { error } = await supabase.from('crm_deals').update({ pipeline_id: target, stage_id: targetStage, position: 0 }).in('id', batch);
      if (error) { err += batch.length; console.warn(error.message); } else done += batch.length;
    }
    setMoving(false);
    alert(`Movidos: ${done}${err ? ` | falhas: ${err}` : ''}.`);
    onDone();
    load();
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div>
        <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1 mb-2"><ChevronLeft size={14} /> Voltar ao funil</button>
        <h2 className="text-2xl font-bold text-slate-800 italic flex items-center gap-2"><ArrowRightLeft size={22} className="text-amber-600" /> Mover negócios em massa</h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Filtre, selecione e mova para outro funil/etapa</p>
      </div>

      {/* Filtros de origem */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Filter size={11} /> Funil de origem</label>
          <select value={origin} onChange={e => setOrigin(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white">{pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label className="text-[10px] font-bold text-slate-400 uppercase">Responsável</label>
          <select value={owner} onChange={e => setOwner(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white"><option value="all">Todos</option><option value="none">Sem responsável</option>{crmUsers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        <div><label className="text-[10px] font-bold text-slate-400 uppercase">Etapa</label>
          <select value={originStage} onChange={e => setOriginStage(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white"><option value="all">Todas</option>{originStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      </div>

      {/* Destino + ação */}
      <div className="bg-slate-900 p-4 rounded-xl shadow-sm flex flex-wrap items-end gap-3">
        <div className="min-w-[160px]"><label className="text-[10px] font-bold text-slate-400 uppercase">Funil de destino</label>
          <select value={target} onChange={e => setTarget(e.target.value)} className="w-full p-2.5 rounded-lg text-sm font-bold outline-none bg-white/10 text-white border border-white/10">{pipelines.map(p => <option key={p.id} value={p.id} className="text-slate-800">{p.name}</option>)}</select></div>
        <div className="min-w-[160px]"><label className="text-[10px] font-bold text-slate-400 uppercase">Etapa de destino</label>
          <select value={targetStage} onChange={e => setTargetStage(e.target.value)} className="w-full p-2.5 rounded-lg text-sm font-bold outline-none bg-white/10 text-white border border-white/10">{targetStages.map(s => <option key={s.id} value={s.id} className="text-slate-800">{s.name}</option>)}</select></div>
        <button onClick={move} disabled={moving || !sel.size} className="ml-auto px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-40">
          <ArrowRightLeft size={15} /> {moving ? 'Movendo...' : `Mover ${sel.size} selecionado(s)`}
        </button>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100">
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-600 cursor-pointer">
            <input type="checkbox" checked={allSel} onChange={toggleAll} className="w-4 h-4 accent-amber-600" /> Selecionar todos
          </label>
          <span className="text-[11px] text-slate-400 ml-auto">{deals.length} negócio(s) · {sel.size} selecionado(s)</span>
        </div>
        {loading ? <div className="h-40 flex items-center justify-center text-amber-600 font-bold uppercase animate-pulse">Carregando...</div>
          : deals.length === 0 ? <div className="p-10 text-center text-sm text-slate-400 italic">Nenhum negócio com esses filtros.</div>
            : <div className="max-h-[52vh] overflow-y-auto divide-y divide-slate-50">
              {deals.map(d => (
                <label key={d.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${sel.has(d.id) ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={sel.has(d.id)} onChange={() => toggle(d.id)} className="w-4 h-4 accent-amber-600 shrink-0" />
                  <span className="flex-1 min-w-0"><span className="text-sm font-bold text-slate-800 italic truncate block">{d.title}</span><span className="text-[10px] text-slate-400 uppercase tracking-wide">{stageName(d.stage_id)} · {nameOf(d.owner_member_id)}</span></span>
                  <span className="text-[11px] font-bold text-slate-500 shrink-0">{BRL(d.value)}</span>
                </label>
              ))}
            </div>}
      </div>
      <p className="text-[11px] text-slate-400 italic px-1">Move apenas negócios <b>abertos</b>. O responsável e o histórico são preservados — muda só o funil e a etapa.</p>
    </div>
  );
};
