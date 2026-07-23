import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { generateSealCertificate } from '../services/generateSealCertificate';
import {
  ShieldCheck, Check, Download, ExternalLink, FileText, ChevronLeft,
  Search, TrendingUp, Loader2, CheckCircle2, RotateCcw,
} from 'lucide-react';

// Console de Certificação (papel Certificador + SuperAdmin). Cross-client: trabalha
// sobre a maturidade JÁ REGISTRADA (última nota do histórico + evidências), valida
// documentos e emite/revoga o Selo de Governança INEPAD. Não recalcula o índice.
// Recebe do App (mantidos em sincronia): sealTiers, maturityBand, matLevels, pillarLabels.
export function Certificacao({ currentUser, criteria, sealTiers, maturityBand, matLevels, pillarLabels }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [seals, setSeals] = useState<any[]>([]);
  const [clientsMap, setClientsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [ansLoading, setAnsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  const PILLAR_ORDER = ['conselho', 'gestao', 'propriedade', 'controle', 'conduta'];

  const load = async () => {
    setLoading(true);
    const [histRes, cliRes, sealRes] = await Promise.all([
      supabase.from('maturity_history').select('client_id, snapshot_date, overall, pillars').order('snapshot_date', { ascending: false }),
      supabase.from('clients').select('client_id, name'),
      supabase.from('governance_seals').select('*').order('issued_at', { ascending: false }),
    ]);
    const latest: Record<string, any> = {};
    (histRes.data || []).forEach((h: any) => { if (!latest[h.client_id]) latest[h.client_id] = h; });
    const cmap: Record<string, string> = {};
    (cliRes.data || []).forEach((c: any) => { cmap[c.client_id] = c.name || c.client_id; });
    setClientsMap(cmap);
    setSeals(sealRes.data || []);
    setRows(Object.values(latest).sort((a: any, b: any) => (cmap[a.client_id] || a.client_id).localeCompare(cmap[b.client_id] || b.client_id)));
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openClient = async (cid: string) => {
    setSelId(cid); setAnswers([]); setAnsLoading(true);
    const { data } = await supabase.from('maturity_answers').select('*').eq('client_id', cid);
    setAnswers(data || []); setAnsLoading(false);
  };

  const nameOf = (cid: string) => clientsMap[cid] || cid;
  const activeSealFor = (cid: string) => (seals || []).find((s: any) => s.client_id === cid && s.status === 'valido' && new Date(s.valid_until) > new Date());
  const tierByKey = (k: string) => sealTiers.find((t: any) => t.key === k) || sealTiers[sealTiers.length - 1];

  // Elegibilidade a partir do snapshot (pilares) + evidências validadas
  const eligibility = (snapshot: any, ans: any[]) => {
    const pillars = (snapshot?.pillars) || [];
    const scored = pillars.filter((p: any) => p.score != null);
    const allScored = pillars.length > 0 && scored.length === pillars.length;
    if (!allScored) return { tier: null, reason: 'O cliente ainda não diagnosticou todos os pilares.' };
    const minPillar = Math.min(...pillars.map((p: any) => p.score));
    const overall = snapshot.overall;
    const ansMap = new Map((ans || []).map((a: any) => [a.criterion_id, a]));
    const docItems = (criteria || []).filter((c: any) => c.requires_evidence);
    const docPending = docItems.some((c: any) => { const a: any = ansMap.get(c.id); return !a || (!a.na && a.status !== 'validado'); });
    for (const t of sealTiers) {
      if (overall >= t.minOverall && minPillar >= t.minPillar && (!t.needDocValidated || !docPending)) return { tier: t, docPending };
    }
    const b = sealTiers[sealTiers.length - 1];
    const faltas: string[] = [];
    if (overall < b.minOverall) faltas.push(`índice ≥ ${b.minOverall} (atual ${overall})`);
    if (minPillar < b.minPillar) faltas.push(`todos os pilares ≥ ${b.minPillar}`);
    return { tier: null, reason: `Para o Bronze falta: ${faltas.join('; ') || 'validar as evidências'}.`, docPending };
  };

  const validate = async (criterion: any, validated: boolean) => {
    const ex = answers.find((a: any) => a.criterion_id === criterion.id);
    if (!ex) return;
    setBusy(true);
    const patch: any = validated
      ? { status: 'validado', validated_by: currentUser?.name || currentUser?.email, validated_at: new Date().toISOString() }
      : { status: 'declarado', validated_by: null, validated_at: null };
    const { error } = await supabase.from('maturity_answers').update(patch).eq('id', ex.id);
    setBusy(false);
    if (error) { alert('Erro ao validar: ' + error.message); return; }
    setAnswers(prev => prev.map(a => a.id === ex.id ? { ...a, ...patch } : a));
  };

  const issue = async (cid: string, level: string, snapshot: any) => {
    const t = tierByKey(level);
    if (!window.confirm(`Emitir o Selo de Governança INEPAD nível ${t.label} para ${nameOf(cid)}?\n\nValidade: 24 meses. A INEPAD chancela esta certificação.`)) return;
    setBusy(true);
    const code = 'INEPAD-' + (crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase());
    const now = new Date(); const valid = new Date(now); valid.setMonth(valid.getMonth() + 24);
    const snap = { overall: snapshot.overall, pillars: snapshot.pillars };
    const { data, error } = await supabase.from('governance_seals').insert([{ client_id: cid, level, score_snapshot: snap, verification_code: code, issued_by: currentUser?.name || currentUser?.email, valid_until: valid.toISOString(), status: 'valido' }]).select().single();
    setBusy(false);
    if (error) { alert('Erro ao emitir selo: ' + error.message); return; }
    setSeals(prev => [data, ...prev]);
    alert(`✅ Selo ${t.label} emitido para ${nameOf(cid)}!\n\nCódigo: ${code}\nVálido até ${valid.toLocaleDateString('pt-BR')}`);
  };

  const revoke = async (seal: any) => {
    if (!window.confirm('Revogar este selo? Ele deixará de ser válido imediatamente.')) return;
    setBusy(true);
    const { error } = await supabase.from('governance_seals').update({ status: 'revogado' }).eq('id', seal.id);
    setBusy(false);
    if (error) { alert('Erro ao revogar: ' + error.message); return; }
    setSeals(prev => prev.map(s => s.id === seal.id ? { ...s, status: 'revogado' } : s));
  };

  const openEvidence = async (a: any) => {
    try {
      const m = /\/meeting-files\/(.+?)(\?|$)/.exec(a.evidence_url || '');
      if (m && m[1]) {
        const path = decodeURIComponent(m[1]);
        const { data } = await supabase.storage.from('meeting-files').createSignedUrl(path, 300);
        if (data?.signedUrl) { window.open(data.signedUrl, '_blank'); return; }
      }
    } catch { /* cai no link salvo */ }
    if (a.evidence_url) window.open(a.evidence_url, '_blank');
  };

  // ---------- LISTA ----------
  if (!selId) {
    const filtered = rows.filter((r: any) => nameOf(r.client_id).toLowerCase().includes(q.toLowerCase()) || r.client_id.toLowerCase().includes(q.toLowerCase()));
    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-2"><ShieldCheck className="text-amber-600" /> Certificação</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Emissão do Selo de Governança INEPAD · {rows.length} conselho(s) com nota registrada</p>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar conselho..." className="pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-400 w-full sm:w-64" />
          </div>
        </div>

        {loading ? (
          <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" /> Carregando conselhos...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center text-slate-400">
            <TrendingUp size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="font-bold text-slate-600">Nenhum conselho com nota registrada ainda</p>
            <p className="text-sm">Assim que um cliente abre a Maturidade, a nota dele passa a aparecer aqui para certificação.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((r: any) => {
              const band = maturityBand(r.overall || 0);
              const seal = activeSealFor(r.client_id);
              const st = seal ? tierByKey(seal.level) : null;
              return (
                <button key={r.client_id} onClick={() => openClient(r.client_id)} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-left hover:shadow-md hover:border-amber-300 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{nameOf(r.client_id)}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 truncate">{r.client_id}</p>
                    </div>
                    {seal && st ? (
                      <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-white shrink-0" style={{ background: st.color }}>{st.label}</span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-slate-100 text-slate-400 shrink-0">sem selo</span>
                    )}
                  </div>
                  <div className="flex items-end gap-2 mt-4">
                    <span className="text-3xl font-black text-slate-800">{r.overall}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest mb-1.5 px-2 py-0.5 rounded-full" style={{ background: band.bg, color: band.color }}>{band.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Nota de {new Date(r.snapshot_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---------- DETALHE / CERTIFICAÇÃO ----------
  const row = rows.find((r: any) => r.client_id === selId);
  const snapshot = row ? { overall: row.overall, pillars: row.pillars || [] } : { overall: 0, pillars: [] };
  const band = maturityBand(snapshot.overall || 0);
  const seal = activeSealFor(selId);
  const elig: any = eligibility(snapshot, answers);
  const docItems = (criteria || []).filter((c: any) => c.requires_evidence).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
  const ansMap = new Map((answers || []).map((a: any) => [a.criterion_id, a]));

  return (
    <div className="space-y-6 animate-in fade-in">
      <button onClick={() => { setSelId(null); setAnswers([]); }} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-amber-600 transition-colors"><ChevronLeft size={14} /> Todos os conselhos</button>

      {/* Cabeçalho + nota */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">{nameOf(selId)}</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{selId}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-4xl font-black text-slate-800">{snapshot.overall}</span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full block text-center" style={{ background: band.bg, color: band.color }}>{band.label}</span>
            <p className="text-[9px] text-slate-400 mt-1">registrado em {row ? new Date(row.snapshot_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</p>
          </div>
        </div>
      </div>

      {/* Pilares */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {PILLAR_ORDER.map((pk: string) => {
          const p = (snapshot.pillars || []).find((x: any) => x.key === pk);
          const na = !p || p.score == null;
          const b = maturityBand(p?.score || 0);
          return (
            <div key={pk} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{pillarLabels[pk] || pk}</p>
              {na ? <p className="text-lg font-black text-slate-300 mt-1">—</p>
                : <p className="text-2xl font-black mt-1" style={{ color: b.color }}>{p.score}</p>}
            </div>
          );
        })}
      </div>

      {/* Selo */}
      <div className="rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: seal ? tierByKey(seal.level).ring : '#e2e8f0' }}>
        <div className="p-6" style={{ background: seal ? tierByKey(seal.level).bg : '#fff' }}>
          {seal ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center text-white shrink-0 shadow-lg" style={{ background: tierByKey(seal.level).color }}>
                <ShieldCheck size={26} />
                <span className="text-[9px] font-black uppercase tracking-widest mt-0.5">{tierByKey(seal.level).label}</span>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: tierByKey(seal.level).color }}>Selo de Governança INEPAD</p>
                <p className="text-xl font-black text-slate-800 italic">Nível {tierByKey(seal.level).label}</p>
                <p className="text-xs text-slate-500 mt-1">Válido até {new Date(seal.valid_until).toLocaleDateString('pt-BR')} · código <b className="text-slate-700">{seal.verification_code}</b></p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2">
                  <button onClick={() => generateSealCertificate({ client_name: nameOf(selId), level: seal.level, issued_at: seal.issued_at, valid_until: seal.valid_until, verification_code: seal.verification_code, issued_by: seal.issued_by }, `${window.location.origin}/?selo=${seal.verification_code}`)} className="text-[9px] font-bold uppercase tracking-widest text-slate-700 hover:text-slate-900 flex items-center gap-1"><Download size={11} /> Certificado (PDF)</button>
                  <button onClick={() => { const url = `${window.location.origin}/?selo=${seal.verification_code}`; navigator.clipboard?.writeText(url); alert('Link de verificação copiado:\n' + url); }} className="text-[9px] font-bold uppercase tracking-widest text-amber-700 hover:text-amber-800 flex items-center gap-1"><ExternalLink size={11} /> Copiar link</button>
                  <button disabled={busy} onClick={() => revoke(seal)} className="text-[9px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600 disabled:opacity-50">Revogar selo</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-slate-700">Selo de Governança INEPAD</p>
                  {elig.tier
                    ? <p className="text-sm text-slate-600">Elegível ao <b style={{ color: elig.tier.color }}>selo {elig.tier.label}</b>.{elig.docPending ? '' : ''}</p>
                    : <p className="text-sm text-slate-500">{elig.reason}</p>}
                </div>
              </div>
              {elig.tier && (
                <button disabled={busy} onClick={() => issue(selId, elig.tier.key, snapshot)} className="px-5 py-2.5 rounded-lg text-white font-bold text-[10px] uppercase tracking-widest shadow-md disabled:opacity-50 shrink-0" style={{ background: elig.tier.color }}>Emitir selo {elig.tier.label}</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Validação de evidências */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Validação de evidências documentais</p>
        <p className="text-xs text-slate-500 mb-4">Confira o documento anexado (e a leitura da IA) e <b>valide</b> — é a chancela humana que sustenta o selo. Prata e Ouro exigem todas as evidências validadas.</p>
        {ansLoading ? (
          <div className="text-slate-400 text-sm flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Carregando evidências...</div>
        ) : docItems.length === 0 ? (
          <p className="text-sm text-slate-400">A rubrica não tem itens documentais.</p>
        ) : (
          <div className="space-y-3">
            {docItems.map((c: any) => {
              const a: any = ansMap.get(c.id);
              const validated = a && a.status === 'validado';
              const na = a && a.na;
              const findings: any[] = (a?.ai_findings) || [];
              return (
                <div key={c.id} className={`rounded-lg border p-4 ${validated ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{pillarLabels[c.pillar] || c.pillar} · {c.dimension}</p>
                      <p className="text-sm font-bold text-slate-700">{c.item}</p>
                    </div>
                    {validated
                      ? <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1"><CheckCircle2 size={11} /> Validado</span>
                      : na ? <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">N/A</span>
                        : <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full shrink-0">Declarado</span>}
                  </div>

                  {a && (a.level != null || a.ai_level != null) && (
                    <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[11px] text-slate-500">
                      {a.level != null && <span>Nível declarado: <b className="text-slate-700">{matLevels[a.level] || a.level}</b></span>}
                      {a.ai_level != null && <span>IA sugeriu: <b className="text-slate-700">{matLevels[a.ai_level] || a.ai_level}</b></span>}
                    </div>
                  )}
                  {a?.ai_justification && <p className="text-xs text-slate-500 mt-2 italic border-l-2 border-slate-200 pl-2">{a.ai_justification}</p>}
                  {findings.length > 0 && (
                    <div className="flex flex-col gap-1 mt-2">
                      {findings.map((f: any, i: number) => (
                        <span key={i} className="text-[11px] flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${f.status === 'presente' ? 'bg-emerald-500' : f.status === 'parcial' ? 'bg-amber-500' : 'bg-red-400'}`} />
                          <span className="text-slate-500">{f.requirement || f.requisito}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-400 uppercase text-[9px] font-bold">{f.status}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                    {a?.evidence_url
                      ? <button onClick={() => openEvidence(a)} className="text-[10px] font-bold uppercase tracking-widest text-violet-600 hover:text-violet-700 flex items-center gap-1"><FileText size={13} /> Abrir documento{a.evidence_name ? ` · ${a.evidence_name}` : ''}</button>
                      : <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Sem documento anexado</span>}
                    <div className="flex-1" />
                    {validated
                      ? <button disabled={busy} onClick={() => validate(c, false)} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 disabled:opacity-50 flex items-center gap-1"><RotateCcw size={12} /> Desfazer validação</button>
                      : <button disabled={busy || !a || na || !a.evidence_url} onClick={() => validate(c, true)} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 flex items-center gap-1"><Check size={13} /> Validar evidência</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
