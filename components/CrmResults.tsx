import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChevronLeft, Trophy, Ban, TrendingUp, Layers } from 'lucide-react';

type Props = {
  cid: string;
  currentUser: any;
  members: any[];
  onBack: () => void;
  onOpenDeal: (id: string) => void;
};

const BRL = (n: any) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString('pt-BR'); } catch { return ''; } };

export const CrmResults: React.FC<Props> = ({ cid, currentUser, members, onBack, onOpenDeal }) => {
  const crmUsers = members.filter((m: any) => ['SuperAdmin', 'Administrador', 'Comercial'].includes(m.role));
  const nameOf = (id: string) => crmUsers.find((m: any) => m.id === id)?.name || (id === currentUser?.id ? currentUser?.name : '—');

  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<any[]>([]);
  const [period, setPeriod] = useState('month');
  const [ownerFilter, setOwnerFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('crm_deals').select('*').eq('client_id', cid);
    setDeals(data || []);
    setLoading(false);
  }, [cid]);
  useEffect(() => { load(); }, [load]);

  const now = new Date();
  let start: Date | null = null;
  if (period === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (period === '30d') start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  else if (period === 'year') start = new Date(now.getFullYear(), 0, 1);
  const inPeriod = (iso: string) => !start || (!!iso && new Date(iso) >= start);
  const ownerOk = (d: any) => ownerFilter === 'all' ? true : ownerFilter === 'none' ? !d.owner_member_id : d.owner_member_id === ownerFilter;

  const won = deals.filter(d => d.status === 'won' && ownerOk(d) && inPeriod(d.won_at));
  const lost = deals.filter(d => d.status === 'lost' && ownerOk(d) && inPeriod(d.lost_at));
  const open = deals.filter(d => d.status === 'open' && ownerOk(d));
  const sum = (arr: any[]) => arr.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const conv = (won.length + lost.length) ? Math.round((won.length / (won.length + lost.length)) * 100) : null;

  const lostReasons = (() => {
    const m = new Map<string, number>();
    lost.forEach(d => { const r = (d.lost_reason && String(d.lost_reason).trim()) || 'Sem motivo'; m.set(r, (m.get(r) || 0) + 1); });
    return [...m.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
  })();
  const maxLost = lostReasons.reduce((mx, r) => Math.max(mx, r.count), 0);

  const PERIODS: [string, string][] = [['month', 'Este mês'], ['30d', 'Últimos 30 dias'], ['year', 'Este ano'], ['all', 'Tudo']];

  if (loading) return <div className="flex items-center justify-center h-64 text-amber-600 font-bold uppercase animate-pulse">Carregando resultados...</div>;

  const List = ({ title, icon, color, items, dateField }: any) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase text-slate-600 tracking-widest flex items-center gap-1.5">{icon} {title}</h3>
        <span className={`text-[11px] font-bold ${color}`}>{items.length} • {BRL(sum(items))}</span>
      </div>
      <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
        {items.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-400 italic">Nada neste período.</p>}
        {items.map((d: any) => (
          <button key={d.id} onClick={() => onOpenDeal(d.id)} className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-all text-left">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 italic truncate">{d.title}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{nameOf(d.owner_member_id)}{d[dateField] ? ` • ${fmtDate(d[dateField])}` : ''}{d.status === 'lost' && d.lost_reason ? ` • ${d.lost_reason}` : ''}</p>
            </div>
            <span className={`text-[13px] font-bold shrink-0 ${color}`}>{BRL(d.value)}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1"><ChevronLeft size={14} /> Voltar ao funil</button>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-2"><TrendingUp size={22} className="text-amber-600" /> Resultados</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ganhos, perdidos e conversão</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Período</label>
            <select value={period} onChange={e => setPeriod(e.target.value)} className="p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white">
              {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {crmUsers.length > 1 && (
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Responsável</label>
              <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white">
                <option value="all">Todos</option>
                {crmUsers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600"><Trophy size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Ganhos</span></div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{BRL(sum(won))}</p>
          <p className="text-[11px] text-slate-400 font-bold">{won.length} negócio(s)</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-red-500"><Ban size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Perdidos</span></div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{BRL(sum(lost))}</p>
          <p className="text-[11px] text-slate-400 font-bold">{lost.length} negócio(s)</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600"><TrendingUp size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Conversão</span></div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{conv === null ? '—' : `${conv}%`}</p>
          <p className="text-[11px] text-slate-400 font-bold">ganhos ÷ fechados</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500"><Layers size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Em aberto</span></div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{BRL(sum(open))}</p>
          <p className="text-[11px] text-slate-400 font-bold">{open.length} no funil</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <List title="Ganhos" icon={<Trophy size={13} className="text-emerald-600" />} color="text-emerald-600" items={won} dateField="won_at" />
        <List title="Perdidos" icon={<Ban size={13} className="text-red-500" />} color="text-red-500" items={lost} dateField="lost_at" />
      </div>

      {lost.length > 0 && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><Ban size={13} className="text-red-500" /> Motivos de perda</h3>
          <div className="space-y-2">
            {lostReasons.map(r => (
              <div key={r.reason} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 w-32 sm:w-44 shrink-0 truncate" title={r.reason}>{r.reason}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full flex items-center justify-end px-2" style={{ width: `${maxLost ? Math.max((r.count / maxLost) * 100, 8) : 0}%` }}>
                    <span className="text-[10px] font-bold text-white">{r.count}</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 w-10 text-right shrink-0">{Math.round((r.count / lost.length) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
