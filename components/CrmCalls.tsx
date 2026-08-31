import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChevronLeft, Phone, PhoneCall, Clock, Timer } from 'lucide-react';

type Props = {
  cid: string;
  currentUser: any;
  members: any[];
  onBack: () => void;
};

const fmtDur = (secs: number) => {
  const s = Math.max(0, Math.round(secs || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m${String(ss).padStart(2, '0')}s`;
};

export const CrmCalls: React.FC<Props> = ({ cid, currentUser, members, onBack }) => {
  const crmUsers = members.filter((m: any) => ['SuperAdmin', 'Administrador', 'Comercial'].includes(m.role));
  const nameOf = (id: string | null) => !id ? 'Sem responsável' : (crmUsers.find((m: any) => m.id === id)?.name || (id === currentUser?.id ? currentUser?.name : '—'));

  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<any[]>([]);
  const [period, setPeriod] = useState('month');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('crm_activities')
      .select('owner_member_id, call_seconds, call_answered, call_direction, due_at, created_at')
      .eq('client_id', cid).eq('type', 'call').limit(20000);
    setCalls(data || []);
    setLoading(false);
  }, [cid]);
  useEffect(() => { load(); }, [load]);

  const now = new Date();
  let start: Date | null = null;
  if (period === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (period === '30d') start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  else if (period === 'year') start = new Date(now.getFullYear(), 0, 1);
  const inPeriod = (iso: string) => !start || (!!iso && new Date(iso) >= start);

  // usa a data da ligação: due_at (GoTo) ou, na falta, created_at (webfone/manual)
  const rows = calls.filter(c => inPeriod(c.due_at || c.created_at));
  const answered = rows.filter(c => c.call_answered);
  const talkSecs = answered.reduce((s, c) => s + (Number(c.call_seconds) || 0), 0);
  const avgSecs = answered.length ? talkSecs / answered.length : 0;
  const answerRate = rows.length ? Math.round((answered.length / rows.length) * 100) : null;

  // agregação por responsável do negócio
  const byUser = (() => {
    const m = new Map<string, { total: number; ans: number; secs: number }>();
    for (const c of rows) {
      const k = c.owner_member_id || '__none__';
      const cur = m.get(k) || { total: 0, ans: 0, secs: 0 };
      cur.total++;
      if (c.call_answered) { cur.ans++; cur.secs += Number(c.call_seconds) || 0; }
      m.set(k, cur);
    }
    return [...m.entries()].map(([id, v]) => ({
      id: id === '__none__' ? null : id,
      name: nameOf(id === '__none__' ? null : id),
      total: v.total, ans: v.ans, secs: v.secs,
      avg: v.ans ? v.secs / v.ans : 0,
      rate: v.total ? Math.round((v.ans / v.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);
  })();
  const maxTotal = byUser.reduce((mx, u) => Math.max(mx, u.total), 0);

  const PERIODS: [string, string][] = [['month', 'Este mês'], ['30d', 'Últimos 30 dias'], ['year', 'Este ano'], ['all', 'Tudo']];

  if (loading) return <div className="flex items-center justify-center h-64 text-amber-600 font-bold uppercase animate-pulse">Carregando ligações...</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1"><ChevronLeft size={14} /> Voltar ao funil</button>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-2"><Phone size={22} className="text-amber-600" /> Painel de Ligações</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Volume, atendimento e duração — por responsável do negócio</p>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Período</label>
          <select value={period} onChange={e => setPeriod(e.target.value)} className="p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white">
            {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600"><Phone size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Ligações</span></div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{rows.length}</p>
          <p className="text-[11px] text-slate-400 font-bold">no período</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600"><PhoneCall size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Atendidas</span></div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{answered.length}</p>
          <p className="text-[11px] text-slate-400 font-bold">{answerRate === null ? '—' : `${answerRate}% de atendimento`}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-sky-600"><Timer size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Duração média</span></div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{fmtDur(avgSecs)}</p>
          <p className="text-[11px] text-slate-400 font-bold">por ligação atendida</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500"><Clock size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Tempo total</span></div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{fmtDur(talkSecs)}</p>
          <p className="text-[11px] text-slate-400 font-bold">falado (atendidas)</p>
        </div>
      </div>

      {/* Por responsável */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-[11px] font-bold uppercase text-slate-600 tracking-widest">Por responsável</h3>
        </div>
        {byUser.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400 italic">Nenhuma ligação neste período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[9px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  <th className="text-left px-5 py-2.5">Responsável</th>
                  <th className="text-left px-3 py-2.5 min-w-[180px]">Ligações</th>
                  <th className="text-right px-3 py-2.5">Atendidas</th>
                  <th className="text-right px-3 py-2.5">Atend.</th>
                  <th className="text-right px-3 py-2.5">Duração média</th>
                  <th className="text-right px-5 py-2.5">Tempo total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {byUser.map(u => (
                  <tr key={u.id || 'none'} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-bold text-slate-700 italic">{u.name}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden min-w-[80px]">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${maxTotal ? Math.max((u.total / maxTotal) * 100, 6) : 0}%` }} />
                        </div>
                        <span className="text-[13px] font-bold text-slate-700 w-8 text-right">{u.total}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-600">{u.ans}</td>
                    <td className="px-3 py-3 text-right text-slate-500 font-bold">{u.rate}%</td>
                    <td className="px-3 py-3 text-right text-slate-600 font-bold">{fmtDur(u.avg)}</td>
                    <td className="px-5 py-3 text-right text-slate-600 font-bold">{fmtDur(u.secs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 italic px-1">
        Ligações pelo <b>webfone (Telnyx)</b> são atribuídas ao <b>usuário que discou</b>. Já as ligações antigas via <b>GoTo</b> passam por um tronco compartilhado, então são atribuídas pelo <b>responsável do negócio</b> (as que caem em "Sem responsável" são de negócios sem proprietário). Duração média e tempo total consideram apenas as <b>atendidas</b>.
      </p>
    </div>
  );
};
