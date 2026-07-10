import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Rocket, Plus, X, Save, Edit2, Trash2, CheckCircle2, Target, CalendarClock, Gauge, Link2 } from 'lucide-react';

const CONF = {
  green: { label: 'Alta', dot: 'bg-emerald-500', text: 'text-emerald-600', bar: 'from-emerald-500 to-emerald-600' },
  yellow: { label: 'Média', dot: 'bg-amber-500', text: 'text-amber-600', bar: 'from-amber-400 to-amber-600' },
  red: { label: 'Baixa', dot: 'bg-red-600', text: 'text-red-600', bar: 'from-red-500 to-red-600' },
} as const;
const LEVELS: [string, string][] = [['organizacional', 'Organizacional'], ['area', 'Área'], ['individual', 'Individual']];

type Props = { currentUser: any; activeClientId: string | null; canEdit: boolean; addLog?: (a: string, d: string) => void };

export const Okr: React.FC<Props> = ({ currentUser, activeClientId, canEdit, addLog }) => {
  const cid = activeClientId || currentUser?.client_id;
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<any[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string>('');
  const [objectives, setObjectives] = useState<any[]>([]);
  const [krs, setKrs] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [indStatus, setIndStatus] = useState<any[]>([]);

  const [cycleModal, setCycleModal] = useState<any>(null);
  const [objModal, setObjModal] = useState<any>(null);
  const [krModal, setKrModal] = useState<any>(null);
  const [checkModal, setCheckModal] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const log = (a: string, d: string) => { try { addLog && addLog(a, d); } catch { /* noop */ } };

  const load = useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    const [cy, ob, kr, ck, mb, ind] = await Promise.all([
      supabase.from('okr_cycles').select('*').eq('client_id', cid).order('created_at', { ascending: false }),
      supabase.from('okr_objectives').select('*').eq('client_id', cid).order('position'),
      supabase.from('key_results').select('*').eq('client_id', cid).order('position'),
      supabase.from('key_result_checkins').select('*').eq('client_id', cid).order('created_at', { ascending: false }),
      supabase.from('members').select('id, name, email').eq('client_id', cid).order('name'),
      supabase.from('indicator_current_status').select('indicator_id, name, unit, current_value').eq('client_id', cid),
    ]) as any;
    const cyc = cy.data || [];
    setCycles(cyc);
    setObjectives(ob.data || []);
    setKrs(kr.data || []);
    setCheckins(ck.data || []);
    setMembers(mb.data || []);
    setIndStatus(ind.data || []);
    setActiveCycleId(prev => (prev && cyc.some((c: any) => c.id === prev)) ? prev : (cyc[0]?.id || ''));
    setLoading(false);
  }, [cid]);
  useEffect(() => { load(); }, [load]);

  const indMap: Record<string, any> = {};
  indStatus.forEach(s => { indMap[s.indicator_id] = s; });
  const latestCheckin: Record<string, any> = {};
  checkins.forEach(c => { if (!latestCheckin[c.key_result_id]) latestCheckin[c.key_result_id] = c; });
  const memberName = (id: string) => members.find(m => m.id === id)?.name || '';

  const krCurrent = (kr: any): number | null => {
    if (kr.indicator_id) { const s = indMap[kr.indicator_id]; return s && s.current_value != null ? Number(s.current_value) : null; }
    return kr.current_value != null ? Number(kr.current_value) : null;
  };
  const krProgress = (kr: any): number => {
    const cur = krCurrent(kr); if (cur == null) return 0;
    const s = Number(kr.start_value ?? 0), t = Number(kr.target_value);
    if (t === s) return cur >= t ? 1 : 0;
    return Math.max(0, (cur - s) / (t - s));
  };
  const objProgress = (objId: string): number => {
    const list = krs.filter(k => k.okr_objective_id === objId);
    if (!list.length) return 0;
    return list.reduce((a, k) => a + Math.min(1, krProgress(k)), 0) / list.length;
  };

  const cycleObjectives = objectives.filter(o => o.cycle_id === activeCycleId);

  // ---------- handlers ----------
  const saveCycle = async () => {
    if (!cycleModal.name?.trim()) return alert('Dê um nome ao ciclo (ex.: 2026 · 3º trimestre).');
    setSaving(true);
    try {
      const payload = { name: cycleModal.name.trim(), start_date: cycleModal.start_date || null, end_date: cycleModal.end_date || null };
      const { data, error } = cycleModal.id
        ? await supabase.from('okr_cycles').update(payload).eq('id', cycleModal.id).select().single()
        : await supabase.from('okr_cycles').insert([{ ...payload, client_id: cid }]).select().single();
      if (error) throw error;
      log('OKR', `${cycleModal.id ? 'Ciclo atualizado' : 'Ciclo criado'}: ${payload.name}`);
      setCycleModal(null); await load();
      if (!cycleModal.id && data) setActiveCycleId(data.id);
    } catch (e: any) { alert('Erro: ' + (e.message || e)); } finally { setSaving(false); }
  };
  const deleteCycle = async (c: any) => {
    if (!window.confirm(`Excluir o ciclo "${c.name}" e todos os OKRs dele?`)) return;
    await supabase.from('okr_cycles').delete().eq('id', c.id); await load();
  };
  const saveObjective = async () => {
    if (!objModal.name?.trim()) return alert('Informe o objetivo.');
    setSaving(true);
    try {
      const payload = { name: objModal.name.trim(), description: objModal.description?.trim() || null, level: objModal.level || null, owner_member_id: objModal.owner_member_id || null };
      if (objModal.id) await supabase.from('okr_objectives').update(payload).eq('id', objModal.id);
      else await supabase.from('okr_objectives').insert([{ ...payload, client_id: cid, cycle_id: activeCycleId, position: cycleObjectives.length }]);
      log('OKR', `${objModal.id ? 'Objetivo atualizado' : 'Objetivo criado'}: ${payload.name}`);
      setObjModal(null); await load();
    } catch (e: any) { alert('Erro: ' + (e.message || e)); } finally { setSaving(false); }
  };
  const deleteObjective = async (o: any) => { if (!window.confirm(`Excluir o objetivo "${o.name}"?`)) return; await supabase.from('okr_objectives').delete().eq('id', o.id); await load(); };
  const saveKr = async () => {
    if (!krModal.name?.trim()) return alert('Informe o resultado-chave.');
    if (krModal.target_value === '' || isNaN(Number(krModal.target_value))) return alert('Informe o valor-alvo (para).');
    setSaving(true);
    try {
      const payload: any = {
        name: krModal.name.trim(), unit: krModal.unit?.trim() || null,
        start_value: Number(krModal.start_value || 0), target_value: Number(krModal.target_value),
        indicator_id: krModal.indicator_id || null,
      };
      if (krModal.id) await supabase.from('key_results').update(payload).eq('id', krModal.id);
      else await supabase.from('key_results').insert([{ ...payload, client_id: cid, okr_objective_id: krModal.okr_objective_id, current_value: Number(krModal.start_value || 0), position: krs.filter(k => k.okr_objective_id === krModal.okr_objective_id).length }]);
      log('OKR', `${krModal.id ? 'KR atualizado' : 'KR criado'}: ${payload.name}`);
      setKrModal(null); await load();
    } catch (e: any) { alert('Erro: ' + (e.message || e)); } finally { setSaving(false); }
  };
  const deleteKr = async (k: any) => { if (!window.confirm(`Excluir o resultado-chave "${k.name}"?`)) return; await supabase.from('key_results').delete().eq('id', k.id); await load(); };
  const saveCheckin = async () => {
    if (!checkModal) return;
    setSaving(true);
    try {
      const kr = checkModal.kr;
      const val = checkModal.value === '' || checkModal.value == null ? null : Number(checkModal.value);
      await supabase.from('key_result_checkins').insert([{ client_id: cid, key_result_id: kr.id, value: val, confidence: checkModal.confidence || null, comment: checkModal.comment?.trim() || null }]);
      if (!kr.indicator_id && val != null) await supabase.from('key_results').update({ current_value: val }).eq('id', kr.id);
      log('OKR', `Check-in: ${kr.name}`);
      setCheckModal(null); await load();
    } catch (e: any) { alert('Erro: ' + (e.message || e)); } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-slate-500 text-sm">Carregando OKRs…</div>;

  return (
    <div className="space-y-6">
      {/* Barra: ciclo + ações */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><CalendarClock size={14} className="text-amber-600" /> Ciclo</span>
          {cycles.length > 0 ? (
            <select value={activeCycleId} onChange={e => setActiveCycleId(e.target.value)} className="text-xs font-bold uppercase tracking-wider bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-1.5 outline-none cursor-pointer">
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : <span className="text-xs text-slate-400 italic">nenhum ciclo</span>}
          {canEdit && activeCycleId && <button onClick={() => { const c = cycles.find(x => x.id === activeCycleId); setCycleModal({ id: c.id, name: c.name, start_date: c.start_date || '', end_date: c.end_date || '' }); }} className="text-slate-300 hover:text-amber-600" title="Editar ciclo"><Edit2 size={14} /></button>}
          {canEdit && activeCycleId && <button onClick={() => deleteCycle(cycles.find(x => x.id === activeCycleId))} className="text-slate-300 hover:text-red-600" title="Excluir ciclo"><Trash2 size={14} /></button>}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button onClick={() => setCycleModal({ name: '', start_date: '', end_date: '' })} className="border border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-600 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1"><Plus size={13} /> Ciclo</button>
            {activeCycleId && <button onClick={() => setObjModal({ name: '', description: '', level: 'organizacional', owner_member_id: '' })} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1"><Plus size={14} /> Objetivo</button>}
          </div>
        )}
      </div>

      {cycles.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
          <Rocket size={32} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Nenhum ciclo de OKR ainda.</p>
          {canEdit && <button onClick={() => setCycleModal({ name: '', start_date: '', end_date: '' })} className="mt-3 bg-slate-900 text-amber-500 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 hover:bg-slate-800"><Plus size={14} /> Criar o primeiro ciclo</button>}
        </div>
      ) : cycleObjectives.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center text-sm text-slate-500">Nenhum objetivo neste ciclo. {canEdit ? 'Clique em "Objetivo" para criar.' : ''}</div>
      ) : (
        <div className="space-y-4">
          {cycleObjectives.map(o => {
            const prog = Math.round(objProgress(o.id) * 100);
            const list = krs.filter(k => k.okr_objective_id === o.id);
            return (
              <div key={o.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-800 italic flex items-center gap-2 flex-wrap">{o.name}
                        {o.level && <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{(LEVELS.find(([v]) => v === o.level) || ['', ''])[1]}</span>}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{o.owner_member_id ? memberName(o.owner_member_id) : 'Sem responsável'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right w-24">
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full" style={{ width: `${prog}%` }} /></div>
                        <p className="text-[10px] font-bold text-slate-500 mt-1">{prog}%</p>
                      </div>
                      {canEdit && <>
                        <button onClick={() => setObjModal({ id: o.id, name: o.name, description: o.description || '', level: o.level || '', owner_member_id: o.owner_member_id || '' })} className="p-1.5 text-slate-400 hover:text-amber-600" title="Editar"><Edit2 size={14} /></button>
                        <button onClick={() => deleteObjective(o)} className="p-1.5 text-slate-300 hover:text-red-600" title="Excluir"><Trash2 size={14} /></button>
                      </>}
                    </div>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {list.length === 0 ? <p className="text-sm text-slate-400 p-2">Nenhum resultado-chave. {canEdit ? 'Adicione abaixo.' : ''}</p> : list.map(k => {
                    const cur = krCurrent(k); const p = Math.min(1, krProgress(k)); const pct = Math.round(krProgress(k) * 100);
                    const conf = latestCheckin[k.id]?.confidence; const cc = conf ? (CONF as any)[conf] : null;
                    return (
                      <div key={k.id} className="border border-slate-100 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-sm font-bold text-slate-800 italic min-w-0 truncate flex items-center gap-1.5">{k.indicator_id && <Gauge size={13} className="text-amber-500 shrink-0" title="Medido por indicador" />}{k.name}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            {cc && <span className={`text-[9px] font-bold uppercase ${cc.text} inline-flex items-center gap-1`}><span className={`h-2 w-2 rounded-full ${cc.dot}`} />{cc.label}</span>}
                            {canEdit && <>
                              <button onClick={() => setCheckModal({ kr: k, value: cur ?? '', confidence: conf || 'green', comment: '' })} className="text-[9px] font-bold uppercase tracking-wider text-amber-600 hover:text-white hover:bg-amber-600 border border-amber-300 rounded px-1.5 py-0.5 transition-all"><CheckCircle2 size={11} className="inline -mt-0.5" /> Check-in</button>
                              <button onClick={() => setKrModal({ id: k.id, okr_objective_id: k.okr_objective_id, name: k.name, unit: k.unit || '', start_value: String(k.start_value ?? 0), target_value: String(k.target_value), indicator_id: k.indicator_id || '' })} className="text-slate-300 hover:text-amber-600" title="Editar"><Edit2 size={13} /></button>
                              <button onClick={() => deleteKr(k)} className="text-slate-300 hover:text-red-600" title="Excluir"><Trash2 size={13} /></button>
                            </>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full bg-gradient-to-r ${cc ? cc.bar : 'from-slate-400 to-slate-500'}`} style={{ width: `${Math.round(p * 100)}%` }} /></div>
                          <span className="text-[11px] font-bold text-slate-500 w-24 text-right tabular-nums">{cur == null ? '—' : cur} / {k.target_value}{k.unit ? ` ${k.unit}` : ''} · {pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                  {canEdit && <button onClick={() => setKrModal({ okr_objective_id: o.id, name: '', unit: '', start_value: '0', target_value: '', indicator_id: '' })} className="w-full mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-amber-600 border border-dashed border-slate-200 hover:border-amber-300 rounded-lg py-2 inline-flex items-center justify-center gap-1 transition-all"><Plus size={13} /> Resultado-chave</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== Modal: Ciclo ===== */}
      {cycleModal && <Modal title={cycleModal.id ? 'Editar ciclo' : 'Novo ciclo'} icon={<CalendarClock size={20} className="text-amber-600" />} onClose={() => setCycleModal(null)}>
        <div className="space-y-3">
          <div><label className="lbl">Nome do ciclo *</label><input value={cycleModal.name} onChange={e => setCycleModal({ ...cycleModal, name: e.target.value })} placeholder="Ex.: 2026 · 3º trimestre" className="inp" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="lbl">Início</label><input type="date" value={cycleModal.start_date} onChange={e => setCycleModal({ ...cycleModal, start_date: e.target.value })} className="inp" /></div>
            <div><label className="lbl">Fim</label><input type="date" value={cycleModal.end_date} onChange={e => setCycleModal({ ...cycleModal, end_date: e.target.value })} className="inp" /></div>
          </div>
        </div>
        <Footer onCancel={() => setCycleModal(null)} onSave={saveCycle} saving={saving} label="Salvar ciclo" />
      </Modal>}

      {/* ===== Modal: Objetivo ===== */}
      {objModal && <Modal title={objModal.id ? 'Editar objetivo' : 'Novo objetivo'} icon={<Target size={20} className="text-amber-600" />} onClose={() => setObjModal(null)}>
        <div className="space-y-3">
          <div><label className="lbl">Objetivo *</label><input value={objModal.name} onChange={e => setObjModal({ ...objModal, name: e.target.value })} placeholder="Ex.: Tornar a governança referência no setor" className="inp" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="lbl">Nível</label>
              <select value={objModal.level || ''} onChange={e => setObjModal({ ...objModal, level: e.target.value })} className="inp cursor-pointer bg-white">
                <option value="">—</option>{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className="lbl">Responsável</label>
              <select value={objModal.owner_member_id || ''} onChange={e => setObjModal({ ...objModal, owner_member_id: e.target.value })} className="inp cursor-pointer bg-white">
                <option value="">—</option>{members.filter(m => m.email).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div><label className="lbl">Descrição (opcional)</label><textarea value={objModal.description} onChange={e => setObjModal({ ...objModal, description: e.target.value })} rows={2} className="inp resize-none" /></div>
        </div>
        <Footer onCancel={() => setObjModal(null)} onSave={saveObjective} saving={saving} label="Salvar objetivo" />
      </Modal>}

      {/* ===== Modal: Resultado-chave ===== */}
      {krModal && <Modal title={krModal.id ? 'Editar resultado-chave' : 'Novo resultado-chave'} icon={<CheckCircle2 size={20} className="text-amber-600" />} onClose={() => setKrModal(null)}>
        <div className="space-y-3">
          <div><label className="lbl">Resultado-chave *</label><input value={krModal.name} onChange={e => setKrModal({ ...krModal, name: e.target.value })} placeholder="Ex.: NPS do conselho de 60 para 75" className="inp" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="lbl">De</label><input type="number" step="any" value={krModal.start_value} onChange={e => setKrModal({ ...krModal, start_value: e.target.value })} className="inp text-right" /></div>
            <div><label className="lbl">Para *</label><input type="number" step="any" value={krModal.target_value} onChange={e => setKrModal({ ...krModal, target_value: e.target.value })} className="inp text-right" /></div>
            <div><label className="lbl">Unidade</label><input value={krModal.unit} onChange={e => setKrModal({ ...krModal, unit: e.target.value })} placeholder="%, R$…" className="inp" /></div>
          </div>
          <div><label className="lbl flex items-center gap-1"><Link2 size={11} /> Medir por indicador (opcional)</label>
            <select value={krModal.indicator_id || ''} onChange={e => setKrModal({ ...krModal, indicator_id: e.target.value })} className="inp cursor-pointer bg-white">
              <option value="">— valor manual (via check-in) —</option>
              {indStatus.map(s => <option key={s.indicator_id} value={s.indicator_id}>{s.name}{s.unit ? ` (${s.unit})` : ''}</option>)}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">Se vinculado, o "atual" vem automaticamente da última leitura do indicador.</p>
          </div>
        </div>
        <Footer onCancel={() => setKrModal(null)} onSave={saveKr} saving={saving} label="Salvar KR" />
      </Modal>}

      {/* ===== Modal: Check-in ===== */}
      {checkModal && <Modal title="Check-in" icon={<CheckCircle2 size={20} className="text-amber-600" />} onClose={() => setCheckModal(null)}>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 truncate">{checkModal.kr.name}</p>
        <div className="space-y-3">
          {!checkModal.kr.indicator_id && <div><label className="lbl">Valor atual</label><input type="number" step="any" value={checkModal.value} onChange={e => setCheckModal({ ...checkModal, value: e.target.value })} className="inp text-right" /></div>}
          {checkModal.kr.indicator_id && <p className="text-[11px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg p-2">Este KR é medido por indicador — o valor atual vem da última leitura.</p>}
          <div><label className="lbl">Confiança de atingir</label>
            <div className="flex gap-2 mt-1">
              {(['green', 'yellow', 'red'] as const).map(c => (
                <button key={c} onClick={() => setCheckModal({ ...checkModal, confidence: c })} className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${checkModal.confidence === c ? `${(CONF as any)[c].text} border-current bg-slate-50` : 'text-slate-400 border-slate-200'}`}><span className={`inline-block h-2.5 w-2.5 rounded-full mr-1 ${(CONF as any)[c].dot}`} />{(CONF as any)[c].label}</button>
              ))}
            </div>
          </div>
          <div><label className="lbl">Comentário</label><textarea value={checkModal.comment} onChange={e => setCheckModal({ ...checkModal, comment: e.target.value })} rows={2} placeholder="O que avançou, bloqueios…" className="inp resize-none" /></div>
        </div>
        <Footer onCancel={() => setCheckModal(null)} onSave={saveCheckin} saving={saving} label="Registrar check-in" />
      </Modal>}

      <style>{`.lbl{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8}.inp{width:100%;margin-top:4px;padding:12px;border-radius:8px;border:1px solid #e2e8f0;outline:none;font-size:14px}.inp:focus{border-color:#fbbf24}`}</style>
    </div>
  );
};

const Modal: React.FC<{ title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }> = ({ title, icon, onClose, children }) => (
  <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
      <div className="p-6 border-b flex justify-between items-center bg-slate-50">
        <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2">{icon} {title}</h3>
        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">{children}</div>
    </div>
  </div>
);
const Footer: React.FC<{ onCancel: () => void; onSave: () => void; saving: boolean; label: string }> = ({ onCancel, onSave, saving, label }) => (
  <div className="flex gap-3 mt-5">
    <button onClick={onCancel} className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-50">Cancelar</button>
    <button disabled={saving} onClick={onSave} className="flex-[2] bg-amber-600 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] flex items-center justify-center gap-2 hover:bg-amber-700 shadow-xl disabled:opacity-50"><Save size={16} /> {saving ? 'Salvando...' : label}</button>
  </div>
);
