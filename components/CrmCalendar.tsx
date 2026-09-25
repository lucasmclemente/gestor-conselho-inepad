import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChevronLeft, ChevronRight, CalendarDays, Phone, Users, Mail, MessageSquare, CheckSquare, FileText } from 'lucide-react';

type Props = { cid: string; currentUser: any; members: any[]; isAdmin: boolean; onBack: () => void; onOpenDeal: (id: string) => void };

const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hhmm = (s: string) => { try { return new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const TYPE_META: Record<string, { Icon: any; cls: string }> = {
  call: { Icon: Phone, cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  meeting: { Icon: Users, cls: 'bg-violet-100 text-violet-700 border-violet-200' },
  email: { Icon: Mail, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  whatsapp: { Icon: MessageSquare, cls: 'bg-green-100 text-green-700 border-green-200' },
  task: { Icon: CheckSquare, cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  note: { Icon: FileText, cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const CrmCalendar: React.FC<Props> = ({ cid, currentUser, members, isAdmin, onBack, onOpenDeal }) => {
  const nameOf = (id: string | null) => !id ? '' : (members.find((m: any) => m.id === id)?.name || (id === currentUser?.id ? currentUser?.name : ''));
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [tasks, setTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState<'mine' | 'all'>(isAdmin ? 'all' : 'mine');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const { data } = await supabase.from('crm_activities')
      .select('id, type, title, due_at, end_at, done, owner_member_id, assignees, deal_id, deal:crm_deals(title)')
      .eq('client_id', cid).not('due_at', 'is', null)
      .gte('due_at', start.toISOString()).lt('due_at', end.toISOString())
      .order('due_at', { ascending: true }).limit(3000);
    setTasks(data || []);
    setLoading(false);
  }, [cid, cursor]);
  useEffect(() => { load(); }, [load]);

  const mine = (t: any) => (Array.isArray(t.assignees) && t.assignees.includes(currentUser?.id)) || t.owner_member_id === currentUser?.id;
  const visible = useMemo(() => filter === 'mine' ? tasks.filter(mine) : tasks, [tasks, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const t of visible) { const k = key(new Date(t.due_at)); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
    return m;
  }, [visible]);

  // grade do mês (6 semanas)
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startDow = first.getDay();
    const gridStart = new Date(first); gridStart.setDate(1 - startDow);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d; });
  }, [cursor]);
  const todayKey = key(new Date());

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1 mb-2"><ChevronLeft size={14} /> Voltar ao funil</button>
          <h2 className="text-2xl font-bold text-slate-800 italic flex items-center gap-2"><CalendarDays size={22} className="text-amber-600" /> Agenda</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Atividades agendadas do CRM</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <div className="flex rounded-lg overflow-hidden border border-slate-200">
              <button onClick={() => setFilter('mine')} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${filter === 'mine' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Minhas</button>
              <button onClick={() => setFilter('all')} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${filter === 'all' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Todas</button>
            </div>
          )}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-2 text-slate-500 hover:text-amber-600"><ChevronLeft size={16} /></button>
            <span className="text-sm font-bold text-slate-700 italic min-w-[140px] text-center">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</span>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-2 text-slate-500 hover:text-amber-600"><ChevronRight size={16} /></button>
          </div>
          <button onClick={() => setCursor(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-bold uppercase tracking-widest">Hoje</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100">
          {WD.map(d => <div key={d} className="p-2 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">{d}</div>)}
        </div>
        {loading ? (
          <div className="h-72 flex items-center justify-center text-amber-600 font-bold uppercase animate-pulse">Carregando...</div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              const k = key(d);
              const list = byDay.get(k) || [];
              return (
                <div key={i} className={`min-h-[104px] border-b border-r border-slate-100 p-1.5 flex flex-col gap-1 ${inMonth ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <span className={`text-[11px] font-bold self-end w-6 h-6 flex items-center justify-center rounded-full ${k === todayKey ? 'bg-amber-600 text-white' : inMonth ? 'text-slate-500' : 'text-slate-300'}`}>{d.getDate()}</span>
                  {list.slice(0, 4).map((t: any) => {
                    const meta = TYPE_META[t.type] || TYPE_META.task;
                    return (
                      <button key={t.id} onClick={() => t.deal_id && onOpenDeal(t.deal_id)} title={`${hhmm(t.due_at)}${t.end_at ? '–' + hhmm(t.end_at) : ''} · ${t.title || t.type} · ${t.deal?.title || ''} · ${(Array.isArray(t.assignees) && t.assignees.length ? t.assignees : (t.owner_member_id ? [t.owner_member_id] : [])).map(nameOf).filter(Boolean).join(', ')}`}
                        className={`w-full text-left rounded px-1.5 py-1 border text-[10px] font-bold flex items-center gap-1 truncate transition-all hover:shadow-sm ${meta.cls} ${t.done ? 'opacity-50 line-through' : ''}`}>
                        <meta.Icon size={10} className="shrink-0" />
                        <span className="tabular-nums shrink-0">{hhmm(t.due_at)}</span>
                        <span className="truncate">{t.title || t.deal?.title || 'Atividade'}</span>
                      </button>
                    );
                  })}
                  {list.length > 4 && <span className="text-[9px] font-bold text-slate-400 pl-1">+{list.length - 4} mais</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-400 italic px-1">Mostra as atividades com data agendada. Clique numa atividade para abrir o negócio. {isAdmin ? '"Minhas" mostra só as suas; "Todas" mostra as da equipe.' : 'Você vê as atividades atribuídas a você ou dos seus negócios.'}</p>
    </div>
  );
};
