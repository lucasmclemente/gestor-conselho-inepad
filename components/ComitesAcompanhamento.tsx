import React, { useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Users, Mail, AlertCircle, GitBranch, RefreshCw, CheckCircle2, Clock } from 'lucide-react';

// Comitês Fase 2 — ACOMPANHAMENTO (somente leitura) dos planos de ação dos comitês,
// visto pelo Conselho (supervisores + Conselheiros). Nada de editar: só acompanhar e
// COBRAR por e-mail (Edge Function cobrar-acoes-comite). Os dados vêm da RPC
// comites_acoes() (apenas campos de ação — nunca atas/deliberações).

const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
const isValidDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const isOverdue = (a: any) => a.status !== 'Concluída' && isValidDate(a.due_date) && a.due_date < todayStr();
const fmtBR = (d: string) => isValidDate(d) ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : 'S/D';

const STATUS_CHIP = (s: string) => s === 'Concluída' ? 'bg-emerald-100 text-emerald-700'
  : s === 'Em andamento' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500';
const PRIO_CHIP: Record<string, string> = {
  'Urgente': 'bg-red-50 text-red-700 border-red-200',
  'Importante': 'bg-amber-50 text-amber-700 border-amber-200',
  'Média': 'bg-slate-50 text-slate-500 border-slate-200',
};

