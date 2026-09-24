import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChevronLeft, PhoneIncoming, PhoneMissed, PhoneOutgoing, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { CrmWebphone } from './CrmWebphone';

type Props = { cid: string; currentUser: any; members: any[]; onBack: () => void; onOpenDeal: (id: string) => void };

const digits = (s: string) => (s || '').replace(/\D/g, '');
// número de quem ligou → E.164 para poder discar de volta
const toE164 = (s: string) => { const d = digits(s); if (!d) return s || ''; return (s || '').trim().startsWith('+') ? (s || '').trim() : '+' + d; };
const fmtDur = (secs: number) => { const s = Math.max(0, Math.round(secs || 0)); const m = Math.floor(s / 60), ss = s % 60; return m ? `${m}m${String(ss).padStart(2, '0')}s` : `${ss}s`; };
const rel = (iso: string) => {
  const t = new Date(iso).getTime(); const diff = Date.now() - t;
  const min = Math.floor(diff / 60000); if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60); if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `há ${d} dia${d > 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export const CrmReceivedCalls: React.FC<Props> = ({ cid, currentUser, members, onBack, onOpenDeal }) => {
  const nameOf = (id: string | null) => !id ? '—' : (members.find((m: any) => m.id === id)?.name || (id === currentUser?.id ? currentUser?.name : '—'));

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialing, setDialing] = useState<any>(null); // alvo do webfone ou null

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('crm_activities')
      .select('id, created_at, done, call_answered, call_seconds, call_number, owner_member_id, deal_id, contact_id, organization_id, org:crm_organizations(name), contact:crm_contacts(name), deal:crm_deals(title, status)')
      .eq('client_id', cid).eq('type', 'call').eq('call_direction', 'in')
      .order('created_at', { ascending: false }).limit(500);
    setRows(data || []);
    setLoading(false);
  }, [cid]);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => filter === 'pending' ? rows.filter(r => !r.done) : rows, [rows, filter]);
  const pendingCount = useMemo(() => rows.filter(r => !r.done).length, [rows]);

  const displayName = (r: any) => r.contact?.name || r.org?.name || r.call_number || 'Número desconhecido';

  // garante um negócio onde registrar o retorno (quase sempre já existe; cria lead se faltar)
  const ensureDeal = async (r: any): Promise<string | null> => {
    if (r.deal_id) return r.deal_id;
    const num = r.call_number || '';
    const { data: pipe } = await supabase.from('crm_pipelines').select('id').eq('client_id', cid).eq('is_default', true).limit(1).maybeSingle();
    const pipeId = pipe?.id || (await supabase.from('crm_pipelines').select('id').eq('client_id', cid).order('position').limit(1).maybeSingle()).data?.id;
    if (!pipeId) return null;
    const { data: stg } = await supabase.from('crm_stages').select('id').eq('pipeline_id', pipeId).order('position').limit(1).maybeSingle();
    let orgId = r.organization_id;
    if (!orgId) { const { data: org } = await supabase.from('crm_organizations').insert({ client_id: cid, name: `Lead ${num || 'desconhecido'}`, phone: num || null }).select('id').single(); orgId = org?.id || null; }
    const { data: dl } = await supabase.from('crm_deals').insert({ client_id: cid, pipeline_id: pipeId, stage_id: stg?.id, title: `Lead ${num || 'desconhecido'}`, organization_id: orgId, contact_id: r.contact_id || null, status: 'open', source: 'Ligação recebida', owner_member_id: currentUser?.id || null }).select('id').single();
    if (dl?.id) await supabase.from('crm_activities').update({ deal_id: dl.id, organization_id: orgId }).eq('id', r.id);
    return dl?.id || null;
  };

  const retornar = async (r: any) => {
    setBusyId(r.id);
    const dealId = await ensureDeal(r);
    setBusyId(null);
    if (!dealId) { alert('Não foi possível preparar o negócio para registrar o retorno.'); return; }
    setDialing({ number: toE164(r.call_number), name: displayName(r), dealId, contactId: r.contact_id, rowId: r.id });
    // sai da fila de retorno (já está sendo retornada)
    await supabase.from('crm_activities').update({ done: true, done_at: new Date().toISOString() }).eq('id', r.id);
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, done: true } : x));
  };

  const marcarRetornada = async (r: any) => {
    setBusyId(r.id);
    const { error } = await supabase.from('crm_activities').update({ done: true, done_at: new Date().toISOString() }).eq('id', r.id);
    setBusyId(null);
    if (error) { alert('Erro: ' + error.message); return; }
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, done: true } : x));
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      {dialing && (
        <CrmWebphone number={dialing.number} contactName={dialing.name} dealId={dialing.dealId} cid={cid}
          contactId={dialing.contactId} ownerId={currentUser?.id || null}
          onClose={() => { setDialing(null); load(); }} />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1 mb-2"><ChevronLeft size={14} /> Voltar ao funil</button>
          <h2 className="text-2xl font-bold text-slate-800 italic flex items-center gap-2"><PhoneIncoming size={22} className="text-amber-600" /> Ligações Recebidas</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Quem ligou para o webfone — retorne no momento oportuno</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} title="Atualizar" className="p-2.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"><RefreshCw size={16} /></button>
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            <button onClick={() => setFilter('pending')} className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${filter === 'pending' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Para retornar{pendingCount > 0 ? ` (${pendingCount})` : ''}</button>
            <button onClick={() => setFilter('all')} className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Todas</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-amber-600 font-bold uppercase animate-pulse">Carregando...</div>
      ) : list.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center text-sm text-slate-400 italic">
          {filter === 'pending' ? 'Nenhuma ligação recebida aguardando retorno. 🎉' : 'Nenhuma ligação recebida registrada ainda.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-50">
          {list.map(r => {
            const missed = !r.call_answered;
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${missed ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                  {missed ? <PhoneMissed size={16} /> : <PhoneIncoming size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 italic truncate">{displayName(r)}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {r.call_number || 'sem número'} · {rel(r.created_at)}
                    {!missed && <> · <span className="text-emerald-600 font-bold">Atendida{r.call_seconds ? ` ${fmtDur(r.call_seconds)}` : ''}</span>{r.owner_member_id ? ` por ${nameOf(r.owner_member_id)}` : ''}</>}
                    {missed && <> · <span className="text-red-500 font-bold">Não atendida</span></>}
                  </p>
                </div>
                {r.done && <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 shrink-0 hidden sm:inline">Retornada</span>}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => retornar(r)} disabled={busyId === r.id}
                    className="px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50">
                    <PhoneOutgoing size={13} /> Retornar
                  </button>
                  {r.deal_id && (
                    <button onClick={() => onOpenDeal(r.deal_id)} title="Abrir negócio"
                      className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"><ExternalLink size={14} /></button>
                  )}
                  {!r.done && (
                    <button onClick={() => marcarRetornada(r)} disabled={busyId === r.id} title="Marcar como retornada"
                      className="p-2 rounded-lg bg-slate-100 text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-50"><Check size={14} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-400 italic px-1">
        Toda ligação que toca no webfone entra aqui — as <b>não atendidas</b> ficam em "Para retornar". "Retornar" liga de volta pelo webfone e tira da fila. Cada usuário vê as recebidas dos próprios negócios; administradores veem todas.
      </p>
    </div>
  );
};
