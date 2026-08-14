import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChevronLeft, ArrowRight, Users, Trash2 } from 'lucide-react';

type Props = {
  cid: string;
  members: any[];
  addLog?: (action: string, details: string) => Promise<void> | void;
  onBack: () => void;
  onMutated: () => void;
  onOpenDeal: (id: string) => void;
};

const BRL = (n: any) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS_LABEL: Record<string, string> = { open: 'Aberto', won: 'Ganho', lost: 'Perdido' };

export const CrmLeads: React.FC<Props> = ({ cid, members, addLog, onBack, onMutated, onOpenDeal }) => {
  const log = async (a: string, d: string) => { try { await addLog?.(a, d); } catch { /* noop */ } };
  const crmUsers = members.filter((m: any) => ['SuperAdmin', 'Administrador', 'Comercial'].includes(m.role));
  const nameOf = (id: string) => crmUsers.find((m: any) => m.id === id)?.name || '—';

  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<any[]>([]);
  const [stagesMap, setStagesMap] = useState<Map<string, string>>(new Map());
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetOwner, setTargetOwner] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: sts }, { data: dls }] = await Promise.all([
      supabase.from('crm_stages').select('id, name').eq('client_id', cid),
      supabase.from('crm_deals').select('*').eq('client_id', cid).order('created_at', { ascending: false }),
    ]);
    setStagesMap(new Map((sts || []).map((s: any) => [s.id, s.name])));
    setDeals(dls || []);
    setLoading(false);
  }, [cid]);
  useEffect(() => { load(); }, [load]);

  const filtered = deals.filter(d =>
    (ownerFilter === 'all' || (ownerFilter === 'none' ? !d.owner_member_id : d.owner_member_id === ownerFilter)) &&
    (statusFilter === 'all' || d.status === statusFilter)
  );

  const allChecked = filtered.length > 0 && filtered.every(d => selected.has(d.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) filtered.forEach(d => next.delete(d.id));
    else filtered.forEach(d => next.add(d.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const transfer = async () => {
    const ids = [...selected].filter(id => filtered.some(d => d.id === id));
    if (!targetOwner) return alert('Selecione o novo responsável.');
    if (!ids.length) return alert('Selecione ao menos um lead.');
    if (!window.confirm(`Transferir ${ids.length} lead(s) para ${nameOf(targetOwner)}?`)) return;
    setTransferring(true);
    const { error } = await supabase.from('crm_deals').update({ owner_member_id: targetOwner }).in('id', ids);
    setTransferring(false);
    if (error) { alert('Erro ao transferir: ' + error.message); return; }
    log('CRM', `${ids.length} lead(s) transferidos para ${nameOf(targetOwner)}`);
    setDeals(prev => prev.map(d => ids.includes(d.id) ? { ...d, owner_member_id: targetOwner } : d));
    setSelected(new Set()); setTargetOwner('');
    onMutated();
  };

  const removeLeads = async () => {
    const ids = [...selected].filter(id => filtered.some(d => d.id === id));
    if (!ids.length) return alert('Selecione ao menos um lead.');
    if (!window.confirm(`Excluir ${ids.length} lead(s) DEFINITIVAMENTE?\n\nRemove o negócio, o histórico e as empresas/contatos que não tiverem outros negócios. Esta ação NÃO pode ser desfeita.`)) return;
    setDeleting(true);
    const orgIds = [...new Set(deals.filter(d => ids.includes(d.id)).map(d => d.organization_id).filter(Boolean))];
    const { error } = await supabase.from('crm_deals').delete().in('id', ids);
    if (error) { setDeleting(false); alert('Erro ao excluir: ' + error.message); return; }
    // remove empresas órfãs (sem outros negócios) + seus contatos
    if (orgIds.length) {
      const { data: still } = await supabase.from('crm_deals').select('organization_id').in('organization_id', orgIds);
      const stillSet = new Set((still || []).map((d: any) => d.organization_id));
      const orphan = orgIds.filter(o => !stillSet.has(o));
      if (orphan.length) {
        await supabase.from('crm_contacts').delete().in('organization_id', orphan);
        await supabase.from('crm_organizations').delete().in('id', orphan);
      }
    }
    setDeleting(false);
    log('CRM', `${ids.length} lead(s) excluídos em massa`);
    setDeals(prev => prev.filter(d => !ids.includes(d.id)));
    setSelected(new Set());
    onMutated();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-amber-600 font-bold uppercase animate-pulse">Carregando carteira...</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1"><ChevronLeft size={14} /> Voltar ao funil</button>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-2"><Users size={22} className="text-amber-600" /> Carteira de Leads</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Filtre por responsável e transfira os leads selecionados</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Responsável</label>
            <select value={ownerFilter} onChange={e => { setOwnerFilter(e.target.value); setSelected(new Set()); }} className="p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white">
              <option value="all">Todos</option>
              <option value="none">Sem responsável</option>
              {crmUsers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</label>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setSelected(new Set()); }} className="p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white">
              <option value="open">Abertos</option>
              <option value="won">Ganhos</option>
              <option value="lost">Perdidos</option>
              <option value="all">Todos</option>
            </select>
          </div>
          <p className="text-[11px] text-slate-400 font-bold ml-auto self-center">{filtered.length} lead(s)</p>
        </div>
      </div>

      {/* Barra de transferência (aparece quando há seleção) */}
      {selected.size > 0 && (
        <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg flex flex-wrap items-center gap-3 sticky top-2 z-10">
          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">{[...selected].filter(id => filtered.some(d => d.id === id)).length} selecionado(s)</span>
          <ArrowRight size={16} className="text-slate-500" />
          <select value={targetOwner} onChange={e => setTargetOwner(e.target.value)} className="p-2 rounded-lg text-sm font-bold text-slate-800 outline-none bg-white not-italic">
            <option value="">Transferir para...</option>
            {crmUsers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button disabled={transferring || !targetOwner} onClick={transfer} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50">
            <ArrowRight size={14} /> {transferring ? 'Transferindo...' : 'Transferir'}
          </button>
          <button disabled={deleting} onClick={removeLeads} title="Excluir os leads selecionados" className="px-5 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50">
            <Trash2 size={14} /> {deleting ? 'Excluindo...' : 'Excluir'}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-[10px] font-bold uppercase tracking-wide text-slate-400 hover:text-white ml-auto">Limpar</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[640px]">
          <thead className="bg-slate-900 text-[10px] font-bold uppercase text-amber-500 tracking-widest">
            <tr>
              <th className="px-4 py-3 w-10"><input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 accent-amber-600 align-middle" /></th>
              <th className="px-4 py-3">Empresa / Negócio</th>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(d => (
              <tr key={d.id} className={`hover:bg-slate-50 transition-all ${selected.has(d.id) ? 'bg-amber-50/50' : ''}`}>
                <td className="px-4 py-3"><input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleOne(d.id)} className="w-4 h-4 accent-amber-600 align-middle" /></td>
                <td className="px-4 py-3"><button onClick={() => onOpenDeal(d.id)} className="font-bold text-slate-800 italic hover:text-amber-600 text-left transition-colors">{d.title}</button></td>
                <td className="px-4 py-3 text-[11px] text-slate-500 uppercase tracking-wide">{stagesMap.get(d.stage_id) || '—'}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600 text-[13px]">{BRL(d.value)}</td>
                <td className="px-4 py-3 text-[11px] font-bold text-slate-600">{nameOf(d.owner_member_id)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${d.status === 'won' ? 'bg-emerald-100 text-emerald-700' : d.status === 'lost' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[d.status] || d.status}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400 italic">Nenhum lead para este filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
