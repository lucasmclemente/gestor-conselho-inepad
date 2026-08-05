import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  ChevronLeft, Trophy, Ban, RotateCcw, Save, Trash2, Plus, X,
  Phone, Mail, Calendar, MessageSquare, FileText, CheckSquare,
  Building2, User, Clock, Check, History, Star, Pencil, Play,
} from 'lucide-react';
import { CrmLostModal } from './CrmLostModal';

const BRL = (n: any) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDateTime = (s: string) => { try { return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return s; } };
const fmtDate = (s: string) => { try { return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR'); } catch { return s; } };

const ACT_TYPES = [
  { v: 'call', label: 'Ligação', icon: Phone },
  { v: 'meeting', label: 'Reunião', icon: Calendar },
  { v: 'email', label: 'E-mail', icon: Mail },
  { v: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { v: 'task', label: 'Tarefa', icon: CheckSquare },
  { v: 'note', label: 'Nota', icon: FileText },
] as const;
const actMeta = (t: string) => ACT_TYPES.find(x => x.v === t) || ACT_TYPES[4];

type Props = {
  dealId: string;
  cid: string;
  currentUser: any;
  isAdmin: boolean;
  members: any[];
  stages: any[];
  emailConnected?: boolean;
  addLog?: (action: string, details: string) => Promise<void> | void;
  onBack: () => void;
  onMutated: () => void;
};

export const CrmDeal: React.FC<Props> = ({ dealId, cid, currentUser, isAdmin, members, stages, emailConnected, addLog, onBack, onMutated }) => {
  const log = async (a: string, d: string) => { try { await addLog?.(a, d); } catch { /* noop */ } };
  const ownerName = (id: string) => (members.find((m: any) => m.id === id)?.name) || (id === currentUser?.id ? currentUser?.name : '—');
  const digitsOnly = (s: string) => (s || '').replace(/\D/g, '');
  const waLink = (phone: string) => { let d = digitsOnly(phone); if (d.length <= 11) d = '55' + d; return `https://wa.me/${d}`; };
  const mailtoLink = (email: string) => `mailto:${email}?subject=${encodeURIComponent('Contato — ' + (deal?.title || ''))}`;

  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [acts, setActs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [fieldDefs, setFieldDefs] = useState<any[]>([]);
  const [customForm, setCustomForm] = useState<Record<string, any>>({});
  const [savingCustom, setSavingCustom] = useState(false);
  const [recUrls, setRecUrls] = useState<Record<string, string>>({});
  const [recLoading, setRecLoading] = useState<string>('');
  const [compose, setCompose] = useState<any>(null); // {to, subject, body} | null
  const [sendingEmail, setSendingEmail] = useState(false);
  const [tags, setTags] = useState<any[]>([]);
  const [lostOpen, setLostOpen] = useState(false);

  const [dForm, setDForm] = useState<any>({ title: '', value: '', expected_close_date: '', source: '', owner_member_id: '' });
  const [savingDeal, setSavingDeal] = useState(false);
  const [cForm, setCForm] = useState<any>(null); // null = escondido
  const [oForm, setOForm] = useState<any>(null);
  const [actForm, setActForm] = useState<any>({ type: 'call', title: '', notes: '', due_at: '' });
  const [addingAct, setAddingAct] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: d } = await supabase.from('crm_deals').select('*').eq('id', dealId).maybeSingle();
    setDeal(d);
    setDForm({
      title: d?.title || '', value: d?.value ?? '', expected_close_date: d?.expected_close_date || '',
      source: d?.source || '', owner_member_id: d?.owner_member_id || '',
    });
    const [ct, og, ac, ev, fd, tg] = await Promise.all([
      // todos os contatos da empresa (sócios) — ou, sem empresa, só o contato principal
      d?.organization_id
        ? supabase.from('crm_contacts').select('*').eq('organization_id', d.organization_id).order('created_at', { ascending: true })
        : (d?.contact_id ? supabase.from('crm_contacts').select('*').eq('id', d.contact_id) : Promise.resolve({ data: [] })),
      d?.organization_id ? supabase.from('crm_organizations').select('*').eq('id', d.organization_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('crm_activities').select('*').eq('deal_id', dealId).order('created_at', { ascending: false }),
      supabase.from('crm_deal_events').select('*').eq('deal_id', dealId).order('created_at', { ascending: false }),
      supabase.from('crm_field_defs').select('*').eq('client_id', cid).eq('active', true).order('position'),
      supabase.from('crm_tags').select('*').eq('client_id', cid).order('position'),
    ]);
    setContacts(ct.data || []); setOrg(og.data); setActs(ac.data || []); setEvents(ev.data || []);
    setFieldDefs(fd.data || []); setCustomForm(d?.custom || {}); setTags(tg.data || []);
    setLoading(false);
  }, [dealId]);
  useEffect(() => { load(); }, [load]);

  const saveDeal = async () => {
    if (!dForm.title.trim()) return alert('Informe o título do negócio.');
    setSavingDeal(true);
    const patch: any = {
      title: dForm.title.trim(),
      value: parseFloat(String(dForm.value).replace(',', '.')) || 0,
      expected_close_date: dForm.expected_close_date || null,
      source: dForm.source?.trim() || null,
    };
    // Só Admin reatribui o dono (o banco também bloqueia via gatilho)
    if (isAdmin && dForm.owner_member_id && dForm.owner_member_id !== deal.owner_member_id) patch.owner_member_id = dForm.owner_member_id;
    const { error } = await supabase.from('crm_deals').update(patch).eq('id', dealId);
    setSavingDeal(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    log('CRM', `Negócio "${patch.title}" editado`);
    await load(); onMutated();
  };

  const moveStage = async (stageId: string) => {
    if (!deal || stageId === deal.stage_id) return;
    // Campos exigidos pela etapa atual: só bloqueia ao AVANÇAR (etapa de posição maior)
    const curStage = stages.find(s => s.id === deal.stage_id);
    const tgtPos = stages.find(s => s.id === stageId)?.position ?? 0;
    if ((curStage?.position ?? 0) < tgtPos) {
      const reqIds = Array.isArray(curStage?.required_field_ids) ? curStage.required_field_ids : [];
      const miss = fieldDefs.filter((f: any) => reqIds.includes(f.id)).filter((f: any) => {
        const v = deal.custom?.[f.id];
        return f.type === 'checkbox' ? !v : (v === undefined || v === null || v === '');
      });
      if (miss.length) { alert('Preencha e salve os campos exigidos nesta etapa antes de avançar:\n\n• ' + miss.map((f: any) => f.label).join('\n• ')); return; }
    }
    const { error } = await supabase.from('crm_deals').update({ stage_id: stageId }).eq('id', dealId);
    if (error) { alert('Erro: ' + error.message); return; }
    const st = stages.find(s => s.id === stageId);
    setDeal((prev: any) => ({ ...prev, stage_id: stageId }));
    log('CRM', `Negócio "${deal.title}" movido para ${st?.name}`);
    onMutated();
  };

  const setStatus = async (status: 'open' | 'won') => {
    const patch: any = { status, won_at: status === 'won' ? new Date().toISOString() : null, lost_at: null, lost_reason: null };
    const { error } = await supabase.from('crm_deals').update(patch).eq('id', dealId);
    if (error) { alert('Erro: ' + error.message); return; }
    setDeal((prev: any) => ({ ...prev, ...patch }));
    log('CRM', `Negócio "${deal.title}" — ${status === 'won' ? 'Ganho' : 'Reaberto'}`);
    onMutated();
  };

  const confirmLost = async (reason: string) => {
    const patch: any = { status: 'lost', lost_at: new Date().toISOString(), lost_reason: reason || null };
    const { error } = await supabase.from('crm_deals').update(patch).eq('id', dealId);
    if (error) { alert('Erro: ' + error.message); return; }
    setDeal((prev: any) => ({ ...prev, ...patch }));
    log('CRM', `Negócio "${deal.title}" marcado como Perdido${reason ? ' — ' + reason : ''}`);
    setLostOpen(false); onMutated();
  };

  const saveContact = async () => {
    if (!cForm.name?.trim()) return alert('Informe o nome do contato.');
    const payload: any = { client_id: cid, name: cForm.name.trim(), role_title: cForm.role_title?.trim() || null, email: cForm.email?.trim() || null, phone: cForm.phone?.trim() || null, organization_id: deal?.organization_id || null };
    if (cForm.id) {
      const { error } = await supabase.from('crm_contacts').update(payload).eq('id', cForm.id);
      if (error) { alert('Erro: ' + error.message); return; }
    } else {
      const { data, error } = await supabase.from('crm_contacts').insert(payload).select().single();
      if (error) { alert('Erro: ' + error.message); return; }
      // se o negócio ainda não tem contato principal, o novo vira o principal
      if (!deal?.contact_id) { await supabase.from('crm_deals').update({ contact_id: data.id }).eq('id', dealId); setDeal((p: any) => ({ ...p, contact_id: data.id })); }
    }
    setCForm(null); await load();
  };

  const setPrimaryContact = async (contactId: string) => {
    const { error } = await supabase.from('crm_deals').update({ contact_id: contactId }).eq('id', dealId);
    if (error) { alert('Erro: ' + error.message); return; }
    setDeal((p: any) => ({ ...p, contact_id: contactId })); onMutated();
  };

  const delContact = async (c: any) => {
    if (!window.confirm(`Excluir o contato "${c.name}"?`)) return;
    if (deal?.contact_id === c.id) await supabase.from('crm_deals').update({ contact_id: null }).eq('id', dealId);
    const { error } = await supabase.from('crm_contacts').delete().eq('id', c.id);
    if (error) { alert('Erro: ' + error.message); return; }
    await load();
  };

  const saveOrg = async () => {
    if (!oForm.name?.trim()) return alert('Informe o nome da empresa.');
    const payload: any = { client_id: cid, name: oForm.name.trim(), phone: oForm.phone?.trim() || null, address: oForm.address?.trim() || null };
    if (org) {
      const { error } = await supabase.from('crm_organizations').update(payload).eq('id', org.id);
      if (error) { alert('Erro: ' + error.message); return; }
    } else {
      const { data, error } = await supabase.from('crm_organizations').insert(payload).select().single();
      if (error) { alert('Erro: ' + error.message); return; }
      await supabase.from('crm_deals').update({ organization_id: data.id }).eq('id', dealId);
    }
    setOForm(null); await load();
  };

  const toggleTag = async (tagId: string) => {
    const cur = Array.isArray(deal?.tag_ids) ? deal.tag_ids : [];
    const next = cur.includes(tagId) ? cur.filter((id: string) => id !== tagId) : [...cur, tagId];
    setDeal((prev: any) => ({ ...prev, tag_ids: next }));
    const { error } = await supabase.from('crm_deals').update({ tag_ids: next }).eq('id', dealId);
    if (error) { alert('Erro: ' + error.message); load(); return; }
    onMutated();
  };

  const callContact = async (c: any) => {
    if (!c?.phone) return;
    const d = String(c.phone).replace(/\D/g, '');
    const dial = '+' + (d.length <= 11 ? '55' + d : d);
    // registra a ligação como atividade (não bloqueia a discagem se falhar)
    try {
      const { data } = await supabase.from('crm_activities').insert({
        client_id: cid, deal_id: dealId, contact_id: c.id, type: 'call',
        title: `Ligação para ${c.name}`, notes: `Número: ${dial}`,
        owner_member_id: currentUser?.id || null,
      }).select().single();
      if (data) setActs(prev => [data, ...prev]);
    } catch { /* segue */ }
    // abre o discador (app GoTo, se for o handler de tel: na máquina)
    window.location.href = `tel:${dial}`;
  };

  // Baixa/reproduz a gravação da ligação (via GoTo → Storage), sob demanda
  const playRecording = async (a: any) => {
    if (recUrls[a.id]) return;
    setRecLoading(a.id);
    const { data, error } = await supabase.functions.invoke('goto-call', { body: { action: 'recording', recordingId: a.recording_id, activityId: a.id } });
    setRecLoading('');
    if (error) {
      let m = error.message;
      try { const b = await (error as any).context?.json?.(); if (b?.error) m = b.error; } catch { /* */ }
      alert('Não foi possível carregar a gravação: ' + m);
      return;
    }
    const url = (data as any)?.url;
    if (url) setRecUrls(prev => ({ ...prev, [a.id]: url }));
    else alert('Gravação indisponível.');
  };

  // Abre o compositor de e-mail (Outlook) ou cai no mailto se não conectado
  const openEmail = (c: any) => {
    if (!c?.email) return;
    if (emailConnected) setCompose({ to: c.email, subject: `Contato — ${deal?.title || ''}`, body: '', contactId: c.id, contactName: c.name });
    else window.location.href = mailtoLink(c.email);
  };
  const sendEmail = async () => {
    if (!compose?.to) return;
    if (!compose.subject?.trim() && !compose.body?.trim()) return alert('Escreva o assunto ou a mensagem.');
    setSendingEmail(true);
    const { data, error } = await supabase.functions.invoke('outlook-send', {
      body: { to: compose.to, subject: compose.subject, body: compose.body, dealId, contactId: compose.contactId || null },
    });
    setSendingEmail(false);
    if (error) {
      let m = error.message;
      try { const b = await (error as any).context?.json?.(); if (b?.error) m = b.error; } catch { /* */ }
      alert('Não foi possível enviar: ' + m);
      return;
    }
    const act = (data as any)?.activity;
    if (act) setActs(prev => [act, ...prev]);
    setCompose(null);
    log('CRM', `E-mail enviado para ${compose.to}`);
  };

  const setCustom = (id: string, val: any) => setCustomForm(prev => ({ ...prev, [id]: val }));
  const saveCustom = async () => {
    setSavingCustom(true);
    const { error } = await supabase.from('crm_deals').update({ custom: customForm }).eq('id', dealId);
    setSavingCustom(false);
    if (error) { alert('Erro ao salvar campos: ' + error.message); return; }
    setDeal((prev: any) => ({ ...prev, custom: customForm }));
    log('CRM', 'Campos personalizados atualizados');
  };

  const addActivity = async () => {
    if (!actForm.title.trim() && !actForm.notes.trim()) return alert('Preencha o título ou a descrição da atividade.');
    setAddingAct(true);
    const payload: any = {
      client_id: cid, deal_id: dealId, type: actForm.type,
      title: actForm.title.trim() || null, notes: actForm.notes.trim() || null,
      due_at: actForm.due_at ? new Date(actForm.due_at).toISOString() : null,
      owner_member_id: currentUser?.id || null,
    };
    const { data, error } = await supabase.from('crm_activities').insert(payload).select().single();
    setAddingAct(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setActs(prev => [data, ...prev]);
    // aviso (toast do navegador) confirmando a tarefa agendada
    if (payload.due_at) {
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Tarefa agendada', { body: `${payload.title || 'Tarefa'}${deal?.title ? ' • ' + deal.title : ''} — ${new Date(payload.due_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` });
        }
      } catch { /* */ }
    }
    setActForm({ type: 'call', title: '', notes: '', due_at: '' });
  };

  const toggleAct = async (a: any) => {
    const done = !a.done;
    const done_at = done ? new Date().toISOString() : null;
    const { error } = await supabase.from('crm_activities').update({ done, done_at }).eq('id', a.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setActs(prev => prev.map(x => x.id === a.id ? { ...x, done, done_at } : x));
  };

  const delAct = async (a: any) => {
    if (!window.confirm('Excluir esta atividade?')) return;
    const { error } = await supabase.from('crm_activities').delete().eq('id', a.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setActs(prev => prev.filter(x => x.id !== a.id));
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-amber-600 font-bold uppercase animate-pulse">Carregando negócio...</div>;
  if (!deal) return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1"><ChevronLeft size={14} /> Voltar ao funil</button>
      <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center text-sm text-slate-400 italic">Negócio não encontrado.</div>
    </div>
  );

  const won = deal.status === 'won', lost = deal.status === 'lost';

  return (
    <div className="space-y-6 animate-in fade-in">
      <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1"><ChevronLeft size={14} /> Voltar ao funil</button>

      {/* BARRA SUPERIOR */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic truncate">{deal.title}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {BRL(deal.value)} • Proprietário: {ownerName(deal.owner_member_id)}
              {won && <span className="ml-2 text-emerald-600">• GANHO</span>}
              {lost && <span className="ml-2 text-red-500">• PERDIDO{deal.lost_reason ? ` (${deal.lost_reason})` : ''}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!won && !lost && <>
              <button onClick={() => setStatus('won')} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-all"><Trophy size={14} /> Ganho</button>
              <button onClick={() => setLostOpen(true)} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-all"><Ban size={14} /> Perdido</button>
            </>}
            {(won || lost) && <button onClick={() => setStatus('open')} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-all"><RotateCcw size={14} /> Reabrir</button>}
          </div>
        </div>

        {/* BARRA DE ETAPAS */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {stages.map((s: any) => {
            const active = s.id === deal.stage_id;
            return (
              <button key={s.id} onClick={() => moveStage(s.id)} disabled={won || lost}
                className={`shrink-0 px-3 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-wide transition-all disabled:opacity-50 ${active ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {s.name}
              </button>
            );
          })}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.map(t => {
              const on = Array.isArray(deal.tag_ids) && deal.tag_ids.includes(t.id);
              return <button key={t.id} onClick={() => toggleTag(t.id)} className="text-[10px] font-bold rounded-full px-2.5 py-1 border transition-all not-italic" style={on ? { backgroundColor: t.color, color: '#fff', borderColor: t.color } : { color: t.color, borderColor: t.color + '55', backgroundColor: t.color + '11' }}>{t.name}</button>;
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PAINEL ESQUERDO */}
        <div className="space-y-6 lg:col-span-1">
          {/* Detalhes do negócio */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Detalhes do Negócio</h3>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Título</label>
              <input type="text" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500" value={dForm.title} onChange={e => setDForm({ ...dForm, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Valor (R$)</label>
                <input type="number" step="0.01" min="0" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500" value={dForm.value} onChange={e => setDForm({ ...dForm, value: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Previsão</label>
                <input type="date" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500" value={dForm.expected_close_date} onChange={e => setDForm({ ...dForm, expected_close_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Origem do lead</label>
              <input type="text" placeholder="Ex: Indicação, LinkedIn, Evento" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500" value={dForm.source} onChange={e => setDForm({ ...dForm, source: e.target.value })} />
            </div>
            {isAdmin && (
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Proprietário</label>
                <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white" value={dForm.owner_member_id} onChange={e => setDForm({ ...dForm, owner_member_id: e.target.value })}>
                  <option value="">—</option>
                  {members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
            <button disabled={savingDeal} onClick={saveDeal} className="w-full px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50">
              <Save size={14} /> {savingDeal ? 'Salvando...' : 'Salvar detalhes'}
            </button>
          </div>

          {/* Contatos (todos os sócios da empresa) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><User size={13} className="text-amber-600" /> Contatos {contacts.length > 0 && <span className="text-slate-300">({contacts.length})</span>}</h3>
              {(cForm === null || cForm.id) && <button onClick={() => setCForm({ name: '', role_title: '', email: '', phone: '' })} className="text-[9px] font-bold uppercase tracking-wide text-amber-600 hover:text-amber-700 flex items-center gap-1"><Plus size={11} /> Adicionar</button>}
            </div>

            {contacts.length === 0 && cForm === null && <p className="text-xs text-slate-400 italic">Nenhum contato vinculado.</p>}

            <div className="divide-y divide-slate-100">
              {contacts.map((c: any) => {
                const isPrimary = deal?.contact_id === c.id;
                if (cForm?.id === c.id) return (
                  <div key={c.id} className="py-3 first:pt-0 space-y-2">
                    <input type="text" placeholder="Nome" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={cForm.name} onChange={e => setCForm({ ...cForm, name: e.target.value })} />
                    <input type="text" placeholder="Cargo (ex: Decisor, Secretária)" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={cForm.role_title || ''} onChange={e => setCForm({ ...cForm, role_title: e.target.value })} />
                    <input type="text" placeholder="Telefone" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={cForm.phone || ''} onChange={e => setCForm({ ...cForm, phone: e.target.value })} />
                    <input type="email" placeholder="E-mail" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={cForm.email || ''} onChange={e => setCForm({ ...cForm, email: e.target.value })} />
                    <div className="flex gap-2">
                      <button onClick={saveContact} className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Save size={13} /> Salvar</button>
                      <button onClick={() => setCForm(null)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg"><X size={14} /></button>
                    </div>
                  </div>
                );
                return (
                  <div key={c.id} className="py-3 first:pt-0 text-sm text-slate-700 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold italic min-w-0">
                        {isPrimary && <Star size={12} className="inline text-amber-500 fill-amber-500 mr-1 -mt-0.5" />}
                        {c.name}{c.role_title && <span className="text-[10px] not-italic text-slate-400 font-bold uppercase tracking-wide ml-2">{c.role_title}</span>}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => setCForm({ ...c })} title="Editar contato" className="text-slate-300 hover:text-amber-600 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => delContact(c)} title="Excluir contato" className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {c.phone && <a href={waLink(c.phone)} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-emerald-600 w-fit transition-colors"><Phone size={11} /> {c.phone}</a>}
                    {c.email && <a href={mailtoLink(c.email)} className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-amber-600 w-fit transition-colors"><Mail size={11} /> {c.email}</a>}
                    <div className="flex flex-wrap gap-3 pt-1">
                      {c.phone && <button onClick={() => callContact(c)} className="text-[9px] font-bold uppercase tracking-wide text-sky-600 hover:text-sky-700 flex items-center gap-1 not-italic"><Phone size={12} /> Ligar</button>}
                      {c.email && <button onClick={() => openEmail(c)} title={emailConnected ? 'Enviar e-mail pelo Outlook' : 'Abrir no cliente de e-mail'} className="text-[9px] font-bold uppercase tracking-wide text-amber-600 hover:text-amber-700 flex items-center gap-1 not-italic"><Mail size={12} /> E-mail</button>}
                      {c.phone && <a href={waLink(c.phone)} target="_blank" rel="noreferrer" className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 hover:text-emerald-700 flex items-center gap-1 not-italic"><MessageSquare size={12} /> WhatsApp</a>}
                      {!isPrimary && <button onClick={() => setPrimaryContact(c.id)} className="text-[9px] font-bold uppercase tracking-wide text-slate-400 hover:text-amber-600 flex items-center gap-1 not-italic"><Star size={12} /> Tornar principal</button>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formulário de NOVO contato */}
            {cForm && !cForm.id && (
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <input type="text" placeholder="Nome" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={cForm.name} onChange={e => setCForm({ ...cForm, name: e.target.value })} />
                <input type="text" placeholder="Cargo (ex: Decisor, Secretária)" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={cForm.role_title || ''} onChange={e => setCForm({ ...cForm, role_title: e.target.value })} />
                <input type="text" placeholder="Telefone" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={cForm.phone || ''} onChange={e => setCForm({ ...cForm, phone: e.target.value })} />
                <input type="email" placeholder="E-mail" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={cForm.email || ''} onChange={e => setCForm({ ...cForm, email: e.target.value })} />
                <div className="flex gap-2">
                  <button onClick={saveContact} className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Save size={13} /> Adicionar contato</button>
                  <button onClick={() => setCForm(null)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg"><X size={14} /></button>
                </div>
              </div>
            )}
          </div>

          {/* Organização */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><Building2 size={13} className="text-amber-600" /> Empresa</h3>
              {oForm === null && <button onClick={() => setOForm(org ? { ...org } : { name: '', phone: '', address: '' })} className="text-[9px] font-bold uppercase tracking-wide text-amber-600 hover:text-amber-700">{org ? 'Editar' : '+ Adicionar'}</button>}
            </div>
            {oForm === null ? (
              org ? (
                <div className="text-sm text-slate-700 space-y-0.5">
                  <p className="font-bold italic">{org.name}</p>
                  {org.phone && <p className="text-xs flex items-center gap-1.5 text-slate-500"><Phone size={11} /> {org.phone}</p>}
                  {org.address && <p className="text-xs text-slate-500">{org.address}</p>}
                  {(org.city || org.uf) && <p className="text-xs text-slate-500">{[org.city, org.uf].filter(Boolean).join(' / ')}</p>}
                  {org.cnpj && <p className="text-[11px] text-slate-400 font-bold not-italic">CNPJ: {org.cnpj}</p>}
                </div>
              ) : <p className="text-xs text-slate-400 italic">Nenhuma empresa vinculada.</p>
            ) : (
              <div className="space-y-2">
                <input type="text" placeholder="Nome da empresa" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={oForm.name} onChange={e => setOForm({ ...oForm, name: e.target.value })} />
                <input type="text" placeholder="Telefone corporativo" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={oForm.phone || ''} onChange={e => setOForm({ ...oForm, phone: e.target.value })} />
                <input type="text" placeholder="Endereço" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={oForm.address || ''} onChange={e => setOForm({ ...oForm, address: e.target.value })} />
                <div className="flex gap-2">
                  <button onClick={saveOrg} className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Save size={13} /> Salvar</button>
                  <button onClick={() => setOForm(null)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg"><X size={14} /></button>
                </div>
              </div>
            )}
          </div>

          {/* Campos personalizados */}
          {fieldDefs.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Informações adicionais</h3>
              {fieldDefs.map(f => (
                <div key={f.id} className="space-y-1">
                  {f.type !== 'checkbox' && <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{f.label}</label>}
                  {f.type === 'text' && <input type="text" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={customForm[f.id] ?? ''} onChange={e => setCustom(f.id, e.target.value)} />}
                  {f.type === 'number' && <input type="number" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={customForm[f.id] ?? ''} onChange={e => setCustom(f.id, e.target.value)} />}
                  {f.type === 'date' && <input type="date" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={customForm[f.id] ?? ''} onChange={e => setCustom(f.id, e.target.value)} />}
                  {f.type === 'select' && (
                    <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white" value={customForm[f.id] ?? ''} onChange={e => setCustom(f.id, e.target.value)}>
                      <option value="">—</option>
                      {(Array.isArray(f.options) ? f.options : []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                  {f.type === 'checkbox' && (
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={!!customForm[f.id]} onChange={e => setCustom(f.id, e.target.checked)} className="w-4 h-4 accent-amber-600" /> {f.label}
                    </label>
                  )}
                </div>
              ))}
              <button disabled={savingCustom} onClick={saveCustom} className="w-full px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                <Save size={14} /> {savingCustom ? 'Salvando...' : 'Salvar campos'}
              </button>
            </div>
          )}
        </div>

        {/* PAINEL DIREITO — ATIVIDADES / HISTÓRICO */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Registrar atividade / histórico de contato</h3>
            <div className="flex flex-wrap gap-1.5">
              {ACT_TYPES.map(t => {
                const Icon = t.icon; const on = actForm.type === t.v;
                return <button key={t.v} onClick={() => setActForm({ ...actForm, type: t.v })} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 transition-all ${on ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><Icon size={12} /> {t.label}</button>;
              })}
            </div>
            <input type="text" placeholder="Assunto (ex: Liguei para a secretária)" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={actForm.title} onChange={e => setActForm({ ...actForm, title: e.target.value })} />
            <textarea placeholder="Detalhes / resultado do contato" rows={2} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500 resize-y" value={actForm.notes} onChange={e => setActForm({ ...actForm, notes: e.target.value })} />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-slate-400"><Clock size={13} /><input type="datetime-local" className="p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500 text-slate-600" value={actForm.due_at} onChange={e => setActForm({ ...actForm, due_at: e.target.value })} /></div>
              <button disabled={addingAct} onClick={addActivity} className="ml-auto px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50"><Plus size={14} /> {addingAct ? 'Registrando...' : 'Registrar'}</button>
            </div>
          </div>

          <div className="space-y-2">
            {acts.length === 0 && <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center text-sm text-slate-400 italic">Nenhuma atividade registrada ainda.</div>}
            {acts.map(a => {
              const meta = actMeta(a.type); const Icon = meta.icon;
              return (
                <div key={a.id} className={`bg-white p-4 rounded-xl border shadow-sm flex items-start gap-3 ${a.done ? 'border-slate-100 opacity-70' : 'border-slate-200'}`}>
                  <button onClick={() => toggleAct(a)} title={a.done ? 'Reabrir' : 'Concluir'} className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${a.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'}`}>{a.done ? <Check size={14} /> : <Icon size={13} />}</button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">{meta.label}</span>
                      {a.type === 'email' && a.email_direction && <span className={`text-[8px] font-bold uppercase tracking-wide ${a.email_direction === 'in' ? 'text-emerald-600' : 'text-sky-600'}`}>{a.email_direction === 'in' ? '← recebido' : '→ enviado'}</span>}
                      {a.title && <p className={`text-sm font-bold text-slate-800 italic ${a.done ? 'line-through' : ''}`}>{a.title}</p>}
                    </div>
                    {a.notes && <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{a.notes}</p>}
                    {a.recording_id && (
                      <div className="mt-2">
                        {recUrls[a.id]
                          ? <audio controls preload="none" src={recUrls[a.id]} className="w-full h-9" />
                          : <button onClick={() => playRecording(a)} disabled={recLoading === a.id} className="text-[9px] font-bold uppercase tracking-wide text-sky-600 hover:text-sky-700 flex items-center gap-1 not-italic disabled:opacity-50"><Play size={12} /> {recLoading === a.id ? 'Carregando áudio...' : 'Ouvir gravação'}</button>}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                      {a.due_at && <span className="flex items-center gap-1"><Clock size={10} /> {fmtDateTime(a.due_at)}</span>}
                      {a.owner_member_id && <span>{ownerName(a.owner_member_id)}</span>}
                    </div>
                  </div>
                  <button onClick={() => delAct(a)} title="Excluir" className="text-slate-300 hover:text-red-500 transition-colors shrink-0"><Trash2 size={14} /></button>
                </div>
              );
            })}
          </div>

          {/* Changelog auditável */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><History size={13} className="text-amber-600" /> Histórico de alterações</h3>
            {events.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Sem alterações registradas.</p>
            ) : (
              <div className="space-y-2.5">
                {events.map(ev => (
                  <div key={ev.id} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700">{ev.description}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{ev.actor_name || 'Sistema'} • {fmtDateTime(ev.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {lostOpen && (
        <CrmLostModal dealTitle={deal.title} onConfirm={confirmLost} onClose={() => setLostOpen(false)} />
      )}

      {compose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !sendingEmail && setCompose(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase text-slate-600 tracking-widest flex items-center gap-1.5"><Mail size={14} className="text-amber-600" /> Enviar e-mail</h3>
              <button onClick={() => setCompose(null)} className="text-slate-300 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Para</label>
              <input type="email" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={compose.to} onChange={e => setCompose({ ...compose, to: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Assunto</label>
              <input type="text" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={compose.subject} onChange={e => setCompose({ ...compose, subject: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Mensagem</label>
              <textarea rows={7} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500 resize-y" value={compose.body} onChange={e => setCompose({ ...compose, body: e.target.value })} />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] text-slate-400 italic">Sai do seu Outlook e fica no histórico.</span>
              <div className="flex gap-2">
                <button onClick={() => setCompose(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg font-bold text-[10px] uppercase tracking-widest">Cancelar</button>
                <button disabled={sendingEmail} onClick={sendEmail} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"><Mail size={13} /> {sendingEmail ? 'Enviando...' : 'Enviar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
