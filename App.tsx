import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  LayoutDashboard, Calendar, ChevronRight, UserPlus, 
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, 
  Upload, Save, Lock, Target, FileCheck, BarChart3, 
  PieChart as PieIcon, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, Settings, Camera, UserCircle, History, Filter, MessageSquare, Download, ExternalLink, ListChecks, Plus, Edit2, Check, Menu, ChevronUp, ChevronDown, Play, Square, Timer, SkipForward, Building2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// --- CONFIGURAÇÃO SUPABASE ---
const supabaseUrl = 'https://jrtrrubtjbinnddqdbta.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydHJydWJ0amJpbm5kZHFkYnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjU2NjksImV4cCI6MjA4NzEwMTY2OX0.J2DNMhNwGlyG3u7L-kd6gW3NC5-EqVSogXyYchQiVyk';
const supabase = createClient(supabaseUrl, supabaseKey);

const App = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('info');
  const [dashboardFilter, setDashboardFilter] = useState('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);

  const blankMeeting = {
    title: '', status: 'Agendada', date: '', time: '', type: 'Híbrida', link: '', address: '',
    participants: [], pautas: [], materiais: [], deliberacoes: [], acoes: [], atas: []
  };
  const [currentMeeting, setCurrentMeeting] = useState<any>(blankMeeting);
  
  const [editingPart, setEditingPart] = useState<number | null>(null);
  const [tmpPart, setTmpPart] = useState({ name: '', email: '' });
  const [tmpPauta, setTmpPauta] = useState({ title: '', resp: '', dur: '' });
  const [tmpAcao, setTmpAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });
  const [tmpDelib, setTmpDelib] = useState({ title: '', voters: [] as string[] });
  
  // Estado para lançamento global
  const [tmpGlobalAcao, setTmpGlobalAcao] = useState({ title: '', resp: '', date: '', meetingId: '' });

  const [newUserForm, setnewUserForm] = useState({ name: '', email: '', role: 'Conselheiro', password: '', client_id: '' });

  const [activePautaIndex, setActivePautaIndex] = useState<number | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0); 
  const [isSessionActive, setIsSessionActive] = useState(false);

  const isSuper = currentUser?.role === 'SuperAdmin';
  const isAdm = currentUser?.role === 'Administrador' || isSuper;
  const isSec = currentUser?.role === 'Secretário';
  const canEdit = isAdm || isSec;

  useEffect(() => { 
    if (currentUser) fetchInitialData(); 
  }, [currentUser]);

  // --- FUNÇÕES DE UTILIDADE (RESTAURADAS) ---
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const totalEstimatedTime = useMemo(() => {
    return (currentMeeting.pautas || []).reduce((acc: number, p: any) => acc + (parseInt(p.dur) || 0), 0);
  }, [currentMeeting.pautas]);

  // --- LÓGICA DO TIMER ---
  useEffect(() => {
    let timer: any;
    if (isSessionActive && activePautaIndex !== null) {
      timer = setInterval(() => {
        setTimeElapsed(prev => {
          const newVal = prev + 1;
          const pautas = currentMeeting.pautas || [];
          const pautaAtual = pautas[activePautaIndex];
          const limiteSegundos = (parseInt(pautaAtual?.dur) || 0) * 60;
          if (newVal === limiteSegundos) {
            alert(`⚠️ TEMPO LIMITE ATINGIDO: A pauta "${pautaAtual?.title}" ultrapassou o tempo.`);
          }
          return newVal;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSessionActive, activePautaIndex, currentMeeting.pautas]);

  const handleFinalizePauta = (index: number) => {
    const minutesSpent = Math.ceil(timeElapsed / 60);
    const newPautas = [...(currentMeeting.pautas || [])];
    newPautas[index] = { ...newPautas[index], realDur: minutesSpent, completed: true };
    setCurrentMeeting({ ...currentMeeting, pautas: newPautas });
    addLog('Pauta Concluída', `${newPautas[index].title} - Gasto: ${minutesSpent}min`);
    if (index + 1 < newPautas.length) {
      setActivePautaIndex(index + 1);
      setTimeElapsed(0);
    } else {
      setActivePautaIndex(null);
      setTimeElapsed(0);
    }
  };

  // --- API / SUPABASE ---
  const fetchInitialData = async () => {
    setLoading(true);
    try {
        let mQuery = supabase.from('meetings').select('*');
        let uQuery = supabase.from('members').select('*');
        let lQuery = supabase.from('audit_logs').select('*');

        if (!isSuper) {
            mQuery = mQuery.eq('client_id', currentUser.client_id);
            uQuery = uQuery.eq('client_id', currentUser.client_id);
            lQuery = lQuery.eq('client_id', currentUser.client_id);
        }

        const [mRes, uRes, lRes] = await Promise.all([
          mQuery.order('created_at', { ascending: false }),
          uQuery.order('name'),
          lQuery.order('log_date', { ascending: false }).limit(50)
        ]);

        if (mRes.data) setMeetings(mRes.data);
        if (uRes.data) setUsers(uRes.data);
        if (lRes.data) setAuditLogs(lRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const addLog = async (action: string, details: string) => {
    const log = { 
        username: currentUser?.name || 'Sistema', 
        action, details, client_id: currentUser?.client_id 
    };
    await supabase.from('audit_logs').insert([log]);
  };

  const saveMeeting = async () => {
    if (!canEdit) return;
    if (!currentMeeting.title) return alert("Título obrigatório.");
    const meetingData = { ...currentMeeting, client_id: currentUser.client_id };
    if (meetingData.date === "") meetingData.date = null;
    if (!meetingData.id) delete meetingData.id;
    
    const { data, error } = await supabase.from('meetings').upsert([meetingData]).select();
    if (error) return alert("Erro ao salvar: " + error.message);
    if (data) {
      setMeetings(prev => {
        const index = prev.findIndex(m => m.id === data[0].id);
        if (index !== -1) { const newM = [...prev]; newM[index] = data[0]; return newM; }
        return [data[0], ...prev];
      });
      setView('list');
      alert("Sucesso!");
    }
  };

  const deleteMeeting = async (id: string, title: string) => {
    if (!canEdit) return;
    if (!window.confirm(`Excluir "${title}"?`)) return;
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (!error) {
      setMeetings(prev => prev.filter(m => m.id !== id));
      addLog('Exclusão', `Reunião excluída: ${title}`);
    }
  };

  // --- LÓGICA GLOBAL DE AÇÕES ---
  const saveGlobalAction = async () => {
    if (!canEdit) return;
    if (!tmpGlobalAcao.title || !tmpGlobalAcao.meetingId) return alert("Preencha o título e a reunião de origem.");
    
    const targetMeeting = meetings.find(m => m.id === tmpGlobalAcao.meetingId);
    if (!targetMeeting) return;

    const newAction = { 
        id: Date.now(),
        title: tmpGlobalAcao.title,
        resp: tmpGlobalAcao.resp,
        date: tmpGlobalAcao.date,
        status: 'Pendente'
    };

    const updatedActions = [...(targetMeeting.acoes || []), newAction];
    const { error } = await supabase.from('meetings').update({ acoes: updatedActions }).eq('id', targetMeeting.id);

    if (!error) {
      setMeetings(prev => prev.map(m => m.id === targetMeeting.id ? { ...m, acoes: updatedActions } : m));
      setTmpGlobalAcao({ title: '', resp: '', date: '', meetingId: '' });
      alert("Ação vinculada!");
    }
  };

  const updateActionStatusGlobal = async (meetingId: string, actionId: string | number, newStatus: string) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).map((a: any) => a.id === actionId ? { ...a, status: newStatus } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
    }
  };

  const deleteActionGlobal = async (meetingId: string, actionId: string | number) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).filter((a: any) => a.id !== actionId);
    await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
  };

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const filteredM = dashboardFilter === 'all' ? meetings : meetings.filter(m => m.id === dashboardFilter);
    const allA = filteredM.flatMap(m => (m.acoes || []).map((a:any) => ({ ...a, mTitle: m.title, mId: m.id })));
    const atrasadas = allA.filter(a => a.status !== 'Concluída' && a.date && new Date(a.date) < today).length;

    return {
      concluida: `${allA.filter(a => a.status === 'Concluída').length}/${allA.length || 0}`,
      delibs: filteredM.flatMap(m => m.deliberacoes || []).length,
      atas: filteredM.reduce((acc, m) => acc + (m.atas?.length || 0), 0),
      atrasadas,
      allActions: allA,
      pieData: [
        { name: 'Em Andamento', value: allA.filter(a => a.status === 'Em andamento').length, color: '#d97706' }, 
        { name: 'Pendente', value: allA.filter(a => a.status === 'Pendente').length, color: '#94a3b8' }, 
        { name: 'Atrasada', value: atrasadas, color: '#be123c' } 
      ],
      barData: filteredM.slice(0,6).map(m => ({ name: m.date || 'S/D', 'Pautas': m.pautas?.length || 0, 'Ações': m.acoes?.length || 0 }))
    };
  }, [meetings, dashboardFilter]);

  // --- LOGIN UI ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
          <div className="text-center mb-8">
            <img src="/logo-login.jpg" alt="INEPAD" className="h-20 mx-auto mb-4 object-contain" />
            <h1 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Acesso GovCorp</h1>
          </div>
          <form className="space-y-4" onSubmit={async (e)=>{
            e.preventDefault();
            setLoading(true);
            const { data } = await supabase.from('members').select('*').eq('email', authForm.email).eq('password', authForm.password).single();
            if (data) setCurrentUser(data); 
            else alert('Credenciais Inválidas');
            setLoading(false);
          }}>
            <input type="email" placeholder="E-mail Corporativo" className="w-full p-4 bg-slate-50 border rounded-lg font-bold" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} required />
            <input type="password" placeholder="Senha" className="w-full p-4 bg-slate-50 border rounded-lg font-bold" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} required />
            <button className="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-lg font-bold uppercase shadow-md">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden text-slate-800">
      <aside className={`w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl`}>
        <div className="p-10 flex flex-col items-center border-b border-white/5">
            <img src="/logo-sidebar.jpg" alt="INEPAD" className="h-12 w-auto object-contain" />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 text-[10px] font-bold uppercase tracking-widest">
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={18}/>, label: 'Dashboard' },
            { id: 'reunioes', icon: <Calendar size={18}/>, label: 'Conselho', action: () => setView('list') },
            { id: 'plano-acao', icon: <ListChecks size={18}/>, label: 'Plano de Ação' },
            { id: 'usuarios', icon: <UserCog size={18}/>, label: 'Membros', adm: true },
            { id: 'auditoria', icon: <History size={18}/>, label: 'Auditoria', adm: true }
          ].map((item) => (
            (!item.adm || isAdm) && (
              <button key={item.id} onClick={() => { setActiveMenu(item.id); if(item.action) item.action(); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeMenu === item.id ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-slate-700 hover:text-white'}`}>
                {item.icon} {item.label}
              </button>
            )
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
            <button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 font-bold uppercase text-[10px]"><LogOut size={18}/> Sair</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">INEPAD Consultoria • Gestão: {currentUser.client_id}</h2>
          <div className="flex gap-4 items-center">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800">{currentUser.name}</p>
              <p className="text-[10px] font-bold text-amber-600 uppercase">{currentUser.role}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-900 text-amber-500 flex items-center justify-center font-bold">{currentUser.name[0]}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-full text-amber-600 font-bold uppercase animate-pulse italic">Sincronizando...</div>
          ) : (
            <>
              {activeMenu === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-slate-800 italic">Estratégia {currentUser.client_id}</h1>
                    <div className="bg-white px-4 py-2 rounded-lg border flex items-center gap-3 shadow-sm">
                      <Filter size={16} className="text-amber-500"/>
                      <select className="text-xs font-bold uppercase outline-none bg-transparent cursor-pointer" value={dashboardFilter} onChange={e=>setDashboardFilter(e.target.value)}>
                        <option value="all">Geral</option>
                        {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {[ {l:'Concluídas', v:stats.concluida, i:<CheckCircle2/>, c:'amber'}, {l:'Deliberações', v:stats.delibs, i:<FileText/>, c:'slate'}, {l:'Ações', v:stats.allActions.length, i:<ListChecks/>, c:'amber'}, {l:'Em Atraso', v:stats.atrasadas, i:<AlertCircle/>, c:'red'} ].map((s, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-xl border shadow-sm flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${s.c==='amber'?'bg-amber-100 text-amber-600':s.c==='red'?'bg-red-100 text-red-600':'bg-slate-100 text-slate-500'}`}>{s.i}</div>
                          <div><p className="text-[10px] font-bold text-slate-400 uppercase">{s.l}</p><p className="text-2xl font-bold text-slate-800">{s.v}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeMenu === 'reunioes' && (
                view === 'list' ? (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                      <h1 className="text-2xl font-bold text-slate-800 italic">Conselho Deliberativo</h1>
                      {canEdit && <button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="bg-amber-600 text-white px-6 py-3 rounded-lg font-bold text-xs uppercase shadow-md">+ Nova Reunião</button>}
                    </div>
                    <div className="grid gap-4">{meetings.map((m, idx) => (
                      <div key={idx} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-6 rounded-xl border flex justify-between items-center group cursor-pointer hover:border-amber-500 hover:shadow-md transition-all shadow-sm">
                        <div className="flex items-center gap-4"><div className="p-3 bg-slate-100 rounded-lg group-hover:bg-amber-100"><Calendar size={24}/></div><div><h3 className="font-bold text-lg italic group-hover:text-amber-600">{m.title}</h3><p className="text-[10px] font-bold text-slate-400 uppercase">{m.status} • {m.date || 'DATA N/D'}</p></div></div>
                        <div className="flex items-center gap-3">{canEdit && (<button onClick={(e) => { e.stopPropagation(); deleteMeeting(m.id, m.title); }} className="p-3 text-slate-200 hover:text-red-600"><Trash2 size={20}/></button>)}<ChevronRight size={20} className="text-slate-300 group-hover:text-amber-500"/></div>
                      </div>
                    ))}</div>
                  </div>
                ) : (
                  <div className="animate-in fade-in pb-20">
                    <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border shadow-sm sticky top-0 z-10">
                        <button onClick={()=>setView('list')} className="text-xs font-bold uppercase flex items-center gap-2"><ChevronRight className="rotate-180" size={20}/> Voltar</button>
                        {canEdit && <button onClick={saveMeeting} className="bg-slate-800 text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase flex items-center gap-2"><Save size={16} className="text-amber-500"/> Salvar</button>}
                    </div>
                    <input placeholder="Título..." className="text-3xl font-bold italic text-slate-900 bg-transparent outline-none w-full border-b focus:border-amber-500 pb-2 mb-8" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} readOnly={!canEdit} />
                    <div className="border-b flex gap-6 mb-8 overflow-x-auto font-bold text-[10px] uppercase italic py-2">
                      {['Informações', 'Ordem do Dia', 'Plano de Ação'].map((label, i) => {
                        const ids = ['info', 'pauta', 'acoes'];
                        return <button key={i} onClick={()=>setTab(ids[i])} className={`pb-3 transition-all ${tab === ids[i] ? 'text-amber-600 border-b-2 border-amber-600' : 'text-slate-400'}`}>{label}</button>
                      })}
                    </div>

                    {tab === 'pauta' && (
                      <div className="bg-white p-8 rounded-xl border shadow-sm space-y-6">
                        <div className="flex justify-between items-center bg-slate-900 p-6 rounded-xl shadow-lg text-white">
                          <div className="flex items-center gap-4"><div className="p-3 bg-amber-600/20 text-amber-500 rounded-lg"><Timer size={24}/></div><div><p className="text-[10px] font-bold text-slate-400 uppercase">Cronômetro</p><p className="text-2xl font-bold italic">{totalEstimatedTime} min estimados</p></div></div>
                          <button onClick={() => setIsSessionActive(!isSessionActive)} className={`px-6 py-3 rounded-lg font-bold text-xs uppercase flex items-center gap-2 ${isSessionActive ? 'bg-red-500' : 'bg-emerald-600'}`}>{isSessionActive ? <><Square size={16}/> Parar</> : <><Play size={16}/> Iniciar</>}</button>
                        </div>
                        <div className="space-y-2">{(currentMeeting.pautas || []).map((p:any, i:any) => (
                          <div key={i} className={`flex justify-between items-center p-4 border rounded-lg border-l-4 font-bold italic ${activePautaIndex === i ? 'bg-amber-50 border-amber-500' : 'bg-white'}`}>
                            <div><p className="text-sm text-slate-800">{p.title}</p><p className="text-[10px] text-slate-500 font-bold uppercase">{p.resp} • {p.dur} min</p></div>
                            <div className="flex items-center gap-2">{isSessionActive && activePautaIndex === i && (<div className="font-mono text-lg text-amber-600">{formatTime(timeElapsed)}</div>)}{isSessionActive && activePautaIndex === i && <button onClick={() => handleFinalizePauta(i)} className="bg-emerald-600 text-white p-2 rounded-md"><Check size={16}/></button>}{canEdit && <button onClick={()=>setCurrentMeeting({...currentMeeting, pautas: currentMeeting.pautas.filter((_:any, idx:any)=>idx!==i)})}><Trash2 size={18} className="text-slate-200 hover:text-red-500"/></button>}</div>
                          </div>
                        ))}</div>
                      </div>
                    )}
                  </div>
                )
              )}
              
              {activeMenu === 'plano-acao' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-4 rounded-xl border shadow-sm"><h1 className="text-2xl font-bold text-slate-800 italic">Plano Global de Ações</h1></div>

                  {canEdit && (
                    <div className="bg-white p-5 border border-amber-200 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-3">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Iniciativa</label>
                            <input placeholder="Título da Ação" className="w-full p-3 border rounded-lg text-sm font-bold bg-slate-50 outline-none italic" value={tmpGlobalAcao.title} onChange={e=>setTmpGlobalAcao({...tmpGlobalAcao, title: e.target.value})} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsável</label>
                            <select className="w-full p-3 border rounded-lg text-sm font-bold bg-slate-50" value={tmpGlobalAcao.resp} onChange={e=>setTmpGlobalAcao({...tmpGlobalAcao, resp: e.target.value})}>
                                <option value="">Quem?</option>
                                {users.map((u, i) => <option key={i} value={u.name}>{u.name}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-3">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Origem / Reunião</label>
                            <select className="w-full p-3 border rounded-lg text-sm font-bold bg-slate-50" value={tmpGlobalAcao.meetingId} onChange={e=>setTmpGlobalAcao({...tmpGlobalAcao, meetingId: e.target.value})}>
                                <option value="">Vincular a qual Reunião?</option>
                                {meetings.map(m => <option key={m.id} value={m.id}>{m.title} ({m.date})</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-3">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prazo</label>
                            <input type="date" className="w-full p-3 border rounded-lg text-sm font-bold bg-slate-50" value={tmpGlobalAcao.date} onChange={e=>setTmpGlobalAcao({...tmpGlobalAcao, date: e.target.value})} />
                        </div>
                        <div className="md:col-span-1">
                            <button onClick={saveGlobalAction} className="w-full h-[46px] bg-amber-600 text-white rounded-lg flex items-center justify-center shadow-md hover:bg-amber-700 transition-all"><Plus size={24}/></button>
                        </div>
                    </div>
                  )}

                  <div className="bg-white rounded-xl border shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[900px] font-bold italic">
                        <thead className="bg-slate-900 text-[10px] font-bold uppercase text-amber-500 tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Iniciativa</th>
                                <th className="px-6 py-4">Responsável</th>
                                <th className="px-6 py-4">Origem</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                {canEdit && <th className="px-6 py-4 text-center">Gestão</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {stats.allActions.map((acao:any, idx:any) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-all">
                                    <td className="px-6 py-4 text-slate-800">{acao.title}</td>
                                    <td className="px-6 py-4 text-slate-600">{acao.resp || 'N/D'}</td>
                                    <td className="px-6 py-4 text-slate-400 text-[10px] uppercase tracking-widest">{acao.mTitle}</td>
                                    <td className="px-6 py-4 text-center">
                                        <select value={acao.status} onChange={(e) => updateActionStatusGlobal(acao.mId, acao.id, e.target.value)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border-none bg-amber-50 text-amber-700" disabled={!canEdit}>
                                            <option value="Pendente">Aguardando</option>
                                            <option value="Em andamento">Em Execução</option>
                                            <option value="Concluída">Finalizado</option>
                                        </select>
                                    </td>
                                    {canEdit && <td className="px-6 py-4 text-center"><button onClick={() => deleteActionGlobal(acao.mId, acao.id)} className="text-slate-200 hover:text-red-600"><Trash2 size={16}/></button></td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;