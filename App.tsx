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
  const [editingPauta, setEditingPauta] = useState<number | null>(null); 
  const [tmpPart, setTmpPart] = useState({ name: '', email: '' });
  const [tmpPauta, setTmpPauta] = useState({ title: '', resp: '', dur: '' });
  const [tmpAcao, setTmpAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });
  const [tmpDelib, setTmpDelib] = useState({ title: '', voters: [] as string[] });
  const [newUserForm, setnewUserForm] = useState({ name: '', email: '', role: 'Conselheiro', password: '', client_id: '' });

  const [activePautaIndex, setActivePautaIndex] = useState<number | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0); 
  const [isSessionActive, setIsSessionActive] = useState(false);

  // Níveis de Acesso
  const isSuper = currentUser?.role === 'SuperAdmin';
  const isAdm = currentUser?.role === 'Administrador' || isSuper;
  const isSec = currentUser?.role === 'Secretário';
  const canEdit = isAdm || isSec;

  useEffect(() => { if (currentUser) fetchInitialData(); }, [currentUser]);

  // Lógica do Timer Progressivo
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
    addLog('Pauta Concluída', `${newPautas[index].title}`);
    if (index + 1 < newPautas.length) {
      setActivePautaIndex(index + 1);
      setTimeElapsed(0);
    } else {
      setActivePautaIndex(null);
      setTimeElapsed(0);
    }
  };

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
    const log = { username: currentUser?.name || 'Sistema', action, details, client_id: currentUser?.client_id };
    const { data } = await supabase.from('audit_logs').insert([log]).select();
    if (data) setAuditLogs(prev => [data[0], ...prev]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'materiais' | 'atas') => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fileName = `${currentUser.client_id}/${Date.now()}_${file.name}`;
      const filePath = `${type}/${fileName}`;
      await supabase.storage.from('meeting-files').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('meeting-files').getPublicUrl(filePath);
      const newFile = { name: file.name, url: publicUrl, uploadedAt: new Date().toISOString() };
      setCurrentMeeting((prev: any) => ({ ...prev, [type]: [...(prev[type] || []), newFile] }));
    } catch (err: any) { alert("Erro no upload"); }
    finally { setLoading(false); if (e.target) e.target.value = ''; }
  };

  const saveMeeting = async () => {
    if (!canEdit) return;
    if (!currentMeeting.title) return alert("O título é obrigatório.");
    const meetingData = { ...currentMeeting, client_id: currentUser.client_id };
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
      addLog('Salvamento', `Reunião: ${currentMeeting.title}`);
      alert("Sucesso!");
    }
  };

  const deleteMeeting = async (id: string, title: string) => {
    if (!canEdit) return;
    if (!window.confirm(`Deseja excluir "${title}"?`)) return;
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (!error) {
      setMeetings(prev => prev.filter(m => m.id !== id));
      addLog('Exclusão', `Reunião excluída: ${title}`);
    }
  };

  const deleteActionGlobal = async (meetingId: string, actionId: string | number) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).filter((a: any) => a.id !== actionId);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
  };

  const updateActionStatusGlobal = async (meetingId: string, actionId: string | number, newStatus: string) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).map((a: any) => a.id === actionId ? { ...a, status: newStatus } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
  };

  const movePauta = (index: number, direction: 'up' | 'down') => {
    if (!canEdit) return;
    const newPautas = [...(currentMeeting.pautas || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPautas.length) return;
    [newPautas[index], newPautas[targetIndex]] = [newPautas[targetIndex], newPautas[index]];
    setCurrentMeeting({ ...currentMeeting, pautas: newPautas });
  };

  // --- FUNÇÕES QUE ESTAVAM FALTANDO ---
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const totalEstimatedTime = useMemo(() => {
    return (currentMeeting.pautas || []).reduce((acc: number, p: any) => acc + (parseInt(p.dur) || 0), 0);
  }, [currentMeeting.pautas]);

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

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
          <div className="text-center mb-8">
            <img src="/logo-login.jpg" alt="INEPAD" className="h-20 mx-auto mb-4 object-contain" />
            <h1 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Acesso GovCorp</h1>
            <p className="text-xs text-slate-500 mt-2 font-bold">GESTÃO MULTI-CONSELHOS</p>
          </div>
          <form className="space-y-4" onSubmit={async (e)=>{
            e.preventDefault();
            setLoading(true);
            const { data } = await supabase.from('members').select('*').eq('email', authForm.email).eq('password', authForm.password).single();
            if(data) { setCurrentUser(data); addLog('Login', 'Acesso à plataforma'); }
            else alert('Credenciais Inválidas');
            setLoading(false);
          }}>
            <input type="email" placeholder="E-mail" className="w-full p-4 bg-slate-50 border rounded-lg outline-none font-bold" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} />
            <input type="password" placeholder="Senha" className="w-full p-4 bg-slate-50 border rounded-lg outline-none font-bold" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} />
            <button className="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-lg font-bold uppercase transition-all shadow-md">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden text-slate-800">
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl transform transition-transform duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-10 flex flex-col items-center border-b border-white/5">
            <img src="/logo-sidebar.jpg" alt="Logo" className="h-12 object-contain" />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 text-[10px] font-bold uppercase tracking-widest">
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={18}/>, label: 'Dashboard' },
            { id: 'reunioes', icon: <Calendar size={18}/>, label: 'Conselho', action: () => setView('list') },
            { id: 'plano-acao', icon: <ListChecks size={18}/>, label: 'Plano de Ação' },
            { id: 'usuarios', icon: <UserCog size={18}/>, label: isSuper ? 'Gestão de Contas' : 'Membros', adm: true },
            { id: 'auditoria', icon: <History size={18}/>, label: 'Auditoria', adm: true }
          ].map((item) => (
            (!item.adm || isAdm) && (
              <button key={item.id} onClick={() => { setActiveMenu(item.id); if(item.action) item.action(); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeMenu === item.id ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-slate-700 hover:text-white'}`}>
                {item.icon} {item.label}
              </button>
            )
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700/50">
            <button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 text-[10px] font-bold uppercase tracking-widest"><LogOut size={18}/> Sair</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-slate-600" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button>
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {isSuper ? 'Painel Master INEPAD' : `Conselho: ${currentUser.client_id}`}
            </h2>
          </div>
          <div className="flex gap-4 items-center">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800 leading-tight">{currentUser.name}</p>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{currentUser.role}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-900 text-amber-500 flex items-center justify-center font-bold border border-white/10 shadow-lg">{currentUser.name[0]}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-full text-amber-600 font-bold uppercase animate-pulse">Sincronizando...</div>
          ) : (
            <>
              {activeMenu === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Estratégia {currentUser.client_id}</h1>
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                      <Filter size={16} className="text-amber-500"/><select className="text-xs font-bold uppercase outline-none bg-transparent cursor-pointer" value={dashboardFilter} onChange={e=>setDashboardFilter(e.target.value)}>
                        <option value="all">Geral</option>
                        {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {[ {l:'Concluídas', v:stats.concluida, i:<CheckCircle2/>, c:'amber'}, {l:'Deliberações', v:stats.delibs, i:<FileText/>, c:'slate'}, {l:'Atas na Nuvem', v:stats.atas, i:<FileCheck/>, c:'amber'}, {l:'Em Atraso', v:stats.atrasadas, i:<AlertCircle/>, c:'red'} ].map((s, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 hover:shadow-md transition-all">
                          <div className={`p-3 rounded-lg ${s.c==='amber'?'bg-amber-100 text-amber-600':s.c==='red'?'bg-red-100 text-red-600':'bg-slate-100 text-slate-500'}`}>{s.i}</div>
                          <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.l}</p><p className="text-2xl font-bold text-slate-800 mt-1">{s.v}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeMenu === 'reunioes' && (
                view === 'list' ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Conselho Deliberativo</h1>
                      {canEdit && <button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-bold text-xs uppercase shadow-md transition-all">+ Nova Reunião</button>}
                    </div>
                    <div className="grid gap-4">{meetings.map((m, idx) => (
                      <div key={idx} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-6 rounded-xl border border-slate-200 flex justify-between items-center group cursor-pointer hover:border-amber-500 transition-all shadow-sm">
                        <div className="flex items-center gap-4"><div className="p-3 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-amber-100 transition-all"><Calendar size={24}/></div><div><h3 className="font-bold text-lg text-slate-800 italic">{m.title}</h3><p className="text-[10px] font-bold text-slate-400 uppercase">{m.status} • {m.date || 'DATA N/D'} {isSuper && `[CLIENTE: ${m.client_id}]`}</p></div></div>
                        <div className="flex items-center gap-3">{canEdit && <button onClick={(e)=>{e.stopPropagation(); deleteMeeting(m.id, m.title);}} className="p-3 text-slate-200 hover:text-red-600 transition-all"><Trash2 size={20}/></button>}<ChevronRight size={20} className="text-slate-300"/></div>
                      </div>
                    ))}</div>
                  </div>
                ) : (
                  <div className="pb-20">
                    <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-slate-200">
                        <button onClick={()=>setView('list')} className="text-xs font-bold uppercase flex items-center gap-2 tracking-widest"><ChevronRight className="rotate-180" size={20}/> Voltar</button>
                        {canEdit && <button onClick={saveMeeting} className="bg-slate-800 text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase flex items-center gap-2"><Save size={16} className="text-amber-500"/> Salvar</button>}
                    </div>
                    <input placeholder="Título da Reunião..." className="text-3xl font-bold italic text-slate-900 bg-transparent outline-none w-full border-b pb-2 mb-8" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} />
                    
                    <div className="flex gap-6 mb-8 font-bold text-[10px] uppercase tracking-widest italic border-b overflow-x-auto">
                      {['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'].map((id) => (
                        <button key={id} onClick={()=>setTab(id)} className={`pb-3 transition-all ${tab === id ? 'text-amber-600 border-b-2 border-amber-600' : 'text-slate-400'}`}>{id}</button>
                      ))}
                    </div>

                    {tab === 'pauta' && (
                        <div className="bg-white p-8 rounded-xl border shadow-sm space-y-6">
                            <div className="flex justify-between items-center bg-slate-900 p-6 rounded-xl border border-white/10 shadow-lg gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-amber-600/20 text-amber-500 rounded-lg"><Timer size={24}/></div>
                                    <p className="text-2xl font-bold text-white italic">{totalEstimatedTime} <span className="text-sm font-normal text-slate-400">min</span></p>
                                </div>
                                <button onClick={() => { setIsSessionActive(!isSessionActive); if(!isSessionActive) addLog('Início Reunião', currentMeeting.title); }} className={`px-6 py-3 rounded-lg font-bold text-xs uppercase flex items-center gap-2 transition-all shadow-md ${isSessionActive ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white'}`}>
                                    {isSessionActive ? <><Square size={16}/> Parar</> : <><Play size={16}/> Iniciar Reunião</>}
                                </button>
                            </div>
                            {(currentMeeting.pautas || []).map((p:any, i:any) => (
                                <div key={i} className={`flex justify-between items-center p-4 border rounded-lg transition-all border-l-4 font-bold italic ${activePautaIndex === i ? 'bg-amber-50 border-amber-500' : 'bg-white border-slate-200'}`}>
                                    <div><p className="text-sm text-slate-800">{p.title}</p><p className="text-[10px] text-slate-500 font-bold">{p.resp} • {p.dur} min</p></div>
                                    <div className="flex items-center gap-2">
                                        {isSessionActive && activePautaIndex === i && <div className="font-mono text-lg text-amber-600">{formatTime(timeElapsed)}</div>}
                                        {isSessionActive && activePautaIndex === i && <button onClick={() => handleFinalizePauta(i)} className="bg-emerald-600 text-white p-2 rounded-md"><Check size={16}/></button>}
                                        {canEdit && <button onClick={()=>movePauta(i, 'up')} className="p-2 text-slate-400"><ChevronUp size={16}/></button>}
                                        {canEdit && <button onClick={()=>setCurrentMeeting({...currentMeeting, pautas: (currentMeeting.pautas || []).filter((_:any,idx:any)=>idx!==i)})} className="p-2 text-slate-200 hover:text-red-500"><Trash2 size={18}/></button>}
                                    </div>
                                </div>
                            ))}
                            {canEdit && (
                                <div className="p-5 bg-slate-50 rounded-xl border border-dashed grid grid-cols-5 gap-4 items-end">
                                    <div className="col-span-2"><input placeholder="Assunto" className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpPauta.title} onChange={e=>setTmpPauta({...tmpPauta, title:e.target.value})}/></div>
                                    <div><input placeholder="Resp." className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpPauta.resp} onChange={e=>setTmpPauta({...tmpPauta, resp:e.target.value})}/></div>
                                    <div><input placeholder="Tempo" className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpPauta.dur} onChange={e=>setTmpPauta({...tmpPauta, dur:e.target.value})}/></div>
                                    <button onClick={()=>{if(tmpPauta.title){setCurrentMeeting({...currentMeeting, pautas:[...(currentMeeting.pautas || []), tmpPauta]}); setTmpPauta({title:'', resp:'', dur:''});}}} className="h-12 bg-amber-600 text-white rounded-lg flex items-center justify-center shadow-md"><Plus size={24}/></button>
                                </div>
                            )}
                        </div>
                    )}
                  </div>
                )
              )}

              {activeMenu === 'usuarios' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-4 rounded-xl border shadow-sm"><h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">{isSuper ? 'Gestão de Contas de Clientes' : 'Membros do Conselho'}</h1></div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <div className="bg-slate-900 p-8 rounded-2xl shadow-xl space-y-4 h-fit border border-white/5">
                      <h3 className="text-[10px] font-bold uppercase text-amber-500 border-b border-white/5 pb-3 tracking-widest">{isSuper ? 'Nova Empresa' : 'Novo Membro'}</h3>
                      <div><label className="text-[10px] font-bold text-slate-500 uppercase">Nome</label><input className="w-full p-3 bg-slate-800 text-white rounded-lg outline-none font-bold" value={newUserForm.name} onChange={e=>setnewUserForm({...newUserForm, name: e.target.value})} /></div>
                      <div><label className="text-[10px] font-bold text-slate-500 uppercase">E-mail</label><input className="w-full p-3 bg-slate-800 text-white rounded-lg outline-none font-bold" value={newUserForm.email} onChange={e=>setnewUserForm({...newUserForm, email: e.target.value})} /></div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Perfil</label>
                        <select className="w-full p-3 bg-slate-800 text-white rounded-lg font-bold" value={newUserForm.role} onChange={e=>setnewUserForm({...newUserForm, role: e.target.value})}>
                          <option value="Conselheiro">Conselheiro</option>
                          <option value="Secretário">Secretário</option>
                          <option value="Administrador">Administrador</option>
                          {isSuper && <option value="SuperAdmin">SuperAdmin (INEPAD)</option>}
                        </select>
                      </div>
                      <div><label className="text-[10px] font-bold text-slate-500 uppercase">Senha</label><input type="password" className="w-full p-3 bg-slate-800 text-white rounded-lg outline-none font-bold" value={newUserForm.password} onChange={e=>setnewUserForm({...newUserForm, password: e.target.value})} /></div>
                      <div>
                        <label className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-2"><Building2 size={12}/> Identificador do Cliente</label>
                        <input placeholder={isSuper ? "Ex: Coca-Cola" : "Auto"} className="w-full p-3 bg-slate-800 text-white rounded-lg outline-none font-bold border border-amber-500/30" value={isSuper ? newUserForm.client_id : (newUserForm.client_id || currentUser.client_id)} onChange={e=>setnewUserForm({...newUserForm, client_id: e.target.value})} readOnly={!isSuper} />
                      </div>
                      <button onClick={async ()=>{ 
                        const payload = { ...newUserForm, client_id: isSuper ? newUserForm.client_id : currentUser.client_id };
                        const {data, error} = await supabase.from('members').insert([payload]).select(); 
                        if(!error) { setUsers([...users, data[0]]); alert("Sucesso!"); }
                        else alert("Erro ao criar.");
                      }} className="w-full py-3 bg-amber-600 text-white rounded-lg font-bold uppercase transition-all">Habilitar</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <input type="file" ref={fileRef} className="hidden" onChange={(e) => handleFileUpload(e, 'materiais')} />
      <input type="file" ref={ataRef} className="hidden" onChange={(e) => handleFileUpload(e, 'atas')} />
    </div>
  );
};

export default App;

// TRIGGER DE PRODUÇÃO: Versão 2.2 - Multi-Tenant Estabilizado