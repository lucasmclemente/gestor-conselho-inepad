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
    
    // CORREÇÃO PARA POSTGRESQL DATE SYNTAX
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
      alert("Sucesso na gravação!");
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
        { name: 'Pendente', value: count('Pendente'), color: '#64748b' }, 
        { name: 'Atrasada', value: atrasadas, color: '#dc2626' } 
      ],
      barData: filteredM.slice(0,6).map(m => ({ name: m.date || 'S/D', 'Itens': m.pautas?.length || 0, 'Ações': m.acoes?.length || 0 }))
    };
  }, [meetings, dashboardFilter]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
          <div className="text-center mb-8">
            <img src="/logo-login.jpg" alt="INEPAD" className="h-20 mx-auto mb-4 object-contain" />
            <h1 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Acesso GovCorp</h1>
            <p className="text-xs text-slate-500 mt-2 font-bold">25 ANOS DE GOVERNANÇA</p>
          </div>
          <form className="space-y-4" onSubmit={(e)=>{e.preventDefault(); const u = users.find(u=>u.email===authForm.email && u.password===authForm.password); if(u){setCurrentUser(u); addLog('Login','Acesso');}else alert('Credenciais Inválidas');}}>
            <input type="email" placeholder="E-mail Corporativo" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} />
            <input type="password" placeholder="Senha" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} />
            <button className="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-lg font-bold uppercase shadow-md transition-all">Entrar na Plataforma</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden text-slate-800">
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-800 text-slate-300 flex flex-col shadow-xl transform transition-transform duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex flex-col items-center justify-center border-b border-slate-700/50 min-h-[100px]">
            <img src="/logo-sidebar.jpg" alt="INEPAD Logo" className="h-12 w-auto object-contain" />
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
              <button key={item.id} onClick={() => { setActiveMenu(item.id); if(item.action) item.action(); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeMenu === item.id ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-slate-700 hover:text-white'}`}>
                {item.icon} {item.label}
              </button>
            )
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700/50">
            <button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all text-[10px] font-bold uppercase tracking-widest"><LogOut size={18}/> Sair</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-slate-600" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button>
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">INEPAD Consultoria • Gestão de Conselhos</h2>
          </div>
          <div className="flex gap-4 items-center">
            <div className="text-right hidden xs:block">
              <p className="text-sm font-bold text-slate-800 leading-tight">{currentUser.name}</p>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{currentUser.role}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold border border-amber-200">{currentUser.name[0]}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-full text-amber-600 font-bold uppercase animate-pulse">Sincronizando Dados...</div>
          ) : (
            <>
              {activeMenu === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Visão Geral</h1>
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-slate-200 w-full sm:w-auto">
                      <Filter size={16} className="text-slate-400"/><select className="text-xs font-bold uppercase outline-none bg-transparent w-full cursor-pointer text-slate-600" value={dashboardFilter} onChange={e=>setDashboardFilter(e.target.value)}>
                        <option value="all">Consolidado Geral</option>
                        {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[ {l:'Ações Concluídas', v:stats.concluida, i:<CheckCircle2/>, c:'amber'}, {l:'Deliberações', v:stats.delibs, i:<FileText/>, c:'slate'}, {l:'ATAs Oficiais', v:stats.atas, i:<FileCheck/>, c:'amber'}, {l:'Ações em Atraso', v:stats.atrasadas, i:<AlertCircle/>, c:'red'} ].map((s, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 transition-all hover:shadow-md">
                          <div className={`p-3 rounded-lg ${s.c==='amber'?'bg-amber-100 text-amber-600':s.c==='red'?'bg-red-100 text-red-600':'bg-slate-100 text-slate-600'}`}>{s.i}</div>
                          <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.l}</p><p className="text-2xl font-bold text-slate-800 mt-1">{s.v}</p></div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[350px]">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full"><h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Status das Ações</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>{stats.pieData.map((e,i)=>(<Cell key={i} fill={e.color} stroke="white" strokeWidth={2}/>))}</Pie><Tooltip/><Legend wrapperStyle={{fontSize:'10px', textTransform:'uppercase'}}/></PieChart></ResponsiveContainer></div></div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full"><h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Produtividade Recente</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.barData}><CartesianGrid vertical={false} stroke="#f1f5f9"/><XAxis dataKey="name" tick={{fontSize:10, fontWeight:600}}/><YAxis hide/><Tooltip/><Bar dataKey="Itens" fill="#64748b" radius={[4,4,0,0]} barSize={20}/><Bar dataKey="Ações" fill="#d97706" radius={[4,4,0,0]} barSize={20}/></BarChart></ResponsiveContainer></div></div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 flex justify-between items-center border-b border-slate-100 bg-slate-50/50"><h3 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-2 tracking-widest"><ListChecks size={18} className="text-amber-600"/> Ações Prioritárias</h3></div>
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm min-w-[600px]"><thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 tracking-widest"><tr><th className="px-6 py-3">Ação Estratégica</th><th className="px-6 py-3">Responsável</th><th className="px-6 py-3 text-center">Status</th></tr></thead><tbody className="divide-y divide-slate-100 font-bold italic">{stats.allActions.slice(0, 5).map((acao, idx) => (<tr key={idx} className="hover:bg-slate-50 border-b border-slate-100 last:border-0"><td className="px-6 py-4 text-slate-800">{acao.title}</td><td className="px-6 py-4 text-slate-400 text-xs uppercase">{acao.resp}</td><td className="px-6 py-4 text-center"><span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${acao.status === 'Concluída' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{acao.status}</span></td></tr>))}</tbody></table></div>
                  </div>
                </div>
              )}

              {activeMenu === 'reunioes' && (
                view === 'list' ? (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Conselho Deliberativo</h1>
                      <button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all shadow-md tracking-widest">+ Nova Reunião</button>
                    </div>
                    <div className="grid gap-4">{meetings.map((m, idx) => (
                      <div key={idx} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-6 rounded-xl border border-slate-200 flex justify-between items-center group cursor-pointer hover:border-amber-500 hover:shadow-md transition-all shadow-sm">
                        <div className="flex items-center gap-4"><div className="p-3 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-amber-100 group-hover:text-amber-700 transition-all"><Calendar size={24}/></div><div><h3 className="font-bold text-lg text-slate-800 group-hover:text-amber-600 transition-all italic">{m.title}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.status} • {m.date || 'DATA N/D'}</p></div></div>
                        <ChevronRight size={20} className="text-slate-300 group-hover:text-amber-500 transition-all"/>
                      </div>
                    ))}</div>
                  </div>
                ) : (
                  <div className="animate-in fade-in duration-300 pb-20">
                    <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-10">
                        <button onClick={()=>setView('list')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><ChevronRight className="rotate-180" size={20}/> Voltar</button>
                        <button onClick={saveMeeting} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase shadow-sm flex items-center gap-2 transition-all"><Save size={16} className="text-amber-500"/> Salvar na Nuvem</button>
                    </div>
                    
                    <input placeholder="Título da Reunião..." className="text-3xl md:text-4xl font-bold italic text-slate-800 bg-transparent outline-none w-full border-b border-slate-200 focus:border-amber-500 pb-2 mb-8" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} />
                    
                    <div className="border-b border-slate-200 flex gap-6 mb-8 overflow-x-auto font-bold text-[10px] uppercase tracking-widest no-scrollbar italic">
                      {['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Plano de Ação', 'Atas'].map((label, i) => {
                        const ids = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'];
                        return <button key={i} onClick={()=>setTab(ids[i])} className={`pb-3 transition-all relative whitespace-nowrap ${tab === ids[i] ? 'text-amber-600 border-b-2 border-amber-600' : 'text-slate-400 hover:text-slate-800'}`}>{label}</button>
                      })}
                    </div>
                    
                    {tab === 'info' && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
                        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
                          <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-50 pb-4">Participantes & Convidados</h3>
                          <div className="space-y-2">{(currentMeeting.participants || []).map((p, i) => (
                            <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100 group">
                              <div className="flex items-center gap-3 font-bold italic"><div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">{p.name[0]}</div><div><p className="text-sm text-slate-800">{p.name}</p><p className="text-[10px] text-slate-400">{p.email}</p></div></div>
                              <button onClick={()=>setCurrentMeeting({...currentMeeting, participants:currentMeeting.participants.filter((_,idx)=>idx!==i)})} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X size={16}/></button>
                            </div>
                          ))}</div>
                          <div className="p-5 bg-slate-50 rounded-xl border border-dashed border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input placeholder="Nome" className="p-3 border rounded-lg text-sm bg-white outline-none focus:border-amber-500 font-bold" value={tmpPart.name} onChange={e=>setTmpPart({...tmpPart, name:e.target.value})}/><input placeholder="E-mail" className="p-3 border rounded-lg text-sm bg-white outline-none focus:border-amber-500 font-bold" value={tmpPart.email} onChange={e=>setTmpPart({...tmpPart, email:e.target.value})}/><button onClick={()=>{if(tmpPart.name){setCurrentMeeting({...currentMeeting, participants:[...(currentMeeting.participants || []), tmpPart]}); setTmpPart({name:'', email:''});}}} className="w-full sm:col-span-2 py-3 bg-amber-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-amber-700 transition-all tracking-widest">Adicionar Participante</button>
                          </div>
                        </div>
                        <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-6 h-fit">
                          <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-50 pb-4">Logística</h3>
                          <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50 mb-4">{['Online', 'Presencial', 'Híbrida'].map(t => (<button key={t} onClick={()=>setCurrentMeeting({...currentMeeting, type: t})} className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase transition-all ${currentMeeting.type === t ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`}>{t}</button>))}</div>
                          <div className="space-y-4">
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data</label><input type="date" value={currentMeeting.date} className="w-full p-3 border rounded-lg text-sm outline-none focus:border-amber-500 font-bold" onChange={e=>setCurrentMeeting({...currentMeeting, date:e.target.value})}/></div>
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Horário</label><input type="time" value={currentMeeting.time} className="w-full p-3 border rounded-lg text-sm outline-none focus:border-amber-500 font-bold" onChange={e=>setCurrentMeeting({...currentMeeting, time:e.target.value})}/></div>
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{currentMeeting.type === 'Online' ? 'Link' : 'Local'}</label><input className="w-full p-3 border rounded-lg text-sm outline-none focus:border-amber-500 font-bold italic" value={currentMeeting.type === 'Online' ? currentMeeting.link : currentMeeting.address} onChange={e=>setCurrentMeeting({...currentMeeting, [currentMeeting.type==='Online'?'link':'address']:e.target.value})} /></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {tab === 'pauta' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-6">
                        <div className="space-y-2">{(currentMeeting.pautas || []).map((p, i) => (
                          <div key={i} className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-lg group border-l-4 border-l-amber-500 shadow-sm font-bold italic"><div className="flex items-center gap-4"><span className="text-slate-300">#{i+1}</span><div><p className="text-sm text-slate-800">{p.title}</p><p className="text-[10px] text-slate-400 uppercase">{p.resp} • {p.dur} min</p></div></div><button onClick={()=>setCurrentMeeting({...currentMeeting, pautas: currentMeeting.pautas.filter((_, idx)=>idx!==i)})} className="p-2 text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button></div>
                        ))}</div>
                        <div className="p-5 bg-slate-50 rounded-xl border border-dashed border-slate-300 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                            <div className="sm:col-span-2"><input placeholder="Item da Pauta" className="w-full p-3 border rounded-lg text-sm outline-none focus:border-amber-500 bg-white font-bold italic" value={tmpPauta.title} onChange={e=>setTmpPauta({...tmpPauta, title:e.target.value})}/></div>
                            <div><select className="w-full p-3 border rounded-lg text-sm outline-none focus:border-amber-500 bg-white cursor-pointer font-bold" value={tmpPauta.resp} onChange={e=>setTmpPauta({...tmpPauta, resp:e.target.value})}><option value="">Responsável...</option>{currentMeeting.participants.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}</select></div>
                            <button onClick={()=>{if(tmpPauta.title){setCurrentMeeting({...currentMeeting, pautas:[...(currentMeeting.pautas || []), tmpPauta]}); setTmpPauta({title:'', resp:'', dur:''});}}} className="h-12 bg-amber-600 text-white rounded-lg flex items-center justify-center transition-all shadow-md"><Plus size={20}/></button>
                        </div>
                      </div>
                    )}

                    {tab === 'materiais' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-6">
                        <div className="flex justify-between items-center"><h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest">Apoio Técnico</h3><button onClick={()=>fileRef.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all"><Upload size={14}/> Carregar</button></div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{(currentMeeting.materiais || []).map((m, i) => (
                          <div key={i} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm group relative overflow-hidden"><div className="flex items-start gap-3 font-bold italic"><div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><FileText size={24}/></div><div className="min-w-0 flex-1"><p className="text-xs truncate text-slate-800">{m.name}</p><a href={m.url} target="_blank" rel="noreferrer" className="text-[10px] text-amber-600 hover:underline flex items-center gap-1 mt-1"><ExternalLink size={10}/> Abrir</a></div></div><button onClick={()=>setCurrentMeeting({...currentMeeting, materiais: currentMeeting.materiais.filter((_, idx)=>idx!==i)})} className="absolute top-2 right-2 p-1 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button></div>
                        ))}</div>
                      </div>
                    )}

                    {tab === 'delib' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-8">
                        <div className="space-y-4">{(currentMeeting.deliberacoes || []).map((d, i) => (
                          <div key={i} className="p-6 bg-slate-50 rounded-xl border border-slate-200 shadow-sm group font-bold italic"><div className="flex justify-between items-start mb-4"><p className="text-sm text-slate-800 leading-relaxed">"{d.title}"</p><button onClick={()=>setCurrentMeeting({...currentMeeting, deliberacoes: currentMeeting.deliberacoes.filter((_, idx)=>idx!==i)})} className="p-2 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X size={20}/></button></div><div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200"><span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Votantes:</span> {d.voters.map((v, vi) => <span key={vi} className="bg-white border border-slate-200 px-3 py-1 rounded-full text-[9px] uppercase shadow-sm">{v}</span>)}</div></div>
                        ))}</div>
                        <div className="p-6 bg-amber-50 rounded-xl border border-amber-200 space-y-4">
                          <textarea placeholder="Relato da Deliberação..." className="w-full p-4 border border-amber-100 rounded-lg text-sm h-24 font-bold italic outline-none focus:border-amber-500 bg-white" value={tmpDelib.title} onChange={e=>setTmpDelib({...tmpDelib, title:e.target.value})} />
                          <div className="space-y-2"><p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Membros em Votação:</p><div className="flex flex-wrap gap-3 p-4 bg-white rounded-lg border border-slate-200 max-h-40 overflow-y-auto">{currentMeeting.participants.map((p, i) => (<label key={i} className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500 p-2 hover:bg-slate-50 cursor-pointer"><input type="checkbox" className="w-4 h-4 rounded text-amber-600" checked={tmpDelib.voters.includes(p.name)} onChange={(e) => { if(e.target.checked) setTmpDelib({...tmpDelib, voters: [...tmpDelib.voters, p.name]}); else setTmpDelib({...tmpDelib, voters: tmpDelib.voters.filter(v => v !== p.name)}); }} /> {p.name}</label>))}</div></div>
                          <button onClick={()=>{if(tmpDelib.title){setCurrentMeeting({...currentMeeting, deliberacoes:[...(currentMeeting.deliberacoes || []), tmpDelib]}); setTmpDelib({title:'', voters:[]});}}} className="w-full py-3 bg-amber-600 text-white rounded-lg font-bold uppercase shadow-sm hover:bg-amber-700 transition-all tracking-widest">Oficializar Deliberação</button>
                        </div>
                      </div>
                    )}

                    {tab === 'acoes' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-6">
                        <div className="space-y-3">{(currentMeeting.acoes || []).map((a, i) => (
                          <div key={i} className="p-4 bg-white border border-slate-200 rounded-lg border-l-4 border-l-emerald-500 shadow-sm flex justify-between items-center group font-bold italic"><div><p className="text-sm text-slate-800">{a.title}</p><p className="text-[10px] text-slate-400 uppercase mt-1 tracking-widest">{a.resp} • PRAZO: {a.date}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, acoes: currentMeeting.acoes.filter((_, idx)=>idx!==i)})}><Trash2 size={18} className="text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"/></button></div>
                        ))}</div>
                        <div className="p-5 bg-slate-50 border border-dashed border-slate-300 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                            <div className="sm:col-span-5"><input placeholder="Ação Estratégica" className="w-full p-3 border rounded-lg text-sm outline-none focus:border-amber-500 bg-white font-bold italic" value={tmpAcao.title} onChange={e=>setTmpAcao({...tmpAcao, title:e.target.value})}/></div>
                            <div className="sm:col-span-3"><select className="w-full p-3 border rounded-lg text-sm outline-none focus:border-amber-500 bg-white cursor-pointer font-bold" value={tmpAcao.resp} onChange={e=>setTmpAcao({...tmpAcao, resp:e.target.value})}><option value="">Responsável...</option>{currentMeeting.participants.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}</select></div>
                            <div className="sm:col-span-3"><input type="date" className="w-full p-3 border rounded-lg text-sm outline-none focus:border-amber-500 bg-white font-bold" value={tmpAcao.date} onChange={e=>setTmpAcao({...tmpAcao, date:e.target.value})}/></div>
                            <div className="sm:col-span-1"><button onClick={()=>{if(tmpAcao.title){setCurrentMeeting({...currentMeeting, acoes:[...(currentMeeting.acoes || []), {...tmpAcao, id: Date.now()}]}); setTmpAcao({title:'', resp:'', date:'', status:'Pendente'});}}} className="w-full p-3 bg-emerald-600 text-white rounded-lg flex items-center justify-center shadow-md transition-all"><Plus size={20}/></button></div>
                        </div>
                      </div>
                    )}

                    {tab === 'atas' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-8">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-4"><h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest">ATAs Assinadas</h3><button onClick={()=>ataRef.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all"><Upload size={14}/> Carregar Documento</button></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{(currentMeeting.atas || []).map((ata, i) => (
                          <div key={i} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-4 group relative overflow-hidden italic font-bold">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><FileCheck size={24}/></div>
                            <div className="flex-1 min-w-0"><p className="text-sm text-slate-800 truncate">{ata.name}</p></div>
                            <div className="flex items-center gap-1"><a href={ata.url} target="_blank" rel="noreferrer" className="p-2 text-slate-300 hover:text-amber-600 transition-all"><ExternalLink size={18}/></a><button onClick={()=>setCurrentMeeting({...currentMeeting, atas: currentMeeting.atas.filter((_, idx) => idx !== i)})} className="p-2 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button></div>
                          </div>
                        ))}</div>
                      </div>
                    )}
                  </div>
                )
              )}

              {activeMenu === 'plano-acao' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center"><h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Plano Global de Ações</h1><button onClick={() => { const h="Ação,Reunião,Responsável,Status\n"; const r=stats.allActions.map(a=>`${a.title},${a.mTitle},${a.resp},${a.status}`).join("\n"); const b=new Blob([h+r],{type:'text/csv;charset=utf-8;'}); const l=document.createElement("a"); l.href=URL.createObjectURL(b); l.setAttribute("download","plano_acao_inepad_25anos.csv"); l.click(); }} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all tracking-widest"><Download size={14}/> Exportar CSV</button></div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto"><table className="w-full text-left text-sm min-w-[700px]"><thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-50 tracking-widest"><tr><th className="px-6 py-4">Iniciativa Estratégica</th><th className="px-6 py-4">Origem</th><th className="px-6 py-4">Executor</th><th className="px-6 py-4 text-center">Status</th></tr></thead><tbody className="divide-y divide-slate-100 font-bold italic">{stats.allActions.map((acao, idx) => (<tr key={idx} className="hover:bg-slate-50 transition-all"><td className="px-6 py-4 text-slate-800">{acao.title}</td><td className="px-6 py-4 text-slate-400 text-[10px] uppercase">{acao.mTitle}</td><td className="px-6 py-4 text-slate-600 text-xs uppercase">{acao.resp}</td><td className="px-6 py-4 text-center"><select value={acao.status} onChange={(e) => updateActionStatusGlobal(acao.mId, acao.id, e.target.value)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase cursor-pointer border border-transparent hover:border-slate-200 transition-all ${acao.status === 'Concluída' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}><option value="Pendente">Aguardando</option><option value="Em andamento">Em Execução</option><option value="Concluída">Finalizado</option><option value="Atrasada">Atraso Crítico</option></select></td></tr>))}</tbody></table></div>
                </div>
              )}

              {activeMenu === 'usuarios' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Gestão de Conselheiros</h1></div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <div className="bg-slate-800 p-6 rounded-xl shadow-xl space-y-4 h-fit sticky top-24 border border-white/10"><h3 className="text-[10px] font-bold uppercase text-amber-500 border-b border-white/5 pb-3 tracking-widest">Novo Perfil de Acesso</h3><input placeholder="Nome" className="w-full p-3 border-none rounded-lg text-sm bg-slate-700 text-white outline-none font-bold italic" value={newUserForm.name} onChange={e=>setnewUserForm({...newUserForm, name: e.target.value})} /><input placeholder="E-mail" className="w-full p-3 border-none rounded-lg text-sm bg-slate-700 text-white outline-none font-bold" value={newUserForm.email} onChange={e=>setnewUserForm({...newUserForm, email: e.target.value})} /><select className="w-full p-3 border-none rounded-lg text-xs font-bold uppercase bg-slate-700 text-white cursor-pointer" value={newUserForm.role} onChange={e=>setnewUserForm({...newUserForm, role: e.target.value})}><option value="Conselheiro">Conselheiro</option><option value="Administrador">Administrador</option></select><button onClick={async ()=>{ const {data} = await supabase.from('members').insert([newUserForm]).select(); if(data) { setUsers([...users, data[0]]); setnewUserForm({name:'', email:'', role:'Conselheiro', password:''}); alert("OK!"); } }} className="w-full py-3 bg-amber-600 text-white rounded-lg font-bold uppercase shadow-lg hover:bg-amber-700 transition-all tracking-widest">Cadastrar</button></div>
                    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto"><table className="w-full text-left text-sm min-w-[500px] font-bold italic"><thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-50 tracking-widest"><tr><th className="px-6 py-4">Membro</th><th className="px-6 py-4 text-center">Perfil</th><th className="px-6 py-4 text-center">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{users.map((u, i) => (<tr key={i} className="hover:bg-slate-50"><td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center font-bold italic">{u.name[0]}</div><div><p className="text-slate-800">{u.name}</p><p className="text-[10px] text-slate-400">{u.email}</p></div></div></td><td className="px-6 py-4 text-center"><span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-bold border border-slate-200 uppercase">{u.role}</span></td><td className="px-6 py-4 text-center"><button onClick={async ()=>{ if(window.confirm(`Excluir ${u.name}?`)) { const {error} = await supabase.from('members').delete().eq('id', u.id); if(!error) setUsers(users.filter((x)=>x.id!==u.id)); } }} className="p-2 text-slate-200 hover:text-red-500 transition-all"><Trash2 size={18}/></button></td></tr>))}</tbody></table></div>
                  </div>
                </div>
              )}

              {activeMenu === 'auditoria' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center"><div><h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3 italic"><History className="text-amber-600" /> Compliance & Rastreabilidade</h1></div><button onClick={() => { const h="Data,Usuário,Ação,Detalhes\n"; const r=auditLogs.map(l=>`${new Date(l.log_date).toLocaleString()},${l.username},${l.action},${l.details}`).join("\n"); const b=new Blob([h+r],{type:'text/csv;charset=utf-8;'}); const l=document.createElement("a"); l.href=URL.createObjectURL(b); l.setAttribute("download",`auditoria_inepad_25anos.csv`); l.click(); }} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition-all tracking-widest"><FileText size={14}/> CSV</button></div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto"><table className="w-full text-left text-sm min-w-[700px] font-bold italic"><thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-50 tracking-widest"><tr><th className="px-6 py-4">Carimbo de Tempo</th><th className="px-6 py-4">Usuário</th><th className="px-6 py-4">Evento</th><th className="px-6 py-4">Logs</th></tr></thead><tbody className="divide-y divide-slate-100">{auditLogs.map((log)=>(<tr key={log.id} className="hover:bg-slate-50"><td className="px-6 py-4 text-slate-300 text-[10px]">{new Date(log.log_date).toLocaleString()}</td><td className="px-6 py-4 text-slate-800 text-xs uppercase">{log.username}</td><td className="px-6 py-4"><span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[9px] font-bold border border-blue-100 uppercase tracking-widest">{log.action}</span></td><td className="px-6 py-4 text-slate-500 text-xs">{log.details}</td></tr>))}</tbody></table></div>
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