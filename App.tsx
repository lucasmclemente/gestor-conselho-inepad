import React, { useState, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, Calendar, ChevronRight, UserPlus, 
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, 
  GripVertical, Upload, Save, Lock, Target, FileCheck, BarChart3, 
  PieChart as PieIcon, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, Settings, Camera, UserCircle, History
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const App = () => {
  // --- SISTEMA DE USUÁRIOS E AUTH ---
  const [users, setUsers] = useState([
    { id: 1, name: 'Administrador', email: 'admin@inepad.com.br', password: '@GovInepad2026!', role: 'Administrador', avatar: null },
    { id: 2, name: 'João Silva', email: 'secretario@inepad.com.br', password: 'Sec#Corp2026?', role: 'Secretário', avatar: null }
  ]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'Conselheiro' });

  // --- LOGS DE AUDITORIA ---
  const [auditLogs, setAuditLogs] = useState<any[]>([
    { id: 1, date: '19/02/2026 11:40', user: 'Sistema', action: 'Restauração', details: 'Interface completa restabelecida no ambiente de testes.' }
  ]);

  const addLog = (action: string, details: string) => {
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    setAuditLogs(prev => [{ id: Date.now(), date: formattedDate, user: currentUser?.name || 'Sistema', action, details }, ...prev]);
  };

  // --- NAVEGAÇÃO E REFS ---
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('info');
  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);
  const profilePicRef = useRef<HTMLInputElement>(null);

  // --- DADOS ---
  const [meetings, setMeetings] = useState([
    { 
      id: 1, title: 'Conselho Admin - INEPAD Q1', status: 'CONCLUÍDA', date: '2025-12-10', time: '10:00', type: 'Presencial',
      participants: [{name: 'Membro Teste', email: 'teste@inepad.com.br'}],
      pautas: [{title: 'Aprovação de Verba', dur: '20', resp: 'Administrador'}],
      materiais: [], deliberacoes: [], 
      acoes: [{id: 201, title: 'Definir branding', date: '2026-01-30', status: 'Concluído', resp: 'Administrador'}], 
      atas: []
    }
  ]);

  const blankMeeting = {
    id: 0, title: '', status: 'AGENDADA', date: '', time: '', type: 'Híbrida', location: '', address: '', link: '',
    participants: [] as any[], pautas: [] as any[], materiais: [] as any[], deliberacoes: [] as any[], acoes: [] as any[], atas: [] as any[]
  };
  const [currentMeeting, setCurrentMeeting] = useState(blankMeeting);

  // --- INPUTS AUXILIARES ---
  const [tmpPart, setTmpPart] = useState({ name: '', email: '' });
  const [tmpPauta, setTmpPauta] = useState({ title: '', resp: '', dur: '' });
  const [tmpAcao, setTmpAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });
  const [tmpDelib, setTmpDelib] = useState({ title: '', voters: [] as string[] });
  const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '', newPass: '' });
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', role: 'Conselheiro', password: '' });

  const isAdm = currentUser?.role === 'Administrador';
  const canCreate = isAdm || currentUser?.role === 'Secretário';

  // --- DASHBOARD LOGIC ---
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const allA = meetings.flatMap(m => (m.acoes || []).map(a => ({ ...a, mTitle: m.title })));
    const pendingList = allA.filter(a => a.status !== 'Concluído');
    
    const concluido = allA.filter(a => a.status === 'Concluído').length;
    const atrasado = pendingList.filter(a => a.date && new Date(a.date) < today).length;
    const pendente = pendingList.length - atrasado;

    return {
      act: `${concluido}/${allA.length}`,
      atas: meetings.reduce((acc, m) => acc + (m.atas?.length || 0), 0),
      del: meetings.flatMap(m => m.deliberacoes || []).filter(d => d.votes?.some((v:any) => v.status === 'Aprovado')).length,
      pendingList,
      pieData: [
        { name: 'Concluídas', value: concluido, color: '#10b981' },
        { name: 'Pendentes', value: pendente, color: '#3b82f6' },
        { name: 'Atrasadas', value: atrasado, color: '#ef4444' }
      ],
      barData: meetings.map(m => ({
        name: m.title.substring(0, 10),
        'Pautas': m.pautas?.length || 0,
        'Ações': m.acoes?.length || 0
      }))
    };
  }, [meetings]);

  const handleLogin = (e: any) => {
    e.preventDefault();
    const user = users.find(u => u.email === authForm.email && u.password === authForm.password);
    if (user) { setCurrentUser(user); setProfileForm({ name: user.name, email: user.email, password: user.password, newPass: '' }); setActiveMenu('dashboard'); }
    else alert("Credenciais inválidas.");
  };

  const handleSaveMeeting = () => {
    if (!currentMeeting.title) return alert("Título é obrigatório.");
    const isNew = currentMeeting.id === 0;
    const entry = isNew ? { ...currentMeeting, id: Date.now() } : currentMeeting;
    setMeetings(isNew ? [entry, ...meetings] : meetings.map(m => m.id === entry.id ? entry : m));
    setView('list'); setActiveMenu('reunioes');
    addLog(isNew ? 'Criação' : 'Edição', `Reunião salva: ${currentMeeting.title}`);
  };

  const handleUpload = (e: any, target: 'materiais' | 'atas') => {
    const f = e.target.files?.[0];
    if (f) {
      const entry = { id: Date.now(), name: f.name, uploadedBy: currentUser.name, date: '19/02/2026' };
      setCurrentMeeting(prev => ({ ...prev, [target]: [...prev[target], entry] }));
      addLog('Upload', `Documento: ${f.name}`);
    }
  };

  // --- LOGIN ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden">
          <div className="p-10 bg-slate-900 text-white text-center border-b-8 border-blue-600">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-blue-500" />
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">GovCorp</h1>
          </div>
          <div className="p-10">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative"><Mail className="absolute left-4 top-3.5 text-slate-400" size={18} /><input type="email" placeholder="E-mail Corporativo" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-2xl text-sm font-bold italic outline-none focus:border-blue-500" value={authForm.email} onChange={e=>setAuthForm({...authForm, email: e.target.value})} /></div>
              <div className="relative"><Key className="absolute left-4 top-3.5 text-slate-400" size={18} /><input type="password" placeholder="Sua Senha" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-2xl text-sm font-bold outline-none focus:border-blue-500" value={authForm.password} onChange={e=>setAuthForm({...authForm, password: e.target.value})} /></div>
              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase">Entrar</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- TELAS ---
  let mainContent;
  if (activeMenu === 'dashboard') {
    mainContent = (
      <div className="space-y-8 animate-in fade-in">
        <div className="flex justify-between items-end"><h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Visão Estratégica</h1></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[ {l:'Ações OK', v:stats.act, i:<CheckCircle2/>, c:'blue'}, {l:'Deliberações', v:stats.del, i:<FileText/>, c:'indigo'}, {l:'ATAs', v:stats.atas, i:<FileCheck/>, c:'green'}, {l:'Pendências', v:stats.pendingList.length, i:<AlertCircle/>, c:'red'} ].map((s, idx) => (
            <div key={idx} className="bg-white p-6 rounded-[32px] border shadow-sm"><div className={`w-10 h-10 rounded-2xl mb-4 flex items-center justify-center ${s.c==='blue'?'bg-blue-50 text-blue-600':s.c==='red'?'bg-red-50 text-red-600':s.c==='indigo'?'bg-indigo-50 text-indigo-600':'bg-green-50 text-green-600'}`}>{s.i}</div><p className="text-[9px] font-black text-slate-400 uppercase italic mb-1">{s.l}</p><p className="text-2xl font-black text-slate-800 tracking-tighter">{s.v}</p></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border shadow-sm h-96"><h3 className="text-[10px] font-black uppercase mb-6 italic text-slate-500 flex items-center gap-2"><BarChart3 size={16}/> Decisões por Reunião</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.barData}><CartesianGrid vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900}} /><YAxis hide /><Tooltip/><Legend iconType="circle" wrapperStyle={{fontSize:'10px', fontWeight:900}} /><Bar dataKey="Pautas" fill="#cbd5e1" radius={[6,6,0,0]} barSize={20}/><Bar dataKey="Ações" fill="#3b82f6" radius={[6,6,0,0]} barSize={20}/></BarChart></ResponsiveContainer></div></div>
          <div className="bg-white p-8 rounded-[40px] border shadow-sm h-96 flex flex-col"><h3 className="text-[10px] font-black uppercase mb-6 italic text-slate-500 flex items-center gap-2"><PieIcon size={16}/> Status das Ações</h3><div className="flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={8}>{stats.pieData.map((e,i)=>(<Cell key={i} fill={e.color}/>))}</Pie><Tooltip/><Legend iconType="circle" wrapperStyle={{fontSize:'9px', fontWeight:900}}/></PieChart></ResponsiveContainer></div></div>
        </div>
        <div className="bg-white p-8 rounded-[40px] border shadow-sm overflow-hidden"><div className="flex justify-between items-center mb-6"><h3 className="text-[10px] font-black uppercase italic text-slate-500 flex items-center gap-2"><Target size={16}/> Plano de Ações Atualizado</h3><button onClick={() => setActiveMenu('plano-geral')} className="text-blue-600 text-[10px] font-black uppercase hover:underline font-bold">Ver Todas</button></div><table className="w-full text-left font-bold italic text-xs"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="p-4">Tarefa</th><th className="p-4">Reunião</th><th className="p-4">Status</th></tr></thead><tbody>{stats.pendingList.slice(0, 5).map((a, i) => (<tr key={i} className="border-t hover:bg-slate-50/50"><td className="p-4 text-slate-800 underline italic">{a.title}</td><td className="p-4 text-slate-400 font-black">{a.mTitle}</td><td className="p-4"><span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${new Date(a.date) < new Date() ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>{new Date(a.date) < new Date() ? 'Atrasada' : a.status}</span></td></tr>))}</tbody></table></div>
      </div>
    );
  } else if (activeMenu === 'plano-geral') {
    mainContent = (
      <div className="space-y-6 animate-in fade-in"><button onClick={() => setActiveMenu('dashboard')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-[10px] font-black uppercase italic transition-all"><ChevronRight className="rotate-180" size={16}/> Voltar</button><div className="bg-white p-8 rounded-[40px] border shadow-lg overflow-hidden"><h2 className="text-xl font-black italic mb-6">Monitoramento Geral de Ações</h2><table className="w-full text-left font-bold italic text-xs"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="p-6">Tarefa</th><th className="p-6">Origem</th><th className="p-6">Prazo</th><th className="p-6">Status</th></tr></thead><tbody>{stats.pendingList.map((a, i) => (<tr key={i} className="border-t hover:bg-slate-50/50"><td className="p-6 text-slate-800 font-black italic underline">{a.title}</td><td className="p-6 text-slate-400 uppercase font-black">{a.mTitle}</td><td className="p-6 text-slate-500">{a.date}</td><td className="p-6"><span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase ${new Date(a.date) < new Date() ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>{new Date(a.date) < new Date() ? 'Atrasada' : a.status}</span></td></tr>))}</tbody></table></div></div>
    );
  } else if (activeMenu === 'reunioes') {
    mainContent = view === 'list' ? (
      <div className="space-y-6 animate-in fade-in"><div className="flex justify-between items-center"><h1 className="text-2xl font-black italic tracking-tighter">Reuniões</h1><button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">+ Agendar</button></div><div className="grid gap-3">{meetings.map((m, idx) => (<div key={idx} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-6 rounded-[32px] border flex justify-between items-center group cursor-pointer hover:border-blue-400 shadow-sm transition-all"><div className="flex items-center gap-4"><div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all"><Calendar size={20}/></div><div><h3 className="font-bold italic">{m.title || "Rascunho"}</h3><p className="text-[9px] font-black text-blue-600 uppercase italic tracking-widest">{m.status} • {m.date || "Sem data"}</p></div></div><ChevronRight size={18}/></div>))}</div></div>
    ) : (
      <div className="animate-in fade-in pb-20">
        <div className="flex justify-between items-center mb-8"><button onClick={()=>setView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-[10px] font-black uppercase italic transition-all"><ChevronRight className="rotate-180" size={16}/> Voltar</button><button onClick={handleSaveMeeting} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center gap-2"><Save size={16}/> Salvar Reunião</button></div>
        <input placeholder="Título..." className="text-3xl font-black text-slate-800 bg-transparent outline-none w-full italic mb-8 border-b-2 border-slate-100 focus:border-blue-300 pb-2" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} />
        <div className="border-b flex gap-6 mb-8 overflow-x-auto font-black text-[9px] uppercase italic tracking-widest">{['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'Atas'].map((t, i) => (<button key={i} onClick={()=>setTab(['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i])} className={`pb-3 transition-all relative whitespace-nowrap ${tab === ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i] ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>{t}</button>))}</div>
        {tab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-[32px] border shadow-sm"><h3 className="text-[10px] font-black uppercase mb-4 italic text-slate-400">Participantes</h3><div className="space-y-2 mb-4">{currentMeeting.participants.map((p:any, i:any) => (<div key={i} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs font-bold italic"><span>{p.name}</span><button onClick={()=>setCurrentMeeting({...currentMeeting, participants: currentMeeting.participants.filter((_:any, idx:any)=>idx!==i)})}><X size={14}/></button></div>))}</div><div className="space-y-2 p-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><input placeholder="Nome" className="w-full p-2 text-xs border rounded-xl" value={tmpPart.name} onChange={e=>setTmpPart({...tmpPart, name:e.target.value})} /><button onClick={()=>{if(tmpPart.name){setCurrentMeeting({...currentMeeting, participants:[...currentMeeting.participants, tmpPart]}); setTmpPart({name:'', email:''});}}} className="w-full py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase">Adicionar</button></div></div>
            <div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4"><h3 className="text-[10px] font-black uppercase mb-4 italic text-slate-400">Logística</h3><div className="grid grid-cols-2 gap-2"><input type="date" value={currentMeeting.date} onChange={e=>setCurrentMeeting({...currentMeeting, date: e.target.value})} className="p-3 border rounded-xl text-xs font-bold bg-slate-50" /><input type="time" value={currentMeeting.time} onChange={e=>setCurrentMeeting({...currentMeeting, time: e.target.value})} className="p-3 border rounded-xl text-xs font-bold bg-slate-50" /></div><input placeholder="Link ou Sala" className="w-full p-3 border rounded-xl text-xs font-bold bg-slate-50 italic" value={currentMeeting.link} onChange={e=>setCurrentMeeting({...currentMeeting, link: e.target.value})} /></div>
          </div>
        )}
        {/* Adicione as outras abas conforme validado anteriormente */}
      </div>
    );
  } else if (activeMenu === 'auditoria' && isAdm) {
    mainContent = (
      <div className="space-y-8 animate-in fade-in"><h1 className="text-2xl font-black italic text-slate-800 tracking-tighter flex items-center gap-3"><History size={28}/> Auditoria Profissional</h1><div className="bg-white rounded-[40px] border shadow-sm overflow-hidden"><table className="w-full text-left font-bold italic text-xs"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="p-6">Data/Hora</th><th className="p-6">Usuário</th><th className="p-6">Ação</th><th className="p-6">Detalhes</th></tr></thead><tbody>{auditLogs.map((log) => (<tr key={log.id} className="border-t hover:bg-slate-50/50"><td className="p-6 text-[10px] text-slate-400 font-black">{log.date}</td><td className="p-6 text-xs text-blue-600 font-black uppercase">{log.user}</td><td className="p-6"><span className="bg-blue-100 px-3 py-1 rounded-full text-[8px] font-black uppercase">{log.action}</span></td><td className="p-6 text-xs text-slate-600">{log.details}</td></tr>))}</tbody></table></div></div>
    );
  } else if (activeMenu === 'usuarios' && isAdm) {
    mainContent = (
      <div className="space-y-8 animate-in fade-in"><h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Gestão de Usuários</h1><div className="grid grid-cols-1 md:grid-cols-4 gap-6"><div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4 h-fit"><h3 className="text-[10px] font-black uppercase italic text-slate-400">Novo Membro</h3><input placeholder="Nome" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none" value={newUserForm.name} onChange={e=>setNewUserForm({...newUserForm, name: e.target.value})} /><input placeholder="Email" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none" value={newUserForm.email} onChange={e=>setNewUserForm({...newUserForm, email: e.target.value})} /><input type="password" placeholder="Senha" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none" value={newUserForm.password} onChange={e=>setNewUserForm({...newUserForm, password: e.target.value})} /><button onClick={()=>{setUsers([...users, {...newUserForm, id: Date.now()}]); alert("Usuário criado!");}} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase">Cadastrar</button></div><div className="md:col-span-3 bg-white rounded-[40px] border shadow-sm overflow-hidden"><table className="w-full text-left font-bold italic text-xs"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="p-6">Nome</th><th className="p-6">Perfil</th></tr></thead><tbody>{users.map((u, i) => (<tr key={i} className="border-t hover:bg-slate-50/50"><td className="p-6 text-xs">{u.name}<p className="text-[9px] text-slate-400 font-black">{u.email}</p></td><td className="p-6"><span className="bg-slate-50 p-2 rounded-xl text-[9px] font-black uppercase">{u.role}</span></td></tr>))}</tbody></table></div></div></div>
    );
  } else if (activeMenu === 'perfil') {
    mainContent = (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in"><h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Meu Perfil</h1><div className="grid grid-cols-1 md:grid-cols-3 gap-8"><div className="md:col-span-1 bg-white p-8 rounded-[40px] border shadow-sm flex flex-col items-center text-center"><div className="w-32 h-32 rounded-full border-4 border-slate-100 flex items-center justify-center text-slate-300 mb-4"><UserCircle size={80} /></div><h3 className="font-black italic text-slate-800">{currentUser.name}</h3><p className="text-[10px] font-black uppercase text-slate-400">{currentUser.role}</p></div><div className="md:col-span-2 bg-white p-8 rounded-[40px] border shadow-sm space-y-6"><div className="space-y-4"><input className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold italic" value={profileForm.name} readOnly /><input className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold italic" value={profileForm.email} readOnly /><input type="password" placeholder="Mudar Senha" className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold outline-none focus:border-blue-500" /></div><button onClick={()=>alert("Perfil salvo!")} className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 shadow-xl hover:bg-black transition-all"><Save size={16}/> Salvar Alterações</button></div></div></div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 overflow-hidden leading-tight animate-in fade-in duration-300">
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800"><CheckCircle2 className="text-blue-500" size={24}/><span className="font-bold text-white text-xl uppercase italic tracking-tighter leading-none">GovCorp</span></div>
        <nav className="flex-1 p-4 space-y-2 font-bold italic text-xs">
          <button onClick={() => {setActiveMenu('dashboard'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'dashboard' || activeMenu === 'plano-geral' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calendar size={18}/> Reuniões</button>
          {isAdm && <button onClick={() => {setActiveMenu('usuarios'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'usuarios' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><UserCog size={18}/> Usuários</button>}
          {isAdm && <button onClick={() => {setActiveMenu('auditoria'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'auditoria' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><History size={18}/> Auditoria</button>}
          <button onClick={() => {setActiveMenu('perfil'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'perfil' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Settings size={18}/> Perfil</button>
          <div className="pt-10 border-t border-slate-800 mt-10"><button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"><LogOut size={18}/> Logout</button></div>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest italic tracking-widest">INEPAD Governança Profissional</span>
          <div className="flex gap-4 text-[10px] font-bold uppercase italic text-slate-400 items-center">
            <div className="text-right"><p className="text-slate-800 font-black tracking-tight">{currentUser.name}</p><p className="justify-end">{currentUser.role}</p></div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 border flex items-center justify-center text-blue-600 font-black shadow-sm overflow-hidden">{currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : <UserCheck size={16}/>}</div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">{mainContent}</div>
      </main>
    </div>
  );
};

export default App;