export const ComitesAcompanhamento: React.FC<{
  acoes: any[];
  loading: boolean;
  currentUser: any;
  statusFilter: string;                 // 'all' | 'abertas' | 'atrasadas' | 'concluidas'
  onStatusFilter: (s: string) => void;
  onRefetch: () => void;
}> = ({ acoes, loading, currentUser, statusFilter, onStatusFilter, onRefetch }) => {
  const [comiteFilter, setComiteFilter] = useState('all');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const comites = useMemo(() => {
    const seen = new Map<string, string>();
    (acoes || []).forEach((a: any) => { if (!seen.has(a.comite_id)) seen.set(a.comite_id, a.comite_nome); });
    return [...seen.entries()].map(([id, nome]) => ({ id, nome }));
  }, [acoes]);

  const filtered = useMemo(() => {
    return (acoes || []).filter((a: any) => {
      if (comiteFilter !== 'all' && a.comite_id !== comiteFilter) return false;
      if (statusFilter === 'atrasadas') return isOverdue(a);
      if (statusFilter === 'abertas') return a.status !== 'Concluída';
      if (statusFilter === 'concluidas') return a.status === 'Concluída';
      return true;
    });
  }, [acoes, comiteFilter, statusFilter]);

  // Agrupa por comitê, ordenando por prioridade/prazo
  const grouped = useMemo(() => {
    const g = new Map<string, { nome: string; rows: any[] }>();
    filtered.forEach((a: any) => {
      if (!g.has(a.comite_id)) g.set(a.comite_id, { nome: a.comite_nome, rows: [] });
      g.get(a.comite_id)!.rows.push(a);
    });
    const W: Record<string, number> = { 'Urgente': 0, 'Importante': 1, 'Média': 2 };
    g.forEach((v) => v.rows.sort((a, b) => (W[a.priority] ?? 2) - (W[b.priority] ?? 2) || (a.due_date || '9999').localeCompare(b.due_date || '9999')));
    return [...g.entries()].map(([id, v]) => ({ id, ...v }));
  }, [filtered]);

  const overdueCount = useMemo(() => (acoes || []).filter(isOverdue).length, [acoes]);

  const cobrar = async (items: any[], label: string) => {
    const withResp = items.filter((it) => Array.isArray(it._resps) && it._resps.length > 0 && it._status !== 'Concluída');
    if (withResp.length === 0) { alert('Nenhuma dessas ações tem responsável cadastrado para cobrar.'); return; }
    if (!confirm(`Enviar cobrança por e-mail ${label}?\n\nUm e-mail será enviado a cada responsável com as ações pendentes dele.`)) return;
    setBusyKey(items.length === 1 ? items[0].actionId : '__bulk__');
    try {
      const payload = withResp.map((it) => ({ meetingId: it.meetingId, actionId: it.actionId, comiteNome: it.comiteNome }));
      const { data, error } = await supabase.functions.invoke('cobrar-acoes-comite', { body: { items: payload, appOrigin: window.location.origin } });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error);
      const d = data as any;
      alert(d.people > 0 ? `Cobrança enviada a ${d.people} responsável(is) (${d.sent} e-mail(s)).` : 'Nenhum responsável com e-mail cadastrado para cobrar.');
    } catch (e: any) {
      alert('Erro ao cobrar: ' + (e?.message || e));
    } finally { setBusyKey(null); }
  };

  const toItem = (a: any) => ({ meetingId: a.meeting_id, actionId: a.action_id, comiteNome: a.comite_nome, _resps: a.resps || [], _status: a.status });

  const FILTERS: [string, string][] = [['all', 'Todas'], ['abertas', 'Em aberto'], ['atrasadas', 'Atrasadas'], ['concluidas', 'Concluídas']];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Acompanhamento dos Comitês</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Planos de ação dos comitês — o Conselho acompanha e cobra (somente leitura)</p>
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <button onClick={() => cobrar((statusFilter === 'atrasadas' ? filtered : (acoes || []).filter(isOverdue)).map(toItem), 'de todas as ações atrasadas')} disabled={busyKey === '__bulk__'} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg font-bold text-[11px] uppercase tracking-widest flex items-center gap-1.5">
              <Mail size={14} /> {busyKey === '__bulk__' ? 'Enviando…' : `Cobrar atrasadas (${overdueCount})`}
            </button>
          )}
          <button onClick={onRefetch} title="Atualizar" className="p-2 text-slate-400 hover:text-amber-600 border border-slate-200 rounded-lg"><RefreshCw size={16} /></button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map(([k, label]) => (
            <button key={k} onClick={() => onStatusFilter(k)} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${statusFilter === k ? 'bg-slate-900 text-amber-500 border-slate-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{label}</button>
          ))}
        </div>
        {comites.length > 1 && (
          <select value={comiteFilter} onChange={e => setComiteFilter(e.target.value)} className="text-xs font-bold text-slate-600 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 ml-auto">
            <option value="all">Todos os comitês</option>
            {comites.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center text-sm text-slate-400 italic">Carregando…</div>
      ) : grouped.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 shadow-sm text-center text-sm text-slate-400 italic">
          {(acoes || []).length === 0 ? 'Nenhuma ação registrada nos comitês ainda.' : 'Nenhuma ação neste filtro.'}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-900 px-5 py-3 border-b-4 border-amber-600 flex items-center gap-2">
                <Users size={15} className="text-amber-500 shrink-0" />
                <h3 className="text-white text-sm font-bold italic truncate">{g.nome}</h3>
                <span className="text-[9px] font-bold text-amber-400/80 bg-slate-800 rounded-full px-2 py-0.5 ml-auto shrink-0">{g.rows.length} {g.rows.length === 1 ? 'ação' : 'ações'}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {g.rows.map((a: any) => {
                  const over = isOverdue(a);
                  const resps: string[] = a.resps || [];
                  const canCobrar = a.status !== 'Concluída' && resps.length > 0;
                  return (
                    <div key={a.action_id} className="px-5 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_CHIP(a.status)}`}>{a.status}</span>
                      <span className={`flex-1 min-w-[180px] text-sm ${a.status === 'Concluída' ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>{a.title}</span>
                      {a.priority && a.priority !== 'Média' && <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${PRIO_CHIP[a.priority] || PRIO_CHIP['Média']}`}>{a.priority}</span>}
                      {a.subtasks_total > 0 && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 shrink-0" title="Subtarefas concluídas"><GitBranch size={11} />{a.subtasks_done}/{a.subtasks_total}</span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                        {a.status === 'Concluída' ? <CheckCircle2 size={12} className="text-emerald-500" /> : over ? <AlertCircle size={12} className="text-red-500" /> : <Clock size={12} className="text-slate-400" />}
                        <span className={over ? 'text-red-600 font-bold' : ''}>{fmtBR(a.due_date)}{over ? ' · atrasada' : ''}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0 max-w-[200px] truncate" title={resps.join(', ')}>{resps.length > 0 ? resps.join(', ') : 'Sem responsável'}</span>
                      {canCobrar && (
                        <button onClick={() => cobrar([toItem(a)], 'ao(s) responsável(is) desta ação')} disabled={busyKey === a.action_id} className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-40" title="Enviar cobrança por e-mail">
                          <Mail size={11} /> {busyKey === a.action_id ? '…' : 'Cobrar'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
