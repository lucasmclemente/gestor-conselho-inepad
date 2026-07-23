import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { ShieldCheck, ExternalLink, Search, Building2 } from 'lucide-react';

const TIERS: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  ouro: { label: 'Ouro', color: '#b45309', bg: '#fffbeb', ring: '#f59e0b' },
  prata: { label: 'Prata', color: '#475569', bg: '#f1f5f9', ring: '#94a3b8' },
  bronze: { label: 'Bronze', color: '#9a3412', bg: '#fff7ed', ring: '#ea580c' },
};
const ORDER = ['ouro', 'prata', 'bronze'];
const fmt = (d: string) => { try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return '—'; } };
const monogram = (n: string) => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export const Diretorio = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('list-certified', { body: {} });
        setItems((data as any)?.items || []);
      } catch { setItems([]); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = items.filter((i: any) => (i.name || '').toLowerCase().includes(q.toLowerCase()));
  const counts = ORDER.map(k => ({ k, n: items.filter((i: any) => i.level === k).length })).filter(x => x.n > 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-slate-900 border-b-4 border-amber-600">
        <div className="max-w-5xl mx-auto px-6 py-12 text-center">
          <p className="text-amber-500 text-[11px] font-bold uppercase tracking-[3px]">Boardplan · INEPAD Governança e Sucessão</p>
          <h1 className="text-white text-3xl sm:text-4xl font-black italic mt-3 tracking-tight">Conselhos Certificados</h1>
          <p className="text-slate-300 text-sm mt-3 max-w-2xl mx-auto leading-relaxed">
            Empresas cujos conselhos alcançaram o Selo de Governança INEPAD — reconhecimento de maturidade
            em conselho, gestão, propriedade, controle e conduta. Cada selo é verificável e tem validade.
          </p>
          {counts.length > 0 && (
            <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
              {counts.map(({ k, n }) => (
                <span key={k} className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white px-3 py-1.5 rounded-full" style={{ background: TIERS[k].color }}>
                  <ShieldCheck size={12} /> {n} {TIERS[k].label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Busca */}
        {items.length > 0 && (
          <div className="relative max-w-md mx-auto mb-8">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar empresa..." className="pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-400 w-full shadow-sm" />
          </div>
        )}

        {loading ? (
          <p className="text-center text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse py-20">Carregando diretório…</p>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <ShieldCheck size={44} className="mx-auto mb-3 text-slate-300" />
            <p className="font-bold text-slate-600">Nenhum conselho publicado ainda</p>
            <p className="text-sm">Os conselhos certificados que optarem por aparecer serão listados aqui.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Nenhuma empresa encontrada para “{q}”.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((i: any) => {
              const t = TIERS[i.level] || TIERS.bronze;
              return (
                <a key={i.code} href={`/?selo=${i.code}`} className="group bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden" style={{ borderColor: t.ring }}>
                  <div className="h-1.5" style={{ background: t.color }} />
                  <div className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {i.logo_url
                          ? <img src={i.logo_url} alt={i.name} className="w-full h-full object-contain p-1.5" />
                          : <span className="text-sm font-black text-slate-400">{monogram(i.name)}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-slate-800 italic truncate leading-tight">{i.name}</p>
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white px-2 py-0.5 rounded-full mt-1" style={{ background: t.color }}>
                          <ShieldCheck size={10} /> Selo {t.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Válido até {fmt(i.valid_until)}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 flex items-center gap-1 group-hover:gap-1.5 transition-all">Verificar <ExternalLink size={11} /></span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 py-6 text-center">
        <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5"><Building2 size={13} /> Diretório oficial · Boardplan • INEPAD Governança e Sucessão</p>
      </div>
    </div>
  );
};
