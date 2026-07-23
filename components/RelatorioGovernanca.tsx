import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { generateGovernanceReport } from '../services/generateGovernanceReport';
import { BarChart3, Download, Loader2, TrendingUp, ShieldCheck } from 'lucide-react';

const BANDS = [
  { key: 'avancado', label: 'Avançado (≥80)', color: '#059669' },
  { key: 'estruturado', label: 'Estruturado (60–79)', color: '#65a30d' },
  { key: 'em_desenvolvimento', label: 'Em desenvolvimento (40–59)', color: '#d97706' },
  { key: 'em_estruturacao', label: 'Em estruturação (20–39)', color: '#ea580c' },
  { key: 'inicial', label: 'Inicial (<20)', color: '#dc2626' },
];
const PILLARS = [
  { key: 'conselho', label: 'Conselho' }, { key: 'gestao', label: 'Gestão' },
  { key: 'propriedade', label: 'Propriedade' }, { key: 'controle', label: 'Controle' }, { key: 'conduta', label: 'Conduta' },
];
const SEALS = [
  { key: 'ouro', label: 'Ouro', color: '#b45309' },
  { key: 'prata', label: 'Prata', color: '#475569' },
  { key: 'bronze', label: 'Bronze', color: '#9a3412' },
];

const Bar = ({ label, value, max, color, suffix = '' }: any) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-slate-500 w-44 shrink-0 truncate">{label}</span>
    <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${max > 0 ? Math.max(2, value / max * 100) : 2}%`, background: color }} />
    </div>
    <span className="text-xs font-black text-slate-700 w-10 text-right">{value}{suffix}</span>
  </div>
);

export const RelatorioGovernanca = () => {
  const [loading, setLoading] = useState(true);
  const [r, setR] = useState<any>(null);
  const year = new Date().getFullYear();

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc('governance_report');
        setR(error ? { error: true } : data);
      } catch { setR({ error: true }); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-2"><BarChart3 className="text-amber-600" /> Estado da Governança {year}</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Panorama anônimo agregado da plataforma</p>
        </div>
        {r && !r.error && !r.insufficient && (
          <button onClick={() => generateGovernanceReport(r, year)} className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-md transition-all shrink-0"><Download size={15} /> Baixar relatório (PDF)</button>
        )}
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" /> Compilando o panorama…</div>
      ) : !r || r.error ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center text-slate-400">Não foi possível carregar o relatório.</div>
      ) : r.insufficient ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center text-slate-400">
          <BarChart3 size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-bold text-slate-600">Base ainda pequena para um panorama</p>
          <p className="text-sm">O relatório fica disponível a partir de {r.min_n} conselhos com nota registrada (hoje: {r.n}). Preserva o anonimato.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { v: r.avg, l: 'Índice médio' },
              { v: r.median, l: 'Mediana' },
              { v: `${r.p25}–${r.p75}`, l: 'Faixa 25–75%' },
              { v: r.seals?.total ?? 0, l: 'Conselhos certificados' },
            ].map((k, i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
                <p className="text-3xl font-black text-slate-800">{k.v}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">{k.l}</p>
              </div>
            ))}
          </div>

          {/* Distribuição por faixa */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Distribuição por faixa de maturidade</p>
            <div className="space-y-2.5">
              {BANDS.map(b => <Bar key={b.key} label={b.label} value={(r.bands || {})[b.key] || 0} max={r.n} color={b.color} />)}
            </div>
          </div>

          {/* Média por pilar */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Média por pilar (0–100)</p>
            <div className="space-y-2.5">
              {(() => { const m: any = Object.fromEntries((r.pillars || []).map((p: any) => [p.key, p.avg])); return PILLARS.filter(p => m[p.key] != null).map(p => <Bar key={p.key} label={p.label} value={m[p.key]} max={100} color="#d97706" />); })()}
            </div>
          </div>

          {/* Certificações + Evolução */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-1.5"><ShieldCheck size={13} /> Certificações válidas</p>
              <div className="grid grid-cols-3 gap-3">
                {SEALS.map(s => (
                  <div key={s.key} className="rounded-lg border p-4 text-center" style={{ borderColor: s.color }}>
                    <p className="text-2xl font-black" style={{ color: s.color }}>{(r.seals?.by_level || {})[s.key] || 0}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-1.5"><TrendingUp size={13} /> Evolução dos conselhos</p>
              {(!r.evolution || r.evolution.insufficient) ? (
                <p className="text-sm text-slate-400">Base de histórico em formação — as estatísticas de evolução aparecem conforme os conselhos acumulam registros.</p>
              ) : (
                <div>
                  <p className="text-2xl font-black text-emerald-600">{r.evolution.n ? Math.round(r.evolution.improved / r.evolution.n * 100) : 0}%</p>
                  <p className="text-sm text-slate-600">dos conselhos com histórico <b>melhoraram a nota</b>.</p>
                  <p className="text-xs text-slate-400 mt-2">Ganho médio de {r.evolution.avg_delta > 0 ? '+' : ''}{r.evolution.avg_delta} pontos · mediana {r.evolution.median_delta > 0 ? '+' : ''}{r.evolution.median_delta} · base de {r.evolution.n} conselhos.</p>
                </div>
              )}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 text-center">Dados anônimos e agregados. Nenhuma empresa é identificada; os números aparecem só com massa suficiente para preservar o anonimato.</p>
        </>
      )}
    </div>
  );
};
