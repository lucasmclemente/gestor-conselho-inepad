import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChevronLeft, Phone, PhoneCall, Clock, Timer, PhoneIncoming, Percent } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, PieChart, Pie, Cell,
} from 'recharts';

type Props = { cid: string; currentUser: any; members: any[]; onBack: () => void };

const fmtDur = (secs: number) => {
  const s = Math.max(0, Math.round(secs || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m${String(ss).padStart(2, '0')}s`;
};
const digits = (s: string) => (s || '').replace(/\D/g, '');
const numKey = (s: string) => { const d = digits(s); return d.length >= 8 ? d.slice(-8) : d; };
const median = (arr: number[]) => { if (!arr.length) return 0; const a = [...arr].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2); };
const pct = (n: number, d: number) => d ? Math.round((n / d) * 100) : 0;

// classifica a causa do encerramento em categorias de negócio
const outcomeOf = (r: any): string => {
  if (r.call_answered) return 'Atendida';
  const c = String(r.call_cause || '').toLowerCase();
  if (/busy|486|ocupa/.test(c)) return 'Recusada / ocupado';
  if (/reject|603|decline|recus/.test(c)) return 'Recusada / ocupado';
  if (/invalid|404|484|603|not.?found|inexist|número|numero/.test(c)) return 'Número inválido';
  if (/no.?answer|408|480|timeout/.test(c)) return 'Não atendida';
  if (/cancel|originator|agent|normal_clearing|bye|16/.test(c)) return 'Desistência do agente';
  return 'Não atendida';
};
const OUT_COLORS: Record<string, string> = {
  'Atendida': '#059669', 'Desistência do agente': '#38bdf8', 'Recusada / ocupado': '#f59e0b',
  'Número inválido': '#ef4444', 'Não atendida': '#94a3b8',
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
      .select('owner_member_id, call_seconds, call_answered, call_direction, call_number, call_cause, due_at, created_at, recording_id, deal_id')
      .eq('client_id', cid).eq('type', 'call').limit(50000);
    setCalls(data || []);
    setLoading(false);
  }, [cid]);
  useEffect(() => { load(); }, [load]);

  const M = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    if (period === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === '30d') start = new Date(now.getTime() - 30 * 864e5);
    else if (period === 'year') start = new Date(now.getFullYear(), 0, 1);
    const timeOf = (r: any) => new Date(r.due_at || r.created_at);
    const inPer = (r: any) => { const t = r.due_at || r.created_at; return !start || (!!t && new Date(t) >= start!); };

    const rows = calls.filter(inPer);
    const outRows = rows.filter(r => r.call_direction !== 'in');   // discagens (saída)
    const inRows = rows.filter(r => r.call_direction === 'in');    // recebidas
    const answered = outRows.filter(r => r.call_answered);
    const talkSecs = answered.reduce((s, r) => s + (Number(r.call_seconds) || 0), 0);

    // KPIs
    const kpi = { dials: outRows.length, answered: answered.length, rate: pct(answered.length, outRows.length), talkMin: Math.round(talkSecs / 60), received: inRows.length };

    // Evolução diária
    const byDay = new Map<string, { dials: number; ans: number }>();
    for (const r of outRows) { const d = timeOf(r); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; const c = byDay.get(k) || { dials: 0, ans: 0 }; c.dials++; if (r.call_answered) c.ans++; byDay.set(k, c); }
    const daily = [...byDay.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).slice(-30).map(([k, v]) => ({ dia: k.slice(5), Discagens: v.dials, Taxa: pct(v.ans, v.dials) }));

    // Ranking de agentes
    const byAgent = new Map<string, any>();
    const ag = (id: string) => { const k = id || '__none__'; if (!byAgent.has(k)) byAgent.set(k, { id: id || null, dials: 0, ans: 0, recv: 0, secs: 0, ansSecs: [] as number[], nums: new Set<string>(), withRec: 0, withDeal: 0, days: new Set<string>() }); return byAgent.get(k); };
    for (const r of outRows) { const a = ag(r.owner_member_id); a.dials++; if (r.call_number) a.nums.add(numKey(r.call_number)); if (r.deal_id) a.withDeal++; const d = timeOf(r); a.days.add(`${d.getMonth()}-${d.getDate()}`); if (r.call_answered) { a.ans++; const s = Number(r.call_seconds) || 0; a.secs += s; a.ansSecs.push(s); if (r.recording_id) a.withRec++; } }
    for (const r of inRows) { const a = ag(r.owner_member_id); a.recv++; }
    const agents = [...byAgent.values()].map(a => {
      const dias = a.days.size || 1;
      return {
        id: a.id, name: nameOf(a.id), dials: a.dials, unique: a.nums.size, ans: a.ans, recv: a.recv,
        rate: pct(a.ans, a.dials), talkMin: Math.round(a.secs / 60), tma: a.ans ? Math.round(a.secs / a.ans) : 0,
        med: median(a.ansSecs), max: a.ansSecs.length ? Math.max(...a.ansSecs) : 0,
        conv60: a.ansSecs.filter((s: number) => s >= 60).length, recPct: pct(a.withRec, a.ans), dealPct: pct(a.withDeal, a.dials),
        days: a.days.size, talkPerDay: Math.round(a.secs / 60 / dias), dialsPerDay: Math.round(a.dials / dias),
      };
    }).sort((x, y) => y.dials - x.dials);

    // Perfil de duração
    const buckets = [
      { faixa: 'Não atendida', n: outRows.filter(r => !r.call_answered).length },
      { faixa: 'até 30s', n: answered.filter(r => (r.call_seconds || 0) <= 30).length },
      { faixa: '30 a 60s', n: answered.filter(r => (r.call_seconds || 0) > 30 && (r.call_seconds || 0) <= 60).length },
      { faixa: '1 a 3min', n: answered.filter(r => (r.call_seconds || 0) > 60 && (r.call_seconds || 0) <= 180).length },
      { faixa: '3 a 5min', n: answered.filter(r => (r.call_seconds || 0) > 180 && (r.call_seconds || 0) <= 300).length },
      { faixa: 'acima de 5min', n: answered.filter(r => (r.call_seconds || 0) > 300).length },
    ];

    // Melhor hora para ligar (hora × dia-da-semana)
    const wd = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
    const hours = Array.from({ length: 11 }, (_, i) => 8 + i); // 8..18
    const cell = new Map<string, { d: number; a: number }>();
    for (const r of outRows) { const dt = timeOf(r); const day = dt.getDay(); if (day < 1 || day > 5) continue; const k = `${dt.getHours()}|${day}`; const c = cell.get(k) || { d: 0, a: 0 }; c.d++; if (r.call_answered) c.a++; cell.set(k, c); }
    const heat = hours.map(h => ({ h, cells: wd.map((_, i) => { const c = cell.get(`${h}|${i + 1}`); return c && c.d ? { rate: pct(c.a, c.d), d: c.d } : null; }) }));

    // Vale insistir? (taxa por tentativa)
    const byNum = new Map<string, any[]>();
    for (const r of outRows) { if (!r.call_number) continue; const k = numKey(r.call_number); if (!byNum.has(k)) byNum.set(k, []); byNum.get(k)!.push(r); }
    const attempt = Array.from({ length: 6 }, () => ({ d: 0, a: 0 }));
    for (const list of byNum.values()) { list.sort((a, b) => new Date(a.due_at || a.created_at).getTime() - new Date(b.due_at || b.created_at).getTime()); list.forEach((r, i) => { const idx = Math.min(i, 5); attempt[idx].d++; if (r.call_answered) attempt[idx].a++; }); }
    const insist = attempt.map((v, i) => ({ tentativa: i === 5 ? '6+' : String(i + 1), Taxa: pct(v.a, v.d), n: v.d }));

    // Onde a discagem morre
    const outc = new Map<string, number>();
    for (const r of outRows) { const o = outcomeOf(r); outc.set(o, (outc.get(o) || 0) + 1); }
    const deaths = [...outc.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return { kpi, daily, agents, buckets, heat, wd, insist, deaths, hasData: rows.length > 0 };
  }, [calls, period]); // eslint-disable-line react-hooks/exhaustive-deps

  const Card: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <div className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm ${className || ''}`}>
      <h3 className="text-[11px] font-bold uppercase text-slate-500 tracking-widest mb-3">{title}</h3>
      {children}
    </div>
  );
  const heatColor = (rate: number) => { const t = Math.max(0, Math.min(1, rate / 100)); const l = Math.round(92 - t * 55); return `hsl(45 90% ${l}%)`; };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1 mb-2"><ChevronLeft size={14} /> Voltar ao funil</button>
          <h2 className="text-2xl font-bold text-slate-800 italic flex items-center gap-2"><PhoneCall size={22} className="text-amber-600" /> Ligações e Chamadas</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Discagens do time · taxa de conexão · talk time — pelo webfone do Boardplan</p>
        </div>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white">
          <option value="month">Este mês</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="year">Este ano</option>
          <option value="all">Tudo</option>
        </select>
      </div>

      {loading ? <div className="h-64 flex items-center justify-center text-amber-600 font-bold uppercase animate-pulse">Carregando painel...</div> : !M.hasData ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center text-sm text-slate-400 italic">Nenhuma ligação registrada no período. O painel enche conforme a equipe liga pelo webfone.</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { ic: <Phone size={16} className="text-amber-600" />, label: 'Discagens do time', val: M.kpi.dials, sub: 'no período' },
              { ic: <Percent size={16} className="text-sky-600" />, label: 'Taxa de conexão', val: `${M.kpi.rate}%`, sub: `${M.kpi.answered} atendidas` },
              { ic: <Clock size={16} className="text-emerald-600" />, label: 'Talk time total', val: `${M.kpi.talkMin} min`, sub: 'falado (atendidas)' },
              { ic: <PhoneIncoming size={16} className="text-indigo-600" />, label: 'Recebidas', val: M.kpi.received, sub: 'ligações de entrada' },
            ].map((k, i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{k.ic} {k.label}</div>
                <p className="text-3xl font-bold text-slate-800 mt-2">{k.val}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Evolução diária */}
          <Card title="Evolução diária (discagens e taxa de conexão %)">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={M.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar yAxisId="l" dataKey="Discagens" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="Taxa" stroke="#d97706" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Ranking de agentes */}
            <Card title="Ranking de agentes (discagens)">
              <ResponsiveContainer width="100%" height={Math.max(180, M.agents.length * 42)}>
                <BarChart data={M.agents} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="dials" name="Discagens" fill="#38bdf8" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Onde a discagem morre */}
            <Card title="Onde a discagem morre">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={M.deaths} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {M.deaths.map((d, i) => <Cell key={i} fill={OUT_COLORS[d.name] || '#cbd5e1'} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {M.deaths.map((d, i) => <span key={i} className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: OUT_COLORS[d.name] || '#cbd5e1' }} /> {d.name} ({d.value})</span>)}
              </div>
            </Card>

            {/* Perfil de duração */}
            <Card title="Perfil de duração">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={M.buckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="faixa" tick={{ fontSize: 9 }} interval={0} angle={-12} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="n" name="Chamadas" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Vale insistir? */}
            <Card title="Vale insistir? (taxa de conexão por tentativa)">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={M.insist}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="tentativa" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any, _n: any, p: any) => [`${v}% (${p?.payload?.n} disc.)`, 'Taxa']} />
                  <Bar dataKey="Taxa" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Melhor hora para ligar */}
          <Card title="Melhor hora para ligar (taxa de conexão % — vazio = sem ligações)">
            <div className="overflow-x-auto">
              <table className="text-center text-[11px]">
                <thead><tr><th className="p-1"></th>{M.wd.map(d => <th key={d} className="p-1 font-bold text-slate-500 w-14">{d}</th>)}</tr></thead>
                <tbody>
                  {M.heat.map(row => (
                    <tr key={row.h}>
                      <td className="p-1 font-bold text-slate-400 pr-2">{String(row.h).padStart(2, '0')}h</td>
                      {row.cells.map((c, i) => (
                        <td key={i} className="p-0.5">
                          <div className="rounded h-7 flex items-center justify-center font-bold text-slate-700" style={{ backgroundColor: c ? heatColor(c.rate) : '#f8fafc' }} title={c ? `${c.d} discagens` : 'sem ligações'}>{c ? `${c.rate}` : ''}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Detalhe por agente */}
          <Card title="Detalhe por agente">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] whitespace-nowrap">
                <thead>
                  <tr className="text-[9px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    {['Agente', 'Discagens', 'Números únicos', 'Atendidas', 'Recebidas', 'Taxa conexão', 'Talk time', 'TMA', 'Mediana', 'Maior', '≥60s', '% gravação', '% vínculo CRM', 'Dias ativos', 'Talk/dia', 'Disc./dia'].map(h => <th key={h} className="text-right p-2 font-bold first:text-left">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {M.agents.map(a => (
                    <tr key={a.id || 'none'} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="text-left p-2 font-bold text-slate-700 italic">{a.name}</td>
                      <td className="text-right p-2">{a.dials}</td>
                      <td className="text-right p-2">{a.unique}</td>
                      <td className="text-right p-2 text-emerald-600 font-bold">{a.ans}</td>
                      <td className="text-right p-2">{a.recv}</td>
                      <td className="text-right p-2 font-bold">{a.rate}%</td>
                      <td className="text-right p-2">{a.talkMin} min</td>
                      <td className="text-right p-2">{fmtDur(a.tma)}</td>
                      <td className="text-right p-2">{fmtDur(a.med)}</td>
                      <td className="text-right p-2">{fmtDur(a.max)}</td>
                      <td className="text-right p-2">{a.conv60}</td>
                      <td className="text-right p-2">{a.recPct}%</td>
                      <td className="text-right p-2">{a.dealPct}%</td>
                      <td className="text-right p-2">{a.days}</td>
                      <td className="text-right p-2">{a.talkPerDay} min</td>
                      <td className="text-right p-2">{a.dialsPerDay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-[11px] text-slate-400 italic px-1">
            Reflete as ligações feitas/recebidas pelo <b>webfone do Boardplan</b> (as antigas do Bitrix não entram). "Discagens" conta as de saída; "Recebidas" as de entrada. Taxa de conexão = atendidas ÷ discagens. Painéis "Vale insistir?" e "Onde a discagem morre" usam o número discado e a causa do encerramento, capturados a partir de agora.
          </p>
        </>
      )}
    </div>
  );
};
