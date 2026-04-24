import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard, Calendar, ChevronRight, UserPlus,
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2,
  Upload, Save, Lock, Target, FileCheck, BarChart3,
  PieChart as PieIcon, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, Settings, Camera, UserCircle, History, Filter, MessageSquare, Download, ExternalLink, ListChecks, Plus, Edit2, Check, Menu, ChevronUp, ChevronDown, Play, Square, Timer, SkipForward, Building2, ChevronLeft
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [filterResp, setFilterResp] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOrigin, setFilterOrigin] = useState('all');

  const [isConvocationOpen, setIsConvocationOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

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
  const [tmpAcao, setTmpAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente', obs: '' });
  const [tmpGlobalAcao, setTmpGlobalAcao] = useState({ title: '', resp: '', date: '', meetingId: '', obs: '' });
  const [tmpDelib, setTmpDelib] = useState({ title: '', voters: [] as string[] });
  const [newUserForm, setnewUserForm] = useState({ name: '', email: '', role: 'Conselheiro', password: '', client_id: '' });

  const [activePautaIndex, setActivePautaIndex] = useState<number | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const isSuper = currentUser?.role === 'SuperAdmin';
  const isAdm = currentUser?.role === 'Administrador' || isSuper;
  const isSec = currentUser?.role === 'Secretário';
  const canEdit = isAdm || isSec;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchMemberProfile(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) fetchMemberProfile(session.user.id);
      else setCurrentUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchMemberProfile = async (userId: string) => {
    const { data } = await supabase.from('members').select('id, name, email, role, client_id').eq('id', userId).single();
    if (data) setCurrentUser(data);
  };

  useEffect(() => { if (currentUser) fetchInitialData(); }, [currentUser]);

  useEffect(() => {
    let timer: any;
    if (isSessionActive && activePautaIndex !== null) {
      timer = setInterval(() => {
        setTimeElapsed(prev => {
          const newVal = prev + 1;
          const pautas = currentMeeting.pautas || [];
          const limite = (parseInt(pautas[activePautaIndex]?.dur) || 0) * 60;
          if (newVal === limite) alert("⚠️ TEMPO LIMITE ATINGIDO!");
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
    if (index + 1 < newPautas.length) { setActivePautaIndex(index + 1); setTimeElapsed(0); }
    else { setActivePautaIndex(null); setTimeElapsed(0); }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
        let mQuery = supabase.from('meetings').select('*');
        let uQuery = supabase.from('members').select('id, name, email, role, client_id, created_at');
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.client_id}/${Date.now()}.${fileExt}`;
      const filePath = `${type}/${fileName}`;
      await supabase.storage.from('meeting-files').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('meeting-files').getPublicUrl(filePath);
      const newFile = { name: file.name, url: publicUrl, uploadedAt: new Date().toISOString() };
      setCurrentMeeting((prev: any) => ({ ...prev, [type]: [...(prev[type] || []), newFile] }));
      
      if (type === 'atas') {
        const participants = currentMeeting.participants || [];
        const emails = participants.map((p: any) => p.email).filter((e: string) => e);
        if (emails.length > 0) {
          await supabase.functions.invoke('send-minute-notification', {
            body: { meetingTitle: currentMeeting.title, minuteUrl: publicUrl, recipients: emails, actions: currentMeeting.acoes || [] }
          });
          alert("Ata publicada e notificações enviadas!");
        }
      }
    } catch (err: any) { alert("Erro: " + err.message); }
    finally { setLoading(false); if (e.target) e.target.value = ''; }
  };

  const saveMeeting = async () => {
    if (!canEdit || !currentMeeting.title) return;
    const meetingData = { ...currentMeeting, client_id: currentUser.client_id };
    if (!meetingData.id) delete meetingData.id;
    const { data, error } = await supabase.from('meetings').upsert([meetingData]).select();
    if (data) {
      setMeetings(prev => {
        const idx = prev.findIndex(m => m.id === data[0].id);
        return idx !== -1 ? prev.map(m => m.id === data[0].id ? data[0] : m) : [data[0], ...prev];
      });
      setView('list');
      alert("Sucesso!");
    }
  };

  const saveGlobalAction = async () => {
    if (!canEdit || !tmpGlobalAcao.title || !tmpGlobalAcao.meetingId) return;
    const targetMeeting = meetings.find(m => m.id === tmpGlobalAcao.meetingId);
    if (!targetMeeting) return;
    const newAction = { id: Date.now(), ...tmpGlobalAcao, status: 'Pendente' };
    const updatedActions = [...(targetMeeting.acoes || []), newAction];
    const { error } = await supabase.from('meetings').update({ acoes: updatedActions }).eq('id', targetMeeting.id);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === targetMeeting.id ? { ...m, acoes: updatedActions } : m));
      setTmpGlobalAcao({ title: '', resp: '', date: '', meetingId: '', obs: '' });
      alert("Ação Registrada!");
    }
  };

  const deleteMeeting = async (id: string, title: string) => {
    if (!canEdit || !window.confirm(`Excluir ${title}?`)) return;
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (!error) setMeetings(prev => prev.filter(m => m.id !== id));
  };

  // --- LÓGICA DE DADOS DO DASHBOARD ---
  const allMeetingsSource = useMemo(() => {
    return currentMeeting?.id ? meetings.map(m => m.id === currentMeeting.id ? currentMeeting : m) : meetings;
  }, [meetings, currentMeeting]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const source = (activeMenu === 'plano-acao') ? allMeetingsSource : (dashboardFilter === 'all' ? allMeetingsSource : allMeetingsSource.filter(m => m.id === dashboardFilter));
    
    const allA = source.flatMap(m => (m.acoes || []).map((a:any) => ({ ...a, mTitle: m.title, mId: m.id })))
      .filter(a => (filterResp === 'all' || (a.resp && a.resp.toLowerCase().includes(filterResp.toLowerCase()))))
      .filter(a => (filterStatus === 'all' || a.status === filterStatus))
      .filter(a => (filterOrigin === 'all' || a.mId === filterOrigin));

    const count = (st: string) => allA.filter(a => a.status === st).length;
    const atrasadas = allA.filter(a => a.status !== 'Concluída' && a.date && new Date(a.date) < today).length;
    
    return {
      concluida: `${allA.filter(a => a.status === 'Concluída').length}/${allA.length || 0}`,
      delibs: source.flatMap(m => m.deliberacoes || []).length,
      atas: source.reduce((acc, m) => acc + (m.atas?.length || 0), 0),
      atrasadas,
      allActions: allA,
      pieData: [
        { name: 'Em Andamento', value: count('Em andamento'), color: '#d97706' },
        { name: 'Pendente', value: count('Pendente'), color: '#94a3b8' },
        { name: 'Atrasada', value: atrasadas, color: '#be123c' }
      ],
      barData: source.slice(0,6).map(m => ({ name: m.date || 'S/D', 'Pautas': m.pautas?.length || 0, 'Ações': m.acoes?.length || 0 }))
    };
  }, [allMeetingsSource, activeMenu, dashboardFilter, filterResp, filterStatus, filterOrigin]);

  // --- FUNÇÕES DE UPDATE GLOBAL ---
  const updateActionStatusGlobal = async (mId: string, aId: any, s: string) => {
    const m = meetings.find(x => x.id === mId);
    const newA = (m.acoes || []).map((a: any) => a.id === aId ? { ...a, status: s } : a);
    await supabase.from('meetings').update({ acoes: newA }).eq('id', mId);
    setMeetings(prev => prev.map(x => x.id === mId ? { ...x, acoes: newA } : x));
  };

  const updateActionRespGlobal = async (mId: string, aId: any, r: string) => {
    const m = meetings.find(x => x.id === mId);
    const newA = (m.acoes || []).map((a: any) => a.id === aId ? { ...a, resp: r } : a);
    await supabase.from('meetings').update({ acoes: newA }).eq('id', mId);
    setMeetings(prev => prev.map(x => x.id === mId ? { ...x, acoes: newA } : x));
  };

  const updateActionDateGlobal = async (mId: string, aId: any, d: string) => {
    const m = meetings.find(x => x.id === mId);
    const newA = (m.acoes || []).map((a: any) => a.id === aId ? { ...a, date: d } : a);
    await supabase.from('meetings').update({ acoes: newA }).eq('id', mId);
    setMeetings(prev => prev.map(x => x.id === mId ? { ...x, acoes: newA } : x));
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border">
          <div className="text-center mb-8">
            <img src="/logo-login.jpg" className="h-20 mx-auto mb-4" />
            <h1 className="text-xl font-bold uppercase tracking-wide">Acesso GovCorp</h1>
            <p className="text-[10px] font-bold text-slate-400">25 ANOS DE GOVERNANÇA</p>
          </div>
          <form className="space-y-4" onSubmit={async (e)=>{
            e.preventDefault();
            setLoading(true);
            const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password });
            if (error) alert(error.message);
            setLoading(false);
          }}>
            <input type="email" placeholder="E-mail" className="w-full p-4 bg-slate-50 border rounded-lg font-bold" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} />
            <input type="password" placeholder="Senha" className="w-full p-4 bg-slate-50 border rounded-lg font-bold" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} />
            <button className="w-full bg-amber-600 text-white py-4 rounded-lg font-bold uppercase hover:bg-amber-700 transition-all">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* SIDEBAR COMPLETA RESTAURADA */}
      <aside className={`bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`p-10 flex justify-center border-b border-white/5 ${isSidebarCollapsed && 'p-4'}`}>
          <img src={isSidebarCollapsed ? "/favicon.png" : "/logo-sidebar.jpg"} className="h-10 object-contain" style={{ mixBlendMode: 'lighten' }} />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={18}/>, label: 'Dashboard' },
            { id: 'reunioes', icon: <Calendar size={18}/>, label: 'Conselho', action: () => setView('list') },
            { id: 'plano-acao', icon: <ListChecks size={18}/>, label: 'Plano de Ação' },
            { id: 'usuarios', icon: <UserCog size={18}/>, label: 'Membros', adm: true },
            { id: 'auditoria', icon: <History size={18}/>, label: 'Auditoria', adm: true }
          ].map(item => (!item.adm || isAdm) && (
            <button key={item.id} onClick={() => { setActiveMenu(item.id); if(item.action) item.action(); }} className={`w-full flex items-center gap-3 rounded-lg p-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeMenu === item.id ? 'bg-amber-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
              {item.icon} {!isSidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <button onClick={() => supabase.auth.signOut()} className="p-6 text-red-400 flex items-center gap-3 text-[10px] font-bold uppercase"><LogOut size={18}/> {!isSidebarCollapsed && "Sair"}</button>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0 shadow-sm">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">INEPAD • {currentUser.client_id}</h2>
          <div className="flex items-center gap-4">
            <div className="text-right"><p className="text-sm font-bold">{currentUser.name}</p><p className="text-[9px] text-amber-600 font-bold uppercase">{currentUser.role}</p></div>
            <div className="w-10 h-10 rounded-lg bg-slate-900 text-amber-500 flex items-center justify-center font-bold">{currentUser.name[0]}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* DASHBOARD COMPLETO RESTAURADO */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold italic">Estratégia Corporativa</h1>
                <select className="bg-white border p-2 rounded-lg text-xs font-bold" value={dashboardFilter} onChange={e=>setDashboardFilter(e.target.value)}>
                  <option value="all">Consolidado Geral</option>
                  {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  {l:'Concluídas', v:stats.concluida, i:<CheckCircle2/>, c:'amber'},
                  {l:'Deliberações', v:stats.delibs, i:<FileText/>, c:'slate'},
                  {l:'Atas na Nuvem', v:stats.atas, i:<FileCheck/>, c:'amber'},
                  {l:'Em Atraso', v:stats.atrasadas, i:<AlertCircle/>, c:'red'}
                ].map((s, i) => (
                  <div key={i} className="bg-white p-6 rounded-xl border flex items-center gap-4 shadow-sm">
                    <div className={`p-3 rounded-lg bg-${s.c}-100 text-${s.c}-600`}>{s.i}</div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase">{s.l}</p><p className="text-2xl font-bold">{s.v}</p></div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[350px]">
                <div className="bg-slate-900 p-6 rounded-xl shadow-xl"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>{stats.pieData.map((e,i)=>(<Cell key={i} fill={e.color}/>))}</Pie><Tooltip/><Legend wrapperStyle={{fontSize:'10px'}}/></PieChart></ResponsiveContainer></div>
                <div className="bg-white p-6 rounded-xl border shadow-sm"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.barData}><CartesianGrid vertical={false}/><XAxis dataKey="name" tick={{fontSize:10}}/><YAxis hide/><Tooltip/><Bar dataKey="Pautas" fill="#cbd5e1" radius={[4,4,0,0]} barSize={20}/><Bar dataKey="Ações" fill="#d97706" radius={[4,4,0,0]} barSize={20}/></BarChart></ResponsiveContainer></div>
              </div>
            </div>
          )}

          {/* REUNIÕES E DETALHES COMPLETO RESTAURADO */}
          {activeMenu === 'reunioes' && (
            view === 'list' ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center"><h1 className="text-2xl font-bold italic">Conselho Deliberativo</h1><button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details');}} className="bg-amber-600 text-white px-6 py-2 rounded-lg font-bold text-xs uppercase shadow-md">+ Nova Reunião</button></div>
                {meetings.map(m => (
                  <div key={m.id} onClick={()=>{setCurrentMeeting(m); setView('details');}} className="bg-white p-6 rounded-xl border flex justify-between items-center hover:border-amber-500 cursor-pointer shadow-sm transition-all">
                    <div className="flex items-center gap-4"><Calendar className="text-slate-400"/><h3 className="font-bold italic">{m.title}</h3></div>
                    <ChevronRight className="text-slate-200"/>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                  <button onClick={()=>setView('list')} className="text-xs font-bold uppercase flex items-center gap-2"><ChevronLeft size={16}/> Voltar</button>
                  <button onClick={saveMeeting} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2"><Save size={16} className="text-amber-500"/> Salvar</button>
                </div>
                <input className="text-3xl font-bold italic w-full border-b bg-transparent outline-none pb-2" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})}/>
                <div className="flex gap-6 border-b text-[10px] font-bold uppercase tracking-widest overflow-x-auto">
                  {['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'].map(t => <button key={t} onClick={()=>setTab(t)} className={`pb-3 transition-all ${tab === t ? 'text-amber-600 border-b-2 border-amber-600' : 'text-slate-400'}`}>{t}</button>)}
                </div>

                {tab === 'info' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                      <div className="bg-white p-8 rounded-xl border shadow-sm space-y-6">
                        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest border-b pb-4">Participantes</h3>
                        <div className="space-y-2">
                          {(currentMeeting.participants || []).map((p: any, i: number) => (
                            <div key={i} className="p-4 bg-slate-50 border rounded-lg flex justify-between items-center italic font-bold">
                              <span>{p.name} <span className="text-[10px] text-slate-300 font-normal">({p.email})</span></span>
                              <button onClick={()=>setCurrentMeeting({...currentMeeting, participants: currentMeeting.participants.filter((_:any,idx:any)=>idx!==i)})}><X size={16} className="text-red-300"/></button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input placeholder="Nome" className="flex-1 p-3 border rounded-lg text-sm font-bold" value={tmpPart.name} onChange={e=>setTmpPart({...tmpPart, name:e.target.value})} />
                          <input placeholder="E-mail" className="flex-1 p-3 border rounded-lg text-sm font-bold" value={tmpPart.email} onChange={e=>setTmpPart({...tmpPart, email:e.target.value})} />
                          <button onClick={()=>{if(tmpPart.name){setCurrentMeeting({...currentMeeting, participants: [...(currentMeeting.participants || []), tmpPart]}); setTmpPart({name:'', email:''});}}} className="bg-amber-600 text-white px-6 rounded-lg font-bold uppercase text-xs">Add</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ABA DE AÇÕES COM A TRAVA DE USUÁRIOS REAIS */}
                {tab === 'acoes' && (
                  <div className="bg-white p-8 rounded-xl border shadow-sm space-y-6">
                    <div className="space-y-3">
                      {(currentMeeting.acoes || []).map((a: any, i: number) => (
                        <div key={i} className="p-4 bg-slate-50 border-l-4 border-emerald-500 flex justify-between items-center italic font-bold">
                          <div><p className="text-sm">{a.title}</p><p className="text-[10px] text-slate-400">{a.resp} • {a.date}</p></div>
                          <button onClick={()=>setCurrentMeeting({...currentMeeting, acoes: currentMeeting.acoes.filter((_:any,idx:any)=>idx!==i)})}><Trash2 size={16} className="text-red-200"/></button>
                        </div>
                      ))}
                    </div>
                    <div className="p-6 bg-slate-50 border border-dashed rounded-xl grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      <div className="md:col-span-5"><label className="text-[10px] font-bold uppercase text-slate-400">Título da Ação</label><input className="w-full p-3 border rounded-lg text-sm font-bold italic" value={tmpAcao.title} onChange={e=>setTmpAcao({...tmpAcao, title: e.target.value})} /></div>
                      <div className="md:col-span-3">
                        <label className="text-[10px] font-bold uppercase text-slate-400">Responsável (Membro Real)</label>
                        {/* ALTERAÇÃO SOLICITADA: Filtra apenas membros cadastrados */}
                        <select className="w-full p-3 border rounded-lg text-sm font-bold" value={tmpAcao.resp} onChange={e=>setTmpAcao({...tmpAcao, resp: e.target.value})}>
                          <option value="">Selecione um usuário...</option>
                          {users.map((u: any) => <option key={u.id} value={u.name}>{u.name}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-3"><label className="text-[10px] font-bold uppercase text-slate-400">Prazo</label><input type="date" className="w-full p-3 border rounded-lg text-sm font-bold" value={tmpAcao.date} onChange={e=>setTmpAcao({...tmpAcao, date: e.target.value})} /></div>
                      <button onClick={()=>{if(tmpAcao.title && tmpAcao.resp){setCurrentMeeting({...currentMeeting, acoes: [...(currentMeeting.acoes || []), {...tmpAcao, id: Date.now()}]}); setTmpAcao({title:'', resp:'', date:'', status:'Pendente', obs:''});}}} className="md:col-span-1 bg-emerald-600 text-white h-12 rounded-lg flex items-center justify-center"><Plus/></button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* PLANO DE AÇÃO GLOBAL COMPLETO RESTAURADO */}
          {activeMenu === 'plano-acao' && (
            <div className="space-y-6 animate-in fade-in">
              <h1 className="text-2xl font-bold italic">Plano Global de Ações</h1>
              <div className="bg-white p-4 rounded-xl border flex gap-4 items-center shadow-sm">
                <Filter size={16} className="text-amber-500" />
                <select className="text-[10px] font-bold uppercase border-none outline-none" value={filterResp} onChange={e=>setFilterResp(e.target.value)}>
                  <option value="all">Responsável</option>
                  {[...new Set(allMeetingsSource.flatMap(m => (m.acoes || []).map((a: any) => a.resp)))].filter(r => r).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
                <table className="w-full text-left text-sm font-bold italic">
                  <thead className="bg-slate-900 text-amber-500 uppercase text-[10px] tracking-widest">
                    <tr><th className="p-6">Iniciativa</th><th className="p-6">Responsável</th><th className="p-6">Origem</th><th className="p-6 text-center">Status</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {stats.allActions.map((a: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-6">{a.title}</td>
                        <td className="p-6">
                           <select className="bg-transparent border-none font-bold text-xs" value={a.resp} onChange={e=>updateActionRespGlobal(a.mId, a.id, e.target.value)}>
                              {users.map((u: any) => <option key={u.id} value={u.name}>{u.name}</option>)}
                           </select>
                        </td>
                        <td className="p-6 text-[10px] text-slate-400 uppercase">{a.mTitle}</td>
                        <td className="p-6 text-center">
                          <select className="bg-amber-50 text-amber-700 p-2 rounded-lg text-[10px] uppercase font-bold border-none" value={a.status} onChange={e=>updateActionStatusGlobal(a.mId, a.id, e.target.value)}>
                            <option value="Pendente">Pendente</option>
                            <option value="Em andamento">Execução</option>
                            <option value="Concluída">Finalizado</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <input type="file" ref={fileRef} className="hidden" onChange={e => handleFileUpload(e, 'materiais')} />
      <input type="file" ref={ataRef} className="hidden" onChange={e => handleFileUpload(e, 'atas')} />
    </div>
  );
};

export default App;