import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  Activity, ChevronLeft, ChevronRight, Scale, FileCheck, AlertTriangle,
  CheckCircle2, Clock, Users, TrendingUp, Filter, FileText
} from 'lucide-react';

// Painel de Engajamento dos conselheiros — mede participação em VOTAÇÕES (deliberações)
// e APROVAÇÕES DE ATA a partir dos dados já existentes (meetings.deliberacoes / meetings.atas).
// Visível a Adm/Sec/Super. A secretaria usa a aba "Pendências" para cobrar quem está devendo.
// (Fase 2 acrescentará o rastreio de downloads de materiais.)

type Pend = { meetingTitle: string; label: string };
type Stat = {
  name: string; role: string;
  elVotes: number; voted: number; favor: number; contra: number; abst: number;
  elAtas: number; responded: number; aprovada: number; ressalva: number; reprovada: number;
  matElig: number; matReviewed: number; matAccesses: number;
  avgDays: number | null; lastActivity: number | null;
  voteRate: number | null; ataRate: number | null; matRate: number | null; score: number | null;
  pendVotes: Pend[]; pendAtas: Pend[];
};

const PERIODS: Record<string, number | null> = { '3m': 90, '6m': 180, '12m': 365, all: null };

export const Engajamento: React.FC<{ meetings: any[]; members: any[]; clientName?: string; clientId?: string | null }> = ({ meetings, members, clientName, clientId }) => {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    (async () => {
      let q = supabase.from('material_access_logs').select('meeting_id, user_name, created_at').limit(5000);
      if (clientId) q = q.eq('client_id', clientId);
      const { data } = await q;
      if (active) setLogs(data || []);
    })();
    return () => { active = false; };
  }, [clientId]);
  const [period, setPeriod] = useState<'3m' | '6m' | '12m' | 'all'>('12m');
  const [sortBy, setSortBy] = useState<'score' | 'votes' | 'atas' | 'mat' | 'pend'>('score');
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'ranking' | 'pendencias'>('ranking');

  const now = Date.now();
  const cutoff = PERIODS[period] ? now - (PERIODS[period]! * 24 * 60 * 60 * 1000) : null;
  const inPeriod = (m: any) => { if (!cutoff) return true; if (!m.date) return true; return new Date(m.date + 'T00:00:00').getTime() >= cutoff; };

  const stats: Stat[] = useMemo(() => {
    const byName = new Map<string, Stat>();
    const ensure = (name: string): Stat => {
      if (!byName.has(name)) {
        const role = members.find((u: any) => u.name === name)?.role || '—';
        byName.set(name, { name, role, elVotes: 0, voted: 0, favor: 0, contra: 0, abst: 0, elAtas: 0, responded: 0, aprovada: 0, ressalva: 0, reprovada: 0, matElig: 0, matReviewed: 0, matAccesses: 0, avgDays: null, lastActivity: null, voteRate: null, ataRate: null, matRate: null, score: null, pendVotes: [], pendAtas: [] });
      }
      return byName.get(name)!;
    };
    const periodMeetings = (meetings || []).filter(inPeriod);
    const approvalDurations: Record<string, number[]> = {};

    // Estatísticas no período
    for (const m of periodMeetings) {
      for (const d of (m.deliberacoes || [])) {
        const voters: string[] = d.voters || []; const votes: Record<string, string> = d.votes || {};
        for (const n of voters) {
          const s = ensure(n); s.elVotes++;
          const v = votes[n];
          if (v) { s.voted++; if (v === 'Favor') s.favor++; else if (v === 'Contra') s.contra++; else s.abst++; }
        }
      }
      for (const a of (m.atas || [])) {
        const approvers: string[] = a.approvers || []; const approvals: Record<string, string> = a.approvals || {};
        const sentAt = a.approvalSentAt ? new Date(a.approvalSentAt).getTime() : null;
        for (const n of approvers) {
          const s = ensure(n); s.elAtas++;
          const st = approvals[n];
          if (st) {
            s.responded++;
            if (st === 'aprovada') s.aprovada++; else if (st === 'ressalva') s.ressalva++; else if (st === 'reprovada') s.reprovada++;
            const at = a.approvalAt?.[n] ? new Date(a.approvalAt[n]).getTime() : null;
            if (at) { s.lastActivity = Math.max(s.lastActivity || 0, at); if (sentAt && at >= sentAt) { (approvalDurations[n] = approvalDurations[n] || []).push((at - sentAt) / (24 * 60 * 60 * 1000)); } }
          }
        }
      }
    }

    // Pendências ABERTAS (todas as reuniões, não só o período) — para cobrança
    for (const m of (meetings || [])) {
      const open = m.status !== 'Concluída';
      for (const d of (m.deliberacoes || [])) {
        const voters: string[] = d.voters || []; const votes: Record<string, string> = d.votes || {};
        if (!open) continue;
        for (const n of voters) if (!votes[n]) ensure(n).pendVotes.push({ meetingTitle: m.title, label: d.title || 'Deliberação' });
      }
      for (const a of (m.atas || [])) {
        if (!a.approvalSentAt) continue; // só atas que foram enviadas para aprovação
        const approvers: string[] = a.approvers || []; const approvals: Record<string, string> = a.approvals || {};
        for (const n of approvers) if (!approvals[n]) ensure(n).pendAtas.push({ meetingTitle: m.title, label: a.name || 'Ata' });
      }
    }

    // Materiais: quem acessou (log) por reunião, no período
    const accessByMeeting = new Map<string, Map<string, number>>();
    for (const lg of (logs || [])) {
      if (!lg.meeting_id || !lg.user_name) continue;
      if (!accessByMeeting.has(lg.meeting_id)) accessByMeeting.set(lg.meeting_id, new Map());
      const mm = accessByMeeting.get(lg.meeting_id)!;
      mm.set(lg.user_name, (mm.get(lg.user_name) || 0) + 1);
    }
    const hasMaterials = (m: any) => (m.materiais || []).length > 0 || (m.pautas || []).some((p: any) => (p.materiais || []).length > 0);
    const eligibleForMeeting = (m: any, name: string) =>
      (m.participants || []).some((p: any) => p.name === name)
      || (m.deliberacoes || []).some((d: any) => (d.voters || []).includes(name))
      || (m.atas || []).some((a: any) => (a.approvers || []).includes(name));
    for (const s of byName.values()) {
      for (const m of periodMeetings) {
        if (!hasMaterials(m) || !eligibleForMeeting(m, s.name)) continue;
        s.matElig++;
        const acc = accessByMeeting.get(m.id)?.get(s.name) || 0;
        if (acc > 0) { s.matReviewed++; s.matAccesses += acc; }
      }
    }

    // Finaliza taxas e score
    const list = Array.from(byName.values()).map(s => {
      s.voteRate = s.elVotes ? s.voted / s.elVotes : null;
      s.ataRate = s.elAtas ? s.responded / s.elAtas : null;
      s.matRate = s.matElig ? s.matReviewed / s.matElig : null;
      const rates = [s.voteRate, s.ataRate, s.matRate].filter((r): r is number => r !== null);
      s.score = rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) : null;
      const durs = approvalDurations[s.name];
      s.avgDays = durs && durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : null;
      return s;
    });
    // Só quem é elegível a algo (vota/aprova) — "todos que votam/aprovam"
    return list.filter(s => s.elVotes > 0 || s.elAtas > 0 || s.pendVotes.length > 0 || s.pendAtas.length > 0);
  }, [meetings, members, period, logs]);

  const ranked = useMemo(() => {
    const arr = [...stats];
    arr.sort((a, b) => {
      if (sortBy === 'votes') return (b.voteRate ?? -1) - (a.voteRate ?? -1);
      if (sortBy === 'atas') return (b.ataRate ?? -1) - (a.ataRate ?? -1);
      if (sortBy === 'mat') return (b.matRate ?? -1) - (a.matRate ?? -1);
      if (sortBy === 'pend') return (b.pendVotes.length + b.pendAtas.length) - (a.pendVotes.length + a.pendAtas.length);
      return (b.score ?? -1) - (a.score ?? -1);
    });
    return arr;
  }, [stats, sortBy]);

  // KPIs do colegiado
  const kpis = useMemo(() => {
    const withScore = stats.filter(s => s.score !== null);
    const avgVote = (() => { const v = stats.filter(s => s.voteRate !== null); return v.length ? Math.round(v.reduce((a, s) => a + (s.voteRate || 0), 0) / v.length * 100) : null; })();
    const avgAta = (() => { const v = stats.filter(s => s.ataRate !== null); return v.length ? Math.round(v.reduce((a, s) => a + (s.ataRate || 0), 0) / v.length * 100) : null; })();
    const ativos = withScore.filter(s => (s.score || 0) >= 80).length;
    const atencao = withScore.filter(s => (s.score || 0) >= 50 && (s.score || 0) < 80).length;
    const inativos = withScore.filter(s => (s.score || 0) < 50).length;
    const totalPend = stats.reduce((a, s) => a + s.pendVotes.length + s.pendAtas.length, 0);
    return { avgVote, avgAta, ativos, atencao, inativos, totalPend, total: stats.length };
  }, [stats]);

  const scoreColor = (sc: number | null) => sc === null ? 'text-slate-400' : sc >= 80 ? 'text-emerald-600' : sc >= 50 ? 'text-amber-600' : 'text-red-600';
  const barColor = (sc: number | null) => sc === null ? 'bg-slate-200' : sc >= 80 ? 'bg-emerald-500' : sc >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const statusLabel = (sc: number | null) => sc === null ? 'sem dados' : sc >= 80 ? 'Ativo' : sc >= 50 ? 'Atenção' : 'Inativo';
  const pct = (r: number | null) => r === null ? '—' : `${Math.round(r * 100)}%`;
  const fmtDate = (t: number | null) => t ? new Date(t).toLocaleDateString('pt-BR') : '—';

  // ===================== DRILL-DOWN =====================
  if (selected) {
    const s = stats.find(x => x.name === selected);
    if (!s) { setSelected(null); return null; }
    const pend = s.pendVotes.length + s.pendAtas.length;
    return (
      <div className="space-y-6 animate-in fade-in">
        <button onClick={() => setSelected(null)} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-amber-600 flex items-center gap-1"><ChevronLeft size={14} /> Ranking</button>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 italic">{s.name}</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{s.role}</p>
          </div>
          <div className="text-right">
            <p className={`text-4xl font-bold leading-none ${scoreColor(s.score)}`}>{s.score ?? '—'}<span className="text-base text-slate-400">/100</span></p>
            <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${scoreColor(s.score)}`}>{statusLabel(s.score)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-2"><Scale size={16} className="text-amber-600" /><span className="text-[10px] font-bold uppercase tracking-widest">Votação</span></div>
            <p className="text-2xl font-bold text-slate-800">{s.voted}<span className="text-sm text-slate-400">/{s.elVotes}</span> <span className={`text-sm ${scoreColor(s.voteRate === null ? null : s.voteRate * 100)}`}>{pct(s.voteRate)}</span></p>
            <p className="text-[11px] text-slate-400 mt-1">👍 {s.favor} · 👎 {s.contra} · ⊘ {s.abst}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-2"><FileCheck size={16} className="text-amber-600" /><span className="text-[10px] font-bold uppercase tracking-widest">Atas</span></div>
            <p className="text-2xl font-bold text-slate-800">{s.responded}<span className="text-sm text-slate-400">/{s.elAtas}</span> <span className={`text-sm ${scoreColor(s.ataRate === null ? null : s.ataRate * 100)}`}>{pct(s.ataRate)}</span></p>
            <p className="text-[11px] text-slate-400 mt-1">✓ {s.aprovada} · ✎ {s.ressalva} · ✗ {s.reprovada}{s.avgDays !== null ? ` · ~${s.avgDays.toFixed(1)}d p/ aprovar` : ''}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-2"><FileText size={16} className="text-amber-600" /><span className="text-[10px] font-bold uppercase tracking-widest">Materiais</span></div>
            <p className="text-2xl font-bold text-slate-800">{s.matReviewed}<span className="text-sm text-slate-400">/{s.matElig}</span> <span className={`text-sm ${scoreColor(s.matRate === null ? null : s.matRate * 100)}`}>{pct(s.matRate)}</span></p>
            <p className="text-[11px] text-slate-400 mt-1">reuniões com material acessado{s.matAccesses ? ` · ${s.matAccesses} acesso(s)` : ''}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-2"><AlertTriangle size={16} className="text-amber-600" /><span className="text-[10px] font-bold uppercase tracking-widest">Pendências</span></div>
            <p className={`text-2xl font-bold ${pend > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{pend}</p>
            <p className="text-[11px] text-slate-400 mt-1">Última atividade: {fmtDate(s.lastActivity)}</p>
          </div>
        </div>

        {pend > 0 && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest mb-3 flex items-center gap-2"><AlertTriangle size={15} className="text-red-500" /> Pendências em aberto</h3>
            <div className="space-y-2">
              {s.pendAtas.map((p, i) => <div key={'a' + i} className="flex items-center gap-2 text-sm p-2.5 bg-red-50/50 border border-red-100 rounded-lg"><FileCheck size={14} className="text-red-500 shrink-0" /><span className="text-slate-700">Aprovar <b>{p.label}</b></span><span className="text-[11px] text-slate-400 ml-auto">{p.meetingTitle}</span></div>)}
              {s.pendVotes.map((p, i) => <div key={'v' + i} className="flex items-center gap-2 text-sm p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg"><Scale size={14} className="text-amber-500 shrink-0" /><span className="text-slate-700">Votar <b>{p.label}</b></span><span className="text-[11px] text-slate-400 ml-auto">{p.meetingTitle}</span></div>)}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===================== PAINEL =====================
  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-2"><Activity className="text-amber-600" /> Engajamento do Colegiado</h1>
          <p className="text-sm text-slate-500 mt-1">Participação em votações e aprovações de ata{clientName ? ` · ${clientName}` : ''}.</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
          <Filter size={16} className="text-amber-500" />
          <select value={period} onChange={e => setPeriod(e.target.value as any)} className="text-xs font-bold uppercase outline-none bg-transparent cursor-pointer text-slate-600">
            <option value="3m">Últimos 3 meses</option>
            <option value="6m">Últimos 6 meses</option>
            <option value="12m">Últimos 12 meses</option>
            <option value="all">Todo o período</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-1"><Scale size={15} /><span className="text-[9px] font-bold uppercase tracking-widest">Taxa média de votação</span></div>
          <p className="text-3xl font-bold text-slate-800">{kpis.avgVote === null ? '—' : `${kpis.avgVote}%`}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-1"><FileCheck size={15} /><span className="text-[9px] font-bold uppercase tracking-widest">Taxa média de atas</span></div>
          <p className="text-3xl font-bold text-slate-800">{kpis.avgAta === null ? '—' : `${kpis.avgAta}%`}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-1"><Users size={15} /><span className="text-[9px] font-bold uppercase tracking-widest">Ativos / Atenção / Inativos</span></div>
          <p className="text-2xl font-bold"><span className="text-emerald-600">{kpis.ativos}</span> <span className="text-slate-300">/</span> <span className="text-amber-600">{kpis.atencao}</span> <span className="text-slate-300">/</span> <span className="text-red-600">{kpis.inativos}</span></p>
        </div>
        <button onClick={() => setTab('pendencias')} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-left hover:border-amber-300 transition-all">
          <div className="flex items-center gap-2 text-slate-400 mb-1"><AlertTriangle size={15} /><span className="text-[9px] font-bold uppercase tracking-widest">Pendências abertas</span></div>
          <p className={`text-3xl font-bold ${kpis.totalPend > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{kpis.totalPend}</p>
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {([['ranking', 'Ranking'], ['pendencias', 'Pendências (cobrança)']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${tab === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {stats.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
          <Activity className="mx-auto text-slate-300 mb-3" size={40} />
          <p className="text-slate-500 font-bold">Sem dados de participação no período</p>
          <p className="text-sm text-slate-400 mt-1">Registre deliberações com votantes ou envie atas para aprovação.</p>
        </div>
      ) : tab === 'ranking' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 border-b border-slate-100 text-[9px] font-bold uppercase tracking-widest text-slate-400">
            <button onClick={() => setSortBy('score')} className={`col-span-4 text-left ${sortBy === 'score' ? 'text-amber-600' : ''}`}>Conselheiro</button>
            <button onClick={() => setSortBy('score')} className={`col-span-3 text-left ${sortBy === 'score' ? 'text-amber-600' : ''}`}>Engajamento</button>
            <div className="col-span-4 flex gap-2">
              <button onClick={() => setSortBy('votes')} className={`flex-1 text-left ${sortBy === 'votes' ? 'text-amber-600' : ''}`}>Voto</button>
              <button onClick={() => setSortBy('atas')} className={`flex-1 text-left ${sortBy === 'atas' ? 'text-amber-600' : ''}`}>Ata</button>
              <button onClick={() => setSortBy('mat')} className={`flex-1 text-left ${sortBy === 'mat' ? 'text-amber-600' : ''}`}>Mat.</button>
            </div>
            <button onClick={() => setSortBy('pend')} className={`col-span-1 text-left ${sortBy === 'pend' ? 'text-amber-600' : ''}`}>Pend.</button>
          </div>
          <div className="divide-y divide-slate-50">
            {ranked.map(s => {
              const pend = s.pendVotes.length + s.pendAtas.length;
              return (
                <button key={s.name} onClick={() => setSelected(s.name)} className="w-full grid grid-cols-12 gap-2 px-5 py-3.5 items-center hover:bg-slate-50 transition-colors text-left">
                  <div className="col-span-12 sm:col-span-4 flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-xs font-black shrink-0">{s.name[0]}</span>
                    <div className="min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{s.name}</p><p className="text-[10px] text-slate-400 uppercase tracking-wider">{s.role}</p></div>
                  </div>
                  <div className="col-span-7 sm:col-span-3 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${barColor(s.score)}`} style={{ width: `${s.score ?? 0}%` }} /></div>
                    <span className={`text-sm font-bold w-8 text-right ${scoreColor(s.score)}`}>{s.score ?? '—'}</span>
                  </div>
                  <div className="col-span-5 sm:col-span-4 flex gap-2 text-sm text-slate-600">
                    <span className="flex-1"><span className="sm:hidden text-[9px] text-slate-400 uppercase mr-1">V</span>{pct(s.voteRate)}</span>
                    <span className="flex-1"><span className="sm:hidden text-[9px] text-slate-400 uppercase mr-1">A</span>{pct(s.ataRate)}</span>
                    <span className="flex-1"><span className="sm:hidden text-[9px] text-slate-400 uppercase mr-1">M</span>{pct(s.matRate)}</span>
                  </div>
                  <div className="col-span-12 sm:col-span-1 flex items-center">
                    {pend > 0 ? <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{pend} pend.</span> : <CheckCircle2 size={15} className="text-emerald-500" />}
                    <ChevronRight size={14} className="text-slate-300 ml-auto hidden sm:block" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        // ===== PENDÊNCIAS (para cobrança) =====
        <div className="space-y-3">
          {ranked.filter(s => s.pendVotes.length + s.pendAtas.length > 0).length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-emerald-200">
              <CheckCircle2 className="mx-auto text-emerald-400 mb-3" size={40} />
              <p className="text-slate-600 font-bold">Nenhuma pendência em aberto 🎉</p>
              <p className="text-sm text-slate-400 mt-1">Todos os conselheiros estão em dia com votos e aprovações.</p>
            </div>
          ) : ranked.filter(s => s.pendVotes.length + s.pendAtas.length > 0).map(s => (
            <div key={s.name} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-xs font-black shrink-0">{s.name[0]}</span>
                <div className="flex-1"><p className="text-sm font-bold text-slate-800">{s.name}</p><p className="text-[10px] text-slate-400 uppercase tracking-wider">{s.role}</p></div>
                <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-full">{s.pendVotes.length + s.pendAtas.length} pendência(s)</span>
              </div>
              <div className="space-y-1.5 pl-11">
                {s.pendAtas.map((p, i) => <div key={'a' + i} className="text-xs text-slate-600 flex items-center gap-2"><FileCheck size={12} className="text-red-500 shrink-0" /> Aprovar <b>{p.label}</b> <span className="text-slate-400">· {p.meetingTitle}</span></div>)}
                {s.pendVotes.map((p, i) => <div key={'v' + i} className="text-xs text-slate-600 flex items-center gap-2"><Scale size={12} className="text-amber-500 shrink-0" /> Votar <b>{p.label}</b> <span className="text-slate-400">· {p.meetingTitle}</span></div>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
