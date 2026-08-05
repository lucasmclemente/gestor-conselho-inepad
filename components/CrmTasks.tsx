import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChevronLeft, CheckSquare, AlertTriangle, Clock, Check } from 'lucide-react';

type Props = {
  cid: string;
  currentUser: any;
  members: any[];
  onBack: () => void;
  onOpenDeal: (id: string) => void;
};

const ACT_LABEL: Record<string, string> = { call: 'Ligação', meeting: 'Reunião', email: 'E-mail', whatsapp: 'WhatsApp', task: 'Tarefa', note: 'Nota' };
const fmtDateTime = (s: string) => { try { return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return ''; } };

export const CrmTasks: React.FC<Props> = ({ cid, currentUser, members, onBack, onOpenDeal }) => {
  const crmUsers = members.filter((m: any) => ['SuperAdmin', 'Administrador', 'Comercial'].includes(m.role));
  const nameOf = (id: string | null) => !id ? 'Sem responsável' : (crmUsers.find((m: any) => m.id === id)?.name || (id === currentUser?.id ? currentUser?.name : '—'));

  const [loading, setLoading] = useState(true);
  const [openTasks, setOpenTasks] = useState<any[]>([]);
  const [doneTasks, setDoneTasks] = useState<any[]>([]);
  const [period, setPeriod] = useState('month');
  const [ownerFilter, setOwnerFilter] = useState('all');

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTomorrow = new Date(startToday.getTime() + 24 * 3600 * 1000);
  let pStart: Date | null = null;
  if (period === 'month') pStart = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (period === '30d') pStart = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  else if (period === 'year') pStart = new Date(now.getFullYear(), 0, 1);

  const load = useCallback(async () => {
    setLoading(true);
    const [open, done] = await Promise.all([
      supabase.from('crm_activities').select('id, deal_id, type, title, due_at, owner_member_id, deal:crm_deals(title)').eq('client_id', cid).eq('done', false).not('due_at', 'is', null).limit(5000),
      supabase.from('crm_activities').select('id, owner_member_id, done_at').eq('client_id', cid).eq('done', true).not('due_at', 'is', null).limit(20000),
    ]);
    setOpenTasks(open.data || []);
    setDoneTasks(done.data || []);
    setLoading(false);
  }, [cid]);
  useEffect(() => { load(); }, [load]);

  const isOverdue = (iso: string) => !!iso && new Date(iso) < startToday;
  const isToday = (iso: string) => !!iso && new Date(iso) >= startToday && new Date(iso) < startTomorrow;
  const donePeriod = doneTasks.filter(t => !pStart || (t.done_at && new Date(t.done_at) >= pStart));

  const overdue = openTasks.filter(t => isOverdue(t.due_at)).sort((a, b) => (a.due_at < b.due_at ? -1 : 1));
  const today = openTasks.filter(t => isToday(t.due_at));

  const ownerOk = (t: any) => ownerFilter === 'all' ? true : ownerFilter === 'none' ? !t.owner_member_id : t.owner_member_id === ownerFilter;
  const pending = openTasks.filter(ownerOk).sort((a, b) => (a.due_at < b.due_at ? -1 : 1));

  const byUser = (() => {
    const m = new Map<string, { open: number; overdue: number; today: number; done: number }>();
    const ensure = (k: string) => m.get(k) || { open: 0, overdue: 0, today: 0, done: 0 };
    for (const t of openTasks) { const k = t.owner_member_id || '__none__'; const c = ensure(k); c.open++; if (isOverdue(t.due_at)) c.overdue++; if (isToday(t.due_at)) c.today++; m.set(k, c); }
    for (const t of donePeriod) { const k = t.owner_member_id || '__none__'; const c = ensure(k); c.done++; m.set(k, c); }
    return [...m.entries()].map(([id, v]) => ({ id: id === '__none__' ? null : id, name: nameOf(id === '__none__' ? null : id), ...v }))
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open);
  })();

  const PERIODS: [string, string][] = [['month', 'Este mês'], ['30d', 'Últimos 30 dias'], ['year', 'Este ano'], ['all', 'Tudo']];

  if (loading) return <div className="flex items-center justify-center h-64 text-amber-600 font-bold uppercase animate-pulse">Carregando tarefas...</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1"><ChevronLeft size={14} /> Voltar ao funil</button>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-2"><CheckSquare size={22} className="text-amber-600" /> Tarefas da Equipe</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Acompanhamento por responsável</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {crmUsers.length > 1 && (
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Responsável</label>
              <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white">
                <option value="all">Todos</option>
                <option value="none">Sem responsável</option>
                {crmUsers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Concluídas em</label>
            <select value={period} onChange={e => setPeriod(e.target.value)} className="p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white">
              {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500"><CheckSquare size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Em aberto</span></div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{openTasks.length}</p>
          <p className="text-[11px] text-slate-400 font-bold">a fazer</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-red-500"><AlertTriangle size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Atrasadas</span></div>
          <p className="text-2xl font-bold text-red-600 mt-2">{overdue.length}</p>
          <p className="text-[11px] text-slate-400 font-bold">venceram</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600"><Clock size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Vencem hoje</span></div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{today.length}</p>
          <p className="text-[11px] text-slate-400 font-bold">para hoje</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600"><Check size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Concluídas</span></div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{donePeriod.length}</p>
          <p className="text-[11px] text-slate-400 font-bold">no período</p>
        </div>
      </div>

      {/* Por responsável */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100"><h3 className="text-[11px] font-bold uppercase text-slate-600 tracking-widest">Por responsável</h3></div>
        {byUser.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400 italic">Nenhuma tarefa.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[9px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  <th className="text-left px-5 py-2.5">Responsável</th>
                  <th className="text-right px-3 py-2.5">Em aberto</th>
                  <th className="text-right px-3 py-2.5">Atrasadas</th>
                  <th className="text-right px-3 py-2.5">Vencem hoje</th>
                  <th className="text-right px-5 py-2.5">Concluídas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {byUser.map(u => (
                  <tr key={u.id || 'none'} onClick={() => setOwnerFilter(u.id || 'none')} title="Ver tarefas pendentes deste responsável"
                    className={`hover:bg-amber-50 transition-colors cursor-pointer ${(ownerFilter === (u.id || 'none')) ? 'bg-amber-50' : ''}`}>
                    <td className="px-5 py-3 font-bold text-slate-700 italic">{u.name}</td>
                    <td className="px-3 py-3 text-right font-bold text-slate-700">{u.open}</td>
                    <td className={`px-3 py-3 text-right font-bold ${u.overdue ? 'text-red-600' : 'text-slate-300'}`}>{u.overdue}</td>
                    <td className="px-3 py-3 text-right font-bold text-amber-600">{u.today}</td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-600">{u.done}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tarefas pendentes (filtradas por responsável) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase text-slate-600 tracking-widest flex items-center gap-1.5">
            <CheckSquare size={13} className="text-amber-600" /> Tarefas pendentes{ownerFilter !== 'all' ? ` — ${ownerFilter === 'none' ? 'Sem responsável' : nameOf(ownerFilter)}` : ''}
          </h3>
          <span className="text-[11px] font-bold text-slate-400">{pending.length}</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
          {pending.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-400 italic">Nenhuma tarefa pendente.</p>}
          {pending.map(t => {
            const late = isOverdue(t.due_at);
            return (
              <button key={t.id} onClick={() => t.deal_id && onOpenDeal(t.deal_id)} className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-all text-left">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 italic truncate">{t.title || ACT_LABEL[t.type] || 'Tarefa'}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide truncate">
                    {ACT_LABEL[t.type] || t.type}{t.deal?.title ? ` • ${t.deal.title}` : ''}{ownerFilter === 'all' ? ` • ${nameOf(t.owner_member_id)}` : ''}
                  </p>
                </div>
                <span className={`text-[11px] font-bold shrink-0 ${late ? 'text-red-500' : 'text-slate-500'}`}>{late ? '⚠ ' : ''}{fmtDateTime(t.due_at)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
