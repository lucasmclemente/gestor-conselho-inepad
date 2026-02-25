import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  LayoutDashboard, Calendar, ChevronRight, UserPlus, 
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, 
  Upload, Save, Lock, Target, FileCheck, BarChart3, 
  PieChart as PieIcon, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, Settings, Camera, UserCircle, History, Filter, MessageSquare, Download, ExternalLink, ListChecks, Plus, Edit2, Check, Menu
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
  const [loading, setLoading] = useState(true);
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
  const [newUserForm, setnewUserForm] = useState({ name: '', email: '', role: 'Conselheiro', password: '' });

  const isAdm = currentUser?.role === 'Administrador';

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    const [mRes, uRes, lRes] = await Promise.all([
      supabase.from('meetings').select('*').order('created_at', { ascending: false }),
      supabase.from('members').select('*').order('name'),
      supabase.from('audit_logs').select('*').order('log_date', { ascending: false }).limit(50)
    ]);
    if (mRes.data) setMeetings(mRes.data);
    if (uRes.data) setUsers(uRes.data);
    if (lRes.data) setAuditLogs(lRes.data);
    setLoading(false);
  };

  const addLog = async (action: string, details: string) => {
    const log = { username: currentUser?.name || 'Sistema', action, details };
    const { data } = await supabase.from('audit_logs').insert([log]).select();
    if (data) setAuditLogs(prev => [data[0], ...prev]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'materiais' | 'atas') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `${type}/${fileName}`;
      await supabase.storage.from('meeting-files').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('meeting-files').getPublicUrl(filePath);
      const newFile = { name: file.name, url: publicUrl, uploadedAt: new Date().toISOString() };
      setCurrentMeeting((prev: any) => ({ ...prev, [type]: [...(prev[type] || []), newFile] }));
      addLog('Upload', `Arquivo ${file.name} em ${type}`);
    } catch (err: any) { alert("Erro: " + err.message); }
    finally { setLoading(false); if (e.target) e.target.value = ''; }
  };

  const saveMeeting = async () => {
    if (!currentMeeting.title) return alert("O título é obrigatório.");
    const meetingData = { ...currentMeeting };
    
    // CORREÇÃO DATA (Evita o erro de sintaxe do Postgres)
    if (meetingData.date === "") meetingData.date = null;
    if (meetingData.time === "") meetingData.time = null;
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
      alert("Sessão salva com sucesso!");
    }
  };

  const updateActionStatusGlobal = async (meetingId: string, actionId: string | number, newStatus: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = meeting.acoes.map((a: any) => a.id === actionId ? { ...a, status: newStatus } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
      addLog('Status', `Ação atualizada para ${newStatus}`);
    }
  };

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const filteredM = dashboardFilter === 'all' ? meetings : meetings.filter(m => m.id === dashboardFilter);
    const allA = filteredM.flatMap(m => (m.acoes || []).map((a:any) => ({ ...a, mTitle: m.title, mId: m.id })));
    const count = (st: string) => allA.filter(a => a.status === st).length;
    const atrasadas = allA.filter(a => a.status !== 'Concluída' && a.date && new Date(a.date) < today).length;

    return {
      concluida: `${allA.filter(a => a.status === 'Concluída').length}/${allA.length || 0}`,
      delibs: filteredM.flatMap(m => m.deliberacoes || []).length,
      atas: filteredM.reduce((acc, m) => acc + (m.atas?.length || 0), 0),
      atrasadas,
      allActions: allA,
      pieData: [
        { name: 'Em Andamento', value: count('Em andamento'), color: '#d97706' }, 
        { name: 'Pendente', value: count('Pendente'), color: '#94a3b8' }, 
        { name: 'Atrasada', value: atrasadas, color: '#be123c' } 
      ],
      barData: filteredM.slice(0,6).map(m => ({ name: m.date || 'S/D', 'Pautas': m.pautas?.length || 0, 'Ações': m.acoes?.length || 0 }))
    };
  }, [meetings, dashboardFilter]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-10 border border-slate-100">
          <div className="text-center mb-10">
            <img src="/logo-login.jpg" alt="INEPAD" className="h-24 mx-auto mb-6 object-contain" />
            <h1 className="text-xl font-bold text-slate-800 uppercase tracking-[0.2em]">GovCorp</h1>
            <div className="h-1 w-12 bg-amber-500 mx-auto mt-2 rounded-full"></div>
          </div>
          <form className="space-y-5" onSubmit={(e)=>{e.preventDefault(); const u = users.find(u=>u.email===authForm.email && u.password===authForm.password); if(u){setCurrentUser(u); addLog('Login','Acesso');}else alert('Acesso Negado');}}>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Usuário</label>
              <input type="email" placeholder="nome@inepad.com.br" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold focus:border-amber-500 transition-all" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Senha</label>
              <input type="password" placeholder="••••••••" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold focus:border-amber-500 transition-all" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} />
            </div>
            <button className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-bold uppercase shadow-lg transition-all tracking-widest mt-4">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden text-slate-800">
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      
      {/* SIDEBAR REFINADA - INTEGRAÇÃO LUXO */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl transform transition-transform duration-500 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="p-10 flex flex-col items-center justify-center border-b border-white/5 bg-slate-900/30">
            <img 
              src="/logo-sidebar.jpg" 
              alt="INEPAD Logo" 
              className="h-14 w-auto object-contain brightness-110 contrast-125" 
              style={{ mixBlendMode: 'lighten' }}
            />
        </div>

        <nav className="flex-1 px-4 py-8 space-y-1 text-[10px] font-bold uppercase tracking-[0.2em]">
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={18}/>, label: 'Dashboard' },
            { id: 'reunioes', icon: <Calendar size={18}/>, label: 'Reuniões', action: () => setView('list') },
            { id: 'plano-acao', icon: <ListChecks size={18}/>, label: 'Plano Global' },
            { id: 'usuarios', icon: <UserCog size={18}/>, label: 'Membros', adm: true },
            { id: 'auditoria', icon: <History size={18}/>, label: 'Compliance', adm: true }
          ].map((item) => (
            (!item.adm || isAdm) && (
              <button 
                key={item.id} 
                onClick={() => { setActiveMenu(item.id); if(item.action) item.action(); setIsMobileMenuOpen(false); }} 
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-300 ${activeMenu === item.id ? 'bg-amber-600 text-white shadow-xl shadow-amber-900/40' : 'hover:bg-slate-800 hover:text-white'}`}
              >
                <span className={activeMenu === item.id ? 'text-white' : 'text-amber-500'}>{item.icon}</span>
                {item.label}
              </button>
            )
          ))}
        </nav>

        <div className="p-6 border-t border-white/5">
            <button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all text-[10px] font-bold uppercase tracking-widest">
              <LogOut size={18}/> Sair
            </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* HEADER CLEAN */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-lg" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button>
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Portal de Governança Corporativa</h2>
          </div>
          <div className="flex gap-4 items-center">
            <div className="text-right hidden xs:block">
              <p className="text-sm font-bold text-slate-800 leading-tight">{currentUser.name}</p>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{currentUser.role}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-500 flex items-center justify-center font-bold border border-white/10 shadow-lg">{currentUser.name[0]}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-full text-amber-600 font-bold uppercase animate-pulse tracking-widest">Sincronizando...</div>
          ) : (
            <>
              {activeMenu === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight italic">Estratégia INEPAD</h1>
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 w-full sm:w-auto shadow-sm">
                      <Filter size={16} className="text-amber-500"/><select className="text-[10px] font-bold uppercase outline-none bg-transparent w-full cursor-pointer text-slate-600 tracking-wider" value={dashboardFilter} onChange={e=>setDashboardFilter(e.target.value)}>
                        <option value="all">CONSOLIDADO GERAL</option>
                        {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[ {l:'Concluídas', v:stats.concluida, i:<CheckCircle2/>, c:'amber'}, {l:'Deliberações', v:stats.delibs, i:<FileText/>, c:'slate'}, {l:'Atas na Nuvem', v:stats.atas, i:<FileCheck/>, c:'amber'}, {l:'Em Atraso', v:stats.atrasadas, i:<AlertCircle/>, c:'red'} ].map((s, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
                          <div className={`p-4 rounded-xl ${s.c==='amber'?'bg-amber-50 text-amber-600':s.c==='red'?'bg-red-50 text-red-600':'bg-slate-50 text-slate-500'}`}>{s.i}</div>
                          <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.l}</p><p className="text-2xl font-bold text-slate-900 mt-1">{s.v}</p></div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[350px]">
                    <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col h-full"><h3 className="text-[10px] font-bold uppercase text-amber-500 mb-6 tracking-[0.2em] italic">Health Check de Ações</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>{stats.pieData.map((e,i)=>(<Cell key={i} fill={e.color} stroke="none"/>))}</Pie><Tooltip contentStyle={{borderRadius:'12px', border:'none', fontWeight:'bold'}}/><Legend wrapperStyle={{fontSize:'10px', textTransform:'uppercase', fontStyle:'italic'}}/></PieChart></ResponsiveContainer></div></div>
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-full"><h3 className="text-[10px] font-bold uppercase text-slate-400 mb-6 tracking-[0.2em] italic">Evolução de Entrega</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.barData}><CartesianGrid vertical={false} stroke="#f1f5f9"/><XAxis dataKey="name" tick={{fontSize:10, fontWeight:700}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip/><Bar dataKey="Pautas" fill="#cbd5e1" radius={[4,4,0,0]} barSize={20}/><Bar dataKey="Ações" fill="#d97706" radius={[4,4,0,0]} barSize={20}/></BarChart></ResponsiveContainer></div></div>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 flex justify-between items-center border-b border-slate-50 bg-slate-50/30"><h3 className="text-[10px] font-bold uppercase text-slate-800 flex items-center gap-3 tracking-widest"><ListChecks size={18} className="text-amber-600"/> Prioridades do Conselho</h3></div>
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm min-w-[600px]"><thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-400 tracking-[0.15em] border-b"><tr><th className="px-8 py-4">Iniciativa</th><th className="px-8 py-4">Liderança</th><th className="px-8 py-4 text-center">Status</th></tr></thead><tbody className="divide-y divide-slate-50 font-bold italic">{stats.allActions.slice(0, 5).map((acao, idx) => (<tr key={idx} className="hover:bg-slate-50 transition-all"><td className="px-8 py-5 text-slate-800">{acao.title}</td><td className="px-8 py-5 text-slate-400 text-[10px] uppercase tracking-wider">{acao.resp}</td><td className="px-8 py-5 text-center"><span className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${acao.status === 'Concluída' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}>{acao.status}</span></td></tr>))}</tbody></table></div>
                  </div>
                </div>
              )}

              {activeMenu === 'reunioes' && (
                view === 'list' ? (
                  <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <h1 className="text-2xl font-bold text-slate-900 tracking-tight italic">Sessões de Conselho</h1>
                      <button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white px-8 py-4 rounded-2xl font-bold text-xs uppercase shadow-xl shadow-amber-900/20 transition-all tracking-widest">+ Nova Reunião</button>
                    </div>
                    <div className="grid gap-4">{meetings.map((m, idx) => (
                      <div key={idx} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-7 rounded-3xl border border-slate-100 flex justify-between items-center group cursor-pointer hover:border-amber-500 hover:shadow-lg transition-all shadow-sm">
                        <div className="flex items-center gap-6"><div className="p-4 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-amber-50 group-hover:text-amber-700 transition-all"><Calendar size={28}/></div><div><h3 className="font-bold text-xl text-slate-800 group-hover:text-amber-600 transition-all italic">{m.title}</h3><p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] mt-1">{m.status} • {m.date || 'DATA NÃO DEFINIDA'}</p></div></div>
                        <ChevronRight size={24} className="text-slate-200 group-hover:text-amber-500 transition-all"/>
                      </div>
                    ))}</div>
                  </div>
                ) : (
                  <div className="animate-in fade-in duration-500 pb-20">
                    <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <button onClick={()=>setView('list')} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"><ChevronRight className="rotate-180" size={20}/> Histórico</button>
                        <button onClick={saveMeeting} className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold text-[10px] uppercase shadow-xl flex items-center gap-3 transition-all tracking-widest"><Save size={18} className="text-amber-500"/> Gravar Dados</button>
                    </div>
                    
                    <input placeholder="Título da Sessão..." className="text-3xl md:text-5xl font-bold italic text-slate-900 bg-transparent outline-none w-full border-b-2 border-slate-100 focus:border-amber-500 pb-4 mb-10 transition-all" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} />
                    
                    <div className="border-b border-slate-100 flex gap-10 mb-10 overflow-x-auto font-bold text-[10px] uppercase tracking-[0.2em] no-scrollbar italic py-2">
                      {['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Plano de Ação', 'Atas'].map((label, i) => {
                        const ids = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'];
                        return <button key={i} onClick={()=>setTab(ids[i])} className={`pb-4 transition-all relative whitespace-nowrap ${tab === ids[i] ? 'text-amber-600 border-b-2 border-amber-600 scale-105' : 'text-slate-300 hover:text-slate-600'}`}>{label}</button>
                      })}
                    </div>
                    
                    {tab === 'info' && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
                        <div className="lg:col-span-2 bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm space-y-8">
                          <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.3em] border-b border-slate-50 pb-6">Conselheiros & Convidados</h3>
                          <div className="space-y-3">{(currentMeeting.participants || []).map((p, i) => (
                            <div key={i} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100 group transition-all hover:bg-white hover:shadow-md font-bold italic">
                              <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center text-xs font-bold shadow-inner">{p.name[0]}</div><div><p className="text-sm text-slate-800">{p.name}</p><p className="text-[10px] text-slate-400 italic font-medium tracking-normal">{p.email}</p></div></div>
                              <button onClick={()=>setCurrentMeeting({...currentMeeting, participants:currentMeeting.participants.filter((_,idx)=>idx!==i)})} className="p-2 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X size={20}/></button>
                            </div>
                          ))}</div>
                          <div className="p-8 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input placeholder="Nome Completo" className="p-4 border rounded-xl text-sm bg-white outline-none focus:border-amber-500 font-bold italic" value={tmpPart.name} onChange={e=>setTmpPart({...tmpPart, name:e.target.value})}/><input placeholder="E-mail Corporativo" className="p-4 border rounded-xl text-sm bg-white outline-none focus:border-amber-500 font-bold" value={tmpPart.email} onChange={e=>setTmpPart({...tmpPart, email:e.target.value})}/><button onClick={()=>{if(tmpPart.name){setCurrentMeeting({...currentMeeting, participants:[...(currentMeeting.participants || []), tmpPart]}); setTmpPart({name:'', email:''});}}} className="w-full sm:col-span-2 py-4 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-black transition-all tracking-widest shadow-lg">Adicionar à Lista</button>
                          </div>
                        </div>
                        <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm space-y-8 h-fit">
                          <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.3em] border-b border-slate-50 pb-6">Logística da Sessão</h3>
                          <div className="flex rounded-xl border border-slate-100 p-1.5 bg-slate-50 mb-6 shadow-inner">{['Online', 'Presencial', 'Híbrida'].map(t => (<button key={t} onClick={()=>setCurrentMeeting({...currentMeeting, type: t})} className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase transition-all ${currentMeeting.type === t ? 'bg-white text-amber-600 shadow-md' : 'text-slate-400'}`}>{t}</button>))}</div>
                          <div className="space-y-6">
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Data da Reunião</label><input type="date" value={currentMeeting.date} className="w-full p-4 border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-500 font-bold shadow-sm" onChange={e=>setCurrentMeeting({...currentMeeting, date:e.target.value})}/></div>
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Horário Previsto</label><input type="time" value={currentMeeting.time} className="w-full p-4 border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-500 font-bold shadow-sm" onChange={e=>setCurrentMeeting({...currentMeeting, time:e.target.value})}/></div>
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Local / Link de Acesso</label><input placeholder="..." className="w-full p-4 border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-500 font-bold italic shadow-sm" value={currentMeeting.type === 'Online' ? currentMeeting.link : currentMeeting.address} onChange={e=>setCurrentMeeting({...currentMeeting, [currentMeeting.type==='Online'?'link':'address']:e.target.value})} /></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {tab === 'pauta' && (
                      <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in space-y-8">
                        <div className="space-y-3">{(currentMeeting.pautas || []).map((p, i) => (
                          <div key={i} className="flex justify-between items-center p-6 bg-white border border-slate-100 rounded-2xl group border-l-[6px] border-l-amber-500 shadow-sm font-bold italic hover:translate-x-1 transition-all"><div className="flex items-center gap-6"><span className="text-slate-200 text-xl font-black italic">#{i+1}</span><div><p className="text-base text-slate-800">{p.title}</p><p className="text-[10px] text-amber-600 uppercase tracking-widest mt-1">Responsável: {p.resp} • Tempo: {p.dur} MIN</p></div></div><button onClick={()=>setCurrentMeeting({...currentMeeting, pautas: currentMeeting.pautas.filter((_, idx)=>idx!==i)})} className="p-3 text-slate-100 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={22}/></button></div>
                        ))}</div>
                        <div className="p-8 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end shadow-inner">
                            <div className="sm:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assunto da Ordem do Dia</label><input className="w-full p-4 border rounded-xl text-sm mt-2 outline-none focus:border-amber-500 bg-white font-bold italic shadow-sm" value={tmpPauta.title} onChange={e=>setTmpPauta({...tmpPauta, title:e.target.value})}/></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Liderança</label><select className="w-full p-4 border rounded-xl text-sm mt-2 outline-none focus:border-amber-500 bg-white cursor-pointer font-bold shadow-sm" value={tmpPauta.resp} onChange={e=>setTmpPauta({...tmpPauta, resp:e.target.value})}><option value="">Selecione...</option>{currentMeeting.participants.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}</select></div>
                            <button onClick={()=>{if(tmpPauta.title){setCurrentMeeting({...currentMeeting, pautas:[...(currentMeeting.pautas || []), tmpPauta]}); setTmpPauta({title:'', resp:'', dur:''});}}} className="h-[56px] bg-slate-900 text-white rounded-xl flex items-center justify-center transition-all shadow-xl hover:bg-black active:scale-95"><Plus size={24}/></button>
                        </div>
                      </div>
                    )}

                    {tab === 'materiais' && (
                      <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in space-y-10">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-8"><h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.3em]">Documentação Estratégica</h3><button onClick={()=>fileRef.current?.click()} className="bg-slate-50 hover:bg-slate-100 text-slate-700 px-6 py-3 rounded-xl text-[10px] font-bold uppercase flex items-center gap-3 transition-all tracking-widest shadow-sm"><Upload size={16}/> Carregar Arquivo</button></div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">{(currentMeeting.materiais || []).map((m, i) => (
                          <div key={i} className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm group relative overflow-hidden italic font-bold hover:border-amber-500 transition-all"><div className="flex items-start gap-5"><div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shadow-inner"><FileText size={28}/></div><div className="min-w-0 flex-1"><p className="text-sm truncate text-slate-800">{m.name}</p><a href={m.url} target="_blank" rel="noreferrer" className="text-[10px] text-amber-600 hover:underline flex items-center gap-2 mt-2 uppercase tracking-widest font-black"><ExternalLink size={12}/> Visualizar</a></div></div><button onClick={()=>setCurrentMeeting({...currentMeeting, materiais: currentMeeting.materiais.filter((_, idx)=>idx!==i)})} className="absolute top-4 right-4 p-2 text-slate-100 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button></div>
                        ))}</div>
                      </div>
                    )}

                    {tab === 'delib' && (
                      <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in space-y-10">
                        <div className="space-y-6">{(currentMeeting.deliberacoes || []).map((d, i) => (
                          <div key={i} className="p-8 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner group font-bold italic"><div className="flex justify-between items-start mb-6"><p className="text-base text-slate-800 leading-relaxed pr-10">"{d.title}"</p><button onClick={()=>setCurrentMeeting({...currentMeeting, deliberacoes: currentMeeting.deliberacoes.filter((_, idx)=>idx!==i)})} className="p-3 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X size={24}/></button></div><div className="flex flex-wrap gap-3 pt-6 border-t border-slate-200"><span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mr-2 mt-1">Votantes Oficiais:</span> {d.voters.map((v, vi) => <span key={vi} className="bg-white border border-slate-200 px-4 py-1.5 rounded-full text-[9px] uppercase font-black shadow-sm text-slate-700 tracking-wider">{v}</span>)}</div></div>
                        ))}</div>
                        <div className="p-10 bg-amber-50/40 border border-amber-100 rounded-[40px] space-y-6 shadow-inner">
                          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.3em] mb-4 italic">Registrar Nova Deliberação</p>
                          <textarea placeholder="Texto oficial da decisão tomada em conselho..." className="w-full p-6 border border-amber-100 rounded-3xl text-base h-32 font-bold italic outline-none focus:border-amber-500 bg-white shadow-sm transition-all" value={tmpDelib.title} onChange={e=>setTmpDelib({...tmpDelib, title:e.target.value})} />
                          <div className="space-y-4"><p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Conselheiros Presentes no Voto:</p><div className="flex flex-wrap gap-4 p-6 bg-white rounded-3xl border border-slate-100 max-h-48 overflow-y-auto shadow-inner">{currentMeeting.participants.map((p, i) => (<label key={i} className="flex items-center gap-3 text-[10px] font-bold uppercase text-slate-500 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-100"><input type="checkbox" className="w-5 h-5 rounded-lg text-amber-600 border-slate-200" checked={tmpDelib.voters.includes(p.name)} onChange={(e) => { if(e.target.checked) setTmpDelib({...tmpDelib, voters: [...tmpDelib.voters, p.name]}); else setTmpDelib({...tmpDelib, voters: tmpDelib.voters.filter(v => v !== p.name)}); }} /> {p.name}</label>))}</div></div>
                          <button onClick={()=>{if(tmpDelib.title){setCurrentMeeting({...currentMeeting, deliberacoes:[...(currentMeeting.deliberacoes || []), tmpDelib]}); setTmpDelib({title:'', voters:[]});}}} className="w-full py-5 bg-amber-600 text-white rounded-[20px] font-bold uppercase shadow-xl shadow-amber-900/20 hover:bg-amber-700 transition-all tracking-widest">Lavrar Deliberação Oficial</button>
                        </div>
                      </div>
                    )}

                    {tab === 'acoes' && (
                      <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in space-y-8">
                        <div className="space-y-4">{(currentMeeting.acoes || []).map((a, i) => (
                          <div key={i} className="p-6 bg-white border border-slate-100 rounded-3xl border-l-[8px] border-l-emerald-500 shadow-md flex justify-between items-center group font-bold italic hover:translate-x-1 transition-all"><div><p className="text-base text-slate-800 leading-tight">{a.title}</p><p className="text-[10px] text-slate-300 font-bold uppercase mt-2 tracking-widest">Executor: <span className="text-emerald-600">{a.resp}</span> • Prazo Fatal: {a.date}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, acoes: currentMeeting.acoes.filter((_, idx)=>idx!==i)})}><Trash2 size={22} className="text-slate-100 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"/></button></div>
                        ))}</div>
                        <div className="p-8 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-6 items-end shadow-inner">
                            <div className="sm:col-span-5"><label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-1">Objetivo da Ação</label><input className="w-full p-4 border rounded-2xl text-sm mt-2 outline-none focus:border-amber-500 bg-white font-bold italic shadow-sm" value={tmpAcao.title} onChange={e=>setTmpAcao({...tmpAcao, title:e.target.value})}/></div>
                            <div className="sm:col-span-3"><label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-1">Responsável</label><select className="w-full p-4 border rounded-2xl text-sm mt-2 outline-none focus:border-amber-500 bg-white cursor-pointer font-bold shadow-sm" value={tmpAcao.resp} onChange={e=>setTmpAcao({...tmpAcao, resp:e.target.value})}><option value="">Selecione...</option>{currentMeeting.participants.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}</select></div>
                            <div className="sm:col-span-3"><label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-1">Prazo de Entrega</label><input type="date" className="w-full p-4 border rounded-2xl text-sm mt-2 outline-none focus:border-amber-500 bg-white font-bold shadow-sm" value={tmpAcao.date} onChange={e=>setTmpAcao({...tmpAcao, date:e.target.value})}/></div>
                            <div className="sm:col-span-1"><button onClick={()=>{if(tmpAcao.title){setCurrentMeeting({...currentMeeting, acoes:[...(currentMeeting.acoes || []), {...tmpAcao, id: Date.now()}]}); setTmpAcao({title:'', resp:'', date:'', status:'Pendente'});}}} className="w-full h-[58px] bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all"><Plus size={24}/></button></div>
                        </div>
                      </div>
                    )}

                    {tab === 'atas' && (
                      <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in space-y-10 text-center">
                        <div className="max-w-md mx-auto space-y-4">
                          <div className="w-20 h-20 bg-slate-50 text-amber-500 rounded-[30px] flex items-center justify-center mx-auto shadow-inner"><FileCheck size={40}/></div>
                          <h3 className="text-xl font-bold italic text-slate-800 tracking-tight">Registro Formal da Sessão</h3>
                          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.3em]">Base de Dados INEPAD • Fé Pública</p>
                        </div>
                        <button onClick={()=>ataRef.current?.click()} className="bg-slate-900 hover:bg-black text-white px-10 py-5 rounded-[24px] text-[10px] font-bold uppercase flex items-center justify-center gap-4 mx-auto shadow-2xl transition-all tracking-[0.2em]"><Upload size={18} className="text-amber-500"/> Subir ATA Final Assinada</button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-10 border-t border-slate-50">{(currentMeeting.atas || []).map((ata, i) => (
                          <div key={i} className="p-6 bg-white border border-slate-100 rounded-3xl flex items-center gap-6 group relative shadow-sm hover:border-amber-500 transition-all font-bold italic">
                            <div className="p-4 bg-slate-50 text-amber-600 rounded-2xl shadow-inner group-hover:bg-amber-600 group-hover:text-white transition-all"><FileCheck size={28}/></div>
                            <div className="flex-1 min-w-0 text-left"><p className="text-sm text-slate-800 truncate">{ata.name}</p><p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest mt-1">Sincronizado na Nuvem</p></div>
                            <div className="flex items-center gap-2"><a href={ata.url} target="_blank" rel="noreferrer" className="p-3 text-slate-300 hover:text-amber-600 transition-all"><ExternalLink size={22}/></a><button onClick={()=>setCurrentMeeting({...currentMeeting, atas: currentMeeting.atas.filter((_, idx) => idx !== i)})} className="p-3 text-slate-100 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={22}/></button></div>
                          </div>
                        ))}</div>
                      </div>
                    )}
                  </div>
                )
              )}

              {activeMenu === 'plano-acao' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex justify-between items-center"><div><h1 className="text-3xl font-bold text-slate-900 tracking-tight italic">Plano de Ações Diretas</h1><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Acompanhamento global de objetivos</p></div><button onClick={() => { const h="Ação,Reunião,Responsável,Status\n"; const r=stats.allActions.map(a=>`${a.title},${a.mTitle},${a.resp},${a.status}`).join("\n"); const b=new Blob([h+r],{type:'text/csv;charset=utf-8;'}); const l=document.createElement("a"); l.href=URL.createObjectURL(b); l.setAttribute("download","plano_acao_inepad_25anos.csv"); l.click(); }} className="bg-slate-50 hover:bg-slate-100 px-6 py-3 rounded-xl text-[10px] font-bold uppercase flex items-center gap-3 transition-all tracking-widest shadow-sm"><Download size={18}/> Exportar Relatório</button></div>
                  <div className="bg-white rounded-[40px] shadow-sm border border-slate-50 overflow-hidden overflow-x-auto shadow-2xl"><table className="w-full text-left text-sm min-w-[800px] font-bold italic"><thead className="bg-slate-900 text-[10px] font-bold uppercase text-amber-500 border-b border-white/5 tracking-widest"><tr><th className="px-10 py-5">Objetivo Estratégico</th><th className="px-10 py-5">Sessão de Origem</th><th className="px-10 py-5">Responsável</th><th className="px-10 py-5 text-center">Status de Execução</th></tr></thead><tbody className="divide-y divide-slate-50">{stats.allActions.map((acao, idx) => (<tr key={idx} className="hover:bg-slate-50 transition-all"><td className="px-10 py-6 text-slate-800">{acao.title}</td><td className="px-10 py-6 text-slate-300 text-[10px] font-black uppercase tracking-widest">{acao.mTitle}</td><td className="px-10 py-6 text-slate-500 text-xs uppercase tracking-wider">{acao.resp}</td><td className="px-10 py-6 text-center"><select value={acao.status} onChange={(e) => updateActionStatusGlobal(acao.mId, acao.id, e.target.value)} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase cursor-pointer border-none outline-none transition-all shadow-sm ${acao.status === 'Concluída' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}><option value="Pendente">Aguardando</option><option value="Em andamento">Em Execução</option><option value="Concluída">Finalizado</option><option value="Atrasada">Atraso Crítico</option></select></td></tr>))}</tbody></table></div>
                </div>
              )}

              {activeMenu === 'usuarios' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"><h1 className="text-3xl font-bold text-slate-900 tracking-tight italic">Composição do Conselho</h1></div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="bg-slate-900 p-10 rounded-[40px] shadow-2xl space-y-6 h-fit sticky top-24 border border-white/5 shadow-amber-900/20"><h3 className="text-[10px] font-bold uppercase text-amber-500 border-b border-white/5 pb-4 tracking-[0.3em]">Habilitar Acesso</h3><div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label><input className="w-full p-4 border-none rounded-xl text-sm mt-2 bg-slate-800 text-white outline-none font-bold italic focus:ring-1 focus:ring-amber-500" value={newUserForm.name} onChange={e=>setnewUserForm({...newUserForm, name: e.target.value})} /></div><div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">E-mail</label><input className="w-full p-4 border-none rounded-xl text-sm mt-2 bg-slate-800 text-white outline-none font-bold focus:ring-1 focus:ring-amber-500" value={newUserForm.email} onChange={e=>setnewUserForm({...newUserForm, email: e.target.value})} /></div><div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Perfil</label><select className="w-full p-4 border-none rounded-xl text-xs font-bold uppercase bg-slate-800 text-white cursor-pointer mt-2" value={newUserForm.role} onChange={e=>setnewUserForm({...newUserForm, role: e.target.value})}><option value="Conselheiro">Conselheiro</option><option value="Administrador">Administrador</option></select></div><button onClick={async ()=>{ const {data} = await supabase.from('members').insert([newUserForm]).select(); if(data) { setUsers([...users, data[0]]); setnewUserForm({name:'', email:'', role:'Conselheiro', password:''}); alert("Membro integrado ao conselho!"); } }} className="w-full py-5 bg-amber-600 text-white rounded-2xl font-bold uppercase shadow-xl hover:bg-amber-700 transition-all tracking-widest shadow-amber-900/20">Autorizar Membro</button></div>
                    <div className="lg:col-span-2 bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto shadow-2xl"><table className="w-full text-left text-sm min-w-[600px] font-bold italic"><thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-50 tracking-widest"><tr><th className="px-10 py-5">Conselheiro</th><th className="px-10 py-5 text-center">Nível</th><th className="px-10 py-5 text-center">Gestão</th></tr></thead><tbody className="divide-y divide-slate-50">{users.map((u, i) => (<tr key={i} className="hover:bg-slate-50 transition-all"><td className="px-10 py-6"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center font-black italic shadow-inner">{u.name[0]}</div><div><p className="text-slate-800 text-base">{u.name}</p><p className="text-[10px] text-slate-300 font-medium tracking-normal not-italic">{u.email}</p></div></div></td><td className="px-10 py-6 text-center"><span className="bg-slate-50 text-slate-400 px-4 py-2 rounded-xl text-[10px] font-bold border border-slate-100 uppercase tracking-widest">{u.role}</span></td><td className="px-10 py-6 text-center"><button onClick={async ()=>{ if(window.confirm(`Revogar acesso de ${u.name}?`)) { const {error} = await supabase.from('members').delete().eq('id', u.id); if(!error) setUsers(users.filter((x)=>x.id!==u.id)); } }} className="p-3 text-slate-100 hover:text-red-500 transition-all"><Trash2 size={24}/></button></td></tr>))}</tbody></table></div>
                  </div>
                </div>
              )}

              {activeMenu === 'auditoria' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex justify-between items-center"><div><h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-4 italic"><History className="text-amber-600" /> Trilha de Compliance</h1><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registros imutáveis de governança</p></div><button onClick={() => { const h="Data,Usuário,Ação,Detalhes\n"; const r=auditLogs.map(l=>`${new Date(l.log_date).toLocaleString()},${l.username},${l.action},${l.details}`).join("\n"); const b=new Blob([h+r],{type:'text/csv;charset=utf-8;'}); const l=document.createElement("a"); l.href=URL.createObjectURL(b); l.setAttribute("download",`auditoria_inepad_25anos.csv`); l.click(); }} className="bg-slate-50 hover:bg-slate-100 px-6 py-3 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-3 transition-all tracking-widest shadow-sm"><FileText size={18}/> Exportar Logs</button></div>
                  <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden overflow-x-auto"><table className="w-full text-left text-sm min-w-[800px] font-bold italic"><thead className="bg-slate-900 text-[10px] font-bold uppercase text-amber-500 border-b border-white/5 tracking-widest"><tr><th className="px-10 py-5">Carimbo de Tempo</th><th className="px-10 py-5">Responsável</th><th className="px-10 py-5">Evento</th><th className="px-10 py-5">Detalhes Técnicos</th></tr></thead><tbody className="divide-y divide-slate-50">{auditLogs.map((log)=>(<tr key={log.id} className="hover:bg-slate-50 transition-all"><td className="px-10 py-6 text-slate-300 text-[10px]">{new Date(log.log_date).toLocaleString()}</td><td className="px-10 py-6 text-slate-800 text-xs uppercase tracking-wider">{log.username}</td><td className="px-10 py-6"><span className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-[9px] font-black border border-blue-100 uppercase tracking-[0.2em]">{log.action}</span></td><td className="px-10 py-6 text-slate-400 text-xs font-medium not-italic">{log.details}</td></tr>))}</tbody></table></div>
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