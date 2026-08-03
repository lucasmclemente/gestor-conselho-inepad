import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Filter, Plus, X, Save, Trash2, Trophy, Ban, Settings, Upload } from 'lucide-react';
import { CrmDeal } from './CrmDeal';
import { CrmSettings } from './CrmSettings';
import { CrmImport } from './CrmImport';

type Props = {
  currentUser: any;
  activeClientId: string | null;
  isAdmin: boolean;
  members?: any[];
  addLog?: (action: string, details: string) => Promise<void> | void;
};

const BRL = (n: any) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const Crm: React.FC<Props> = ({ currentUser, activeClientId, isAdmin, members = [], addLog }) => {
  const cid = activeClientId || currentUser?.client_id;
  // Logging não pode quebrar o CRM: o Comercial não lê audit_logs (o .select() do addLog falha).
  const log = async (a: string, d: string) => { try { await addLog?.(a, d); } catch { /* noop */ } };

  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dealModal, setDealModal] = useState<any>(null); // { stage_id } ao criar
  const [form, setForm] = useState({ title: '', value: '', expected_close_date: '' });
  const [saving, setSaving] = useState(false);

  const ownerName = (id: string) => (members.find((m: any) => m.id === id)?.name) || (id === currentUser?.id ? currentUser?.name : '');

  // 1) Carrega os funis do cliente (uma vez / ao trocar de cliente)
  const loadPipelines = useCallback(async () => {
    if (!cid) return;
    const { data } = await supabase.from('crm_pipelines').select('*').eq('client_id', cid).eq('active', true).order('position');
    const list = data || [];
    setPipelines(list);
    setPipelineId(prev => (prev && list.some((p: any) => p.id === prev)) ? prev : (list.find((p: any) => p.is_default)?.id || list[0]?.id || null));
    if (list.length === 0) setLoading(false);
  }, [cid]);

  // 2) Carrega etapas + negócios do funil selecionado
  const loadBoard = useCallback(async () => {
    if (!pipelineId) { setStages([]); setDeals([]); return; }
    setLoading(true);
    const [{ data: sts }, { data: dls }] = await Promise.all([
      supabase.from('crm_stages').select('*').eq('pipeline_id', pipelineId).eq('active', true).order('position'),
      supabase.from('crm_deals').select('*').eq('pipeline_id', pipelineId).eq('status', 'open').order('position').order('created_at', { ascending: false }),
    ]);
    setStages(sts || []);
    setDeals(dls || []);
    setLoading(false);
  }, [pipelineId]);

  useEffect(() => { loadPipelines(); }, [loadPipelines]);
  useEffect(() => { loadBoard(); }, [loadBoard]);

  // Cria um funil padrão (para cliente que acabou de ativar o add-on)
  const createDefaultPipeline = async () => {
    const { data: p, error } = await supabase.from('crm_pipelines')
      .insert({ client_id: cid, name: 'Comercial', position: 0, is_default: true }).select().single();
    if (error || !p) { alert('Erro ao criar funil: ' + (error?.message || '')); return; }
    const defaults = ['Lead', 'Contato', 'Proposta', 'Negociação'];
    await supabase.from('crm_stages').insert(defaults.map((name, i) => ({ client_id: cid, pipeline_id: p.id, name, position: i })));
    log('CRM', 'Funil padrão criado');
    await loadPipelines();
  };

  // Arrastar negócio para outra etapa
  const moveDeal = async (dealId: string, toStageId: string) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal || deal.stage_id === toStageId) return;
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage_id: toStageId } : d)); // otimista
    const { error } = await supabase.from('crm_deals').update({ stage_id: toStageId }).eq('id', dealId);
    if (error) { alert('Erro ao mover: ' + error.message); loadBoard(); return; }
    const st = stages.find(s => s.id === toStageId);
    log('CRM', `Negócio "${deal.title}" movido para ${st?.name}`);
  };

  const openNew = (stageId: string) => { setForm({ title: '', value: '', expected_close_date: '' }); setDealModal({ stage_id: stageId }); };

  const saveDeal = async () => {
    if (!form.title.trim()) return alert('Informe o título do negócio.');
    setSaving(true);
    const payload: any = {
      client_id: cid,
      pipeline_id: pipelineId,
      stage_id: dealModal.stage_id,
      title: form.title.trim(),
      value: parseFloat(String(form.value).replace(',', '.')) || 0,
      expected_close_date: form.expected_close_date || null,
      owner_member_id: currentUser?.id || null,
      status: 'open',
    };
    const { data, error } = await supabase.from('crm_deals').insert(payload).select().single();
    setSaving(false);
    if (error) { alert('Erro ao criar negócio: ' + error.message); return; }
    setDeals(prev => [data, ...prev]);
    setDealModal(null);
    log('CRM', `Novo negócio: ${data.title} (${BRL(data.value)})`);
  };

  const setOutcome = async (deal: any, status: 'won' | 'lost') => {
    const stamp = status === 'won' ? { won_at: new Date().toISOString() } : { lost_at: new Date().toISOString() };
    const { error } = await supabase.from('crm_deals').update({ status, ...stamp }).eq('id', deal.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setDeals(prev => prev.filter(d => d.id !== deal.id)); // some do board (só mostramos abertos)
    log('CRM', `Negócio "${deal.title}" marcado como ${status === 'won' ? 'Ganho' : 'Perdido'}`);
  };

  const removeDeal = async (deal: any) => {
    if (!window.confirm(`Excluir o negócio "${deal.title}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('crm_deals').delete().eq('id', deal.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setDeals(prev => prev.filter(d => d.id !== deal.id));
    log('CRM', `Negócio "${deal.title}" excluído`);
  };

  const boardTotal = deals.reduce((s, d) => s + (Number(d.value) || 0), 0);

  if (settingsOpen) return (
    <CrmSettings cid={cid} members={members} addLog={addLog} onBack={() => { setSettingsOpen(false); loadPipelines(); loadBoard(); }} />
  );

  // Detalhe do negócio (abre ao clicar num card). Antes do loading para não desmontar ao recarregar o board.
  if (detailId) return (
    <CrmDeal dealId={detailId} cid={cid} currentUser={currentUser} isAdmin={isAdmin} members={members}
      stages={stages} addLog={addLog}
      onBack={() => setDetailId(null)} onMutated={loadBoard} />
  );

  if (loading) return <div className="flex items-center justify-center h-64 text-amber-600 font-bold uppercase animate-pulse">Carregando CRM...</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">CRM Comercial</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Funil de vendas • {deals.length} negócio(s) aberto(s) • {BRL(boardTotal)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pipelines.length > 1 && (
            <select value={pipelineId || ''} onChange={e => setPipelineId(e.target.value)}
              className="p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 transition-colors bg-white not-italic">
              {pipelines.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button onClick={() => setImportOpen(true)} title="Importar leads e contatos"
            className="p-2.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
            <Upload size={16} /><span className="hidden sm:inline">Importar</span>
          </button>
          {isAdmin && (
            <button onClick={() => setSettingsOpen(true)} title="Gerenciar funil"
              className="p-2.5 rounded-lg bg-slate-900 text-amber-500 hover:bg-slate-800 transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
              <Settings size={16} /><span className="hidden sm:inline">Gerenciar funil</span>
            </button>
          )}
        </div>
      </div>

      {pipelines.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-4">
          <Filter size={40} className="text-amber-500" />
          <h2 className="text-lg font-bold text-slate-700 italic">Nenhum funil ainda</h2>
          <p className="text-sm text-slate-400 max-w-md">Crie seu primeiro funil de vendas para começar a cadastrar negócios.</p>
          <button onClick={createDefaultPipeline} className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-md">
            <Plus size={16} /> Criar funil padrão
          </button>
        </div>
      ) : stages.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center text-sm text-slate-400 italic">Este funil não tem etapas.</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage: any) => {
            const stageDeals = deals.filter(d => d.stage_id === stage.id);
            const total = stageDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
            const isOver = overStage === stage.id;
            return (
              <div key={stage.id}
                onDragOver={e => { e.preventDefault(); setOverStage(stage.id); }}
                onDragLeave={() => setOverStage(prev => prev === stage.id ? null : prev)}
                onDrop={() => { if (dragId) moveDeal(dragId, stage.id); setDragId(null); setOverStage(null); }}
                className={`w-72 shrink-0 flex flex-col rounded-xl border transition-colors ${isOver ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                <div className="p-3 border-b border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-600 truncate italic">{stage.name}</h3>
                    <span className="text-[10px] font-bold text-slate-500 bg-white rounded-full px-2 py-0.5 border border-slate-200 shrink-0">{stageDeals.length}</span>
                  </div>
                  {total > 0 && <p className="text-[10px] font-bold text-amber-600 mt-1">{BRL(total)}</p>}
                </div>

                <div className="flex-1 p-2 space-y-2 min-h-[120px]">
                  {stageDeals.map((deal: any) => (
                    <div key={deal.id} draggable
                      onClick={() => setDetailId(deal.id)}
                      onDragStart={() => setDragId(deal.id)}
                      onDragEnd={() => { setDragId(null); setOverStage(null); }}
                      className="group bg-white rounded-lg border border-slate-200 p-3 shadow-sm cursor-pointer hover:border-amber-300 hover:shadow transition-all">
                      <p className="text-sm font-bold text-slate-800 italic leading-tight">{deal.title}</p>
                      {Number(deal.value) > 0 && <p className="text-[11px] font-bold text-emerald-600 mt-1 not-italic">{BRL(deal.value)}</p>}
                      {ownerName(deal.owner_member_id) && <p className="text-[9px] text-slate-400 uppercase tracking-wide mt-1 truncate not-italic">{ownerName(deal.owner_member_id)}</p>}
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setOutcome(deal, 'won'); }} title="Marcar como Ganho" className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 hover:text-emerald-700 flex items-center gap-1 not-italic"><Trophy size={12} /> Ganho</button>
                        <button onClick={(e) => { e.stopPropagation(); setOutcome(deal, 'lost'); }} title="Marcar como Perdido" className="text-[9px] font-bold uppercase tracking-wide text-slate-400 hover:text-red-500 flex items-center gap-1 not-italic"><Ban size={12} /> Perdido</button>
                        <button onClick={(e) => { e.stopPropagation(); removeDeal(deal); }} title="Excluir" className="ml-auto text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={() => openNew(stage.id)}
                  className="m-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 hover:text-amber-600 hover:bg-white flex items-center justify-center gap-1 py-2 rounded-lg transition-all">
                  <Plus size={12} /> Negócio
                </button>
              </div>
            );
          })}
        </div>
      )}

      {dealModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-in fade-in" onClick={() => setDealModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800 italic">Novo Negócio</h3>
              <button onClick={() => setDealModal(null)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Título / Empresa</label>
              <input autoFocus type="text" placeholder="Ex: Consultoria de Governança — Empresa X" className="w-full p-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 transition-colors" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor (R$)</label>
                <input type="number" step="0.01" min="0" placeholder="0,00" className="w-full p-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 transition-colors" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Previsão</label>
                <input type="date" className="w-full p-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 transition-colors" value={form.expected_close_date} onChange={e => setForm({ ...form, expected_close_date: e.target.value })} />
              </div>
            </div>
            <button disabled={saving} onClick={saveDeal} className="w-full px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50">
              <Save size={16} /> {saving ? 'Salvando...' : 'Criar Negócio'}
            </button>
          </div>
        </div>
      )}

      {importOpen && (
        <CrmImport cid={cid} currentUser={currentUser} members={members} pipelineId={pipelineId} stages={stages} addLog={addLog}
          onClose={() => setImportOpen(false)} onDone={loadBoard} />
      )}
    </div>
  );
};
