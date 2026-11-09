import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { GitBranch, ChevronDown, X, Plus, Paperclip, FileText } from 'lucide-react';

// Subtarefas de uma ação do plano (meetings.acoes[i].subtasks[]) + anexos de contexto.
// Toda mutação passa pela Edge Function manage-subtask (service role), que autoriza:
//   • supervisor do tenant ou responsável da AÇÃO-mãe → tudo (canEditParent)
//   • responsável da SUBTAREFA → muda status e sobe/remove anexos da sua subtarefa
const STATUS_CHIP = (s: string) => s === 'Concluída' ? 'bg-emerald-100 text-emerald-700' : s === 'Em andamento' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';
const nextStatus = (s: string) => s === 'Pendente' ? 'Em andamento' : s === 'Em andamento' ? 'Concluída' : 'Pendente';

export const SubtaskList: React.FC<{
  meetingId: string;
  action: any;
  participants?: any[];
  currentUser: any;
  canEditParent: boolean;          // supervisor OU responsável da ação-mãe
  onChanged: (updatedAction: any) => void;
  compact?: boolean;
  defaultOpen?: boolean;
}> = ({ meetingId, action, participants = [], currentUser, canEditParent, onChanged, compact, defaultOpen }) => {
  const subs = action.subtasks || [];
  const done = subs.filter((s: any) => s.status === 'Concluída').length;
  const [open, setOpen] = useState<boolean>(defaultOpen ?? subs.length > 0);
  const [form, setForm] = useState({ title: '', resp: '', date: '' });
  const [busy, setBusy] = useState(false);
  const myName = currentUser?.name;

  const call = async (payload: any) => {
    const { data, error } = await supabase.functions.invoke('manage-subtask', { body: { meetingId, actionId: action.id, ...payload } });
    if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error);
    return data as any;
  };
  const run = async (payload: any) => {
    setBusy(true);
    try { const d = await call(payload); if (d?.action) onChanged(d.action); }
    catch (e: any) { alert('Erro na subtarefa: ' + (e?.message || e)); }
    finally { setBusy(false); }
  };
  const addSub = async () => { if (!form.title.trim()) return; await run({ op: 'add', subtask: form }); setForm({ title: '', resp: '', date: '' }); };
  const openAttachment = async (subtaskId: string, path: string) => {
    try { const d = await call({ op: 'signDownload', subtaskId, path }); if (d?.url) window.open(d.url, '_blank'); }
    catch (e: any) { alert('Erro ao abrir: ' + (e?.message || e)); }
  };
  const uploadAttachment = async (subtaskId: string, file: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const su = await call({ op: 'signUpload', subtaskId, name: file.name });
      const up = await supabase.storage.from('meeting-files').uploadToSignedUrl(su.path, su.token, file);
      if (up.error) throw new Error(up.error.message);
      const d = await call({ op: 'attach', subtaskId, name: file.name, path: su.path });
      if (d?.action) onChanged(d.action);
    } catch (e: any) { alert('Erro ao anexar: ' + (e?.message || e)); }
    finally { setBusy(false); }
  };

  if (subs.length === 0 && !canEditParent) return null;
  const tiny = compact ? 'text-[10px]' : 'text-xs';
  const ic = compact ? 11 : 13;
  return (
    <div className="mt-2 pt-2 border-t border-slate-100 not-italic font-normal">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-amber-600">
        <GitBranch size={compact ? 10 : 12} /> Subtarefas {subs.length > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${done === subs.length ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{done}/{subs.length}</span>}
        <ChevronDown size={compact ? 10 : 12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 pl-2.5 border-l-2 border-slate-100">
          {subs.map((s: any) => {
            const canEditThis = canEditParent || s.resp === myName;
            const mats = s.materiais || [];
            return (
              <div key={s.id}>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => canEditThis && run({ op: 'update', subtaskId: s.id, patch: { status: nextStatus(s.status) } })} disabled={busy || !canEditThis} title={canEditThis ? 'Clique para avançar o status' : undefined} className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_CHIP(s.status)}`}>{s.status}</button>
                  <span className={`flex-1 ${tiny} min-w-0 truncate ${s.status === 'Concluída' ? 'line-through text-slate-400' : 'text-slate-700'}`}>{s.title}</span>
                  {s.resp && <span className="text-[9px] text-slate-400 shrink-0 hidden sm:inline">{s.resp}</span>}
                  {s.date && <span className="text-[9px] text-slate-400 shrink-0 hidden sm:inline">{new Date(s.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                  {canEditThis && (
                    <label className="text-slate-300 hover:text-amber-600 shrink-0 cursor-pointer" title="Anexar contexto">
                      <Paperclip size={ic} />
                      <input type="file" className="hidden" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) uploadAttachment(s.id, f); (e.target as HTMLInputElement).value = ''; }} />
                    </label>
                  )}
                  {canEditParent && <button onClick={() => run({ op: 'remove', subtaskId: s.id })} disabled={busy} className="text-slate-300 hover:text-red-500 shrink-0" title="Remover subtarefa"><X size={ic} /></button>}
                </div>
                {mats.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 pl-1">
                    {mats.map((mat: any) => (
                      <span key={mat.id} className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                        <button onClick={() => openAttachment(s.id, mat.path)} className="flex items-center gap-1 text-[9px] text-slate-600 hover:text-amber-600 max-w-[150px] truncate" title={mat.name}><FileText size={10} className="shrink-0 text-amber-500" />{mat.name}</button>
                        {canEditThis && <button onClick={() => run({ op: 'detach', subtaskId: s.id, attId: mat.id })} disabled={busy} className="text-slate-300 hover:text-red-500 shrink-0" title="Remover anexo"><X size={9} /></button>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {canEditParent && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') addSub(); }} placeholder="Nova subtarefa" className={`flex-1 min-w-[110px] ${tiny} border border-slate-200 rounded px-2 py-1 outline-none focus:border-amber-400`} />
              <input list={`dls-${action.id}`} value={form.resp} onChange={e => setForm({ ...form, resp: e.target.value })} placeholder="Resp." className={`w-24 ${tiny} border border-slate-200 rounded px-2 py-1 outline-none focus:border-amber-400`} />
              <datalist id={`dls-${action.id}`}>{participants.map((p: any, pi: number) => <option key={pi} value={p.name} />)}</datalist>
              {!compact && <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={`${tiny} border border-slate-200 rounded px-2 py-1 outline-none focus:border-amber-400 text-slate-500`} />}
              <button disabled={busy || !form.title.trim()} onClick={addSub} className="text-[9px] font-bold uppercase tracking-wider bg-slate-900 text-amber-500 hover:bg-slate-800 px-2.5 py-1 rounded disabled:opacity-40 flex items-center gap-1"><Plus size={11} />{compact ? '' : 'Add'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
