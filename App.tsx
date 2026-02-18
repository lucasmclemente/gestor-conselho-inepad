import React, { useState, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, Calendar, ChevronRight, UserPlus, 
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, 
  GripVertical, Upload, Save, Lock, Target, FileCheck, BarChart3, 
  PieChart as PieIcon, ExternalLink, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, ShieldCheck, ShieldAlert, Settings, Camera, UserCircle, KeyRound, History
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const App = () => {
  // --- SISTEMA DE USUÁRIOS E AUTH ---
  const [users, setUsers] = useState([
    { id: 1, name: 'Ricardo Oliveira', email: 'admin@inepad.com.br', password: '@GovInepad2026!', role: 'Administrador', avatar: null },
    { id: 2, name: 'João Silva', email: 'secretario@inepad.com.br', password: 'Sec#Corp2026?', role: 'Secretário', avatar: null }
  ]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authState, setAuthState] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'Conselheiro' });

  // --- LOGS DE AUDITORIA ---
  const [auditLogs, setAuditLogs] = useState<any[]>([
    { id: 1, date: '18/02/2026 15:00', user: 'Sistema', action: 'Segurança', details: 'Políticas de senha forte aplicadas.' }
  ]);

  const addLog = (action: string, details: string) => {
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    setAuditLogs(prev => [{
      id: Date.now(),
      date: formattedDate,
      user: currentUser?.name || 'Sistema',
      action,
      details
    }, ...prev]);
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
      id: 1, title: 'Conselho de Administração - INEPAD Q4', status: 'CONCLUÍDA', date: '2025-12-10', time: '10:00', type: 'Presencial',
      participants: [{name: 'Ricardo Oliveira', email: 'admin@inepad.com.br'}],
      pautas: [{title: 'Aprovação de Verba Marketing', dur: '20', resp: 'Ricardo Oliveira'}],
      materiais: [], deliberacoes: [], 
      acoes: [{id: 201, title: 'Definir agência de branding', date: '2025-12-30', status: 'Pendente', resp: 'Ricardo Oliveira'}], 
      atas: []
    }
  ]);

  const [currentMeeting, setCurrentMeeting] = useState({
    id: 0, title: '', status: 'AGENDADA', date: '', time: '', type: 'Híbrida', location: '', address: '', link: '',
    participants: [] as any[], pautas: [] as any[], materiais: [] as any[], deliberacoes: [] as any[], acoes: [] as any[], atas: [] as any[]
  });

  const [tmpPart, setTmpPart] = useState({ name: '', email: '' });
  const [tmpPauta, setTmpPauta] = useState({ title: '', resp: '', dur: '' });
  const [tmpAcao, setTmpAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });
  const [tmpDelib, setTmpDelib] = useState({ title: '', voters: [] as string[] });
  const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '', newPass: '' });
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', role: 'Conselheiro', password: '' });

  // --- PERMISSÕES ---
  const isAdm = currentUser?.role === 'Administrador';
  const isSec = currentUser?.role === 'Secretário';
  const canCreate = isAdm || isSec;
  const canDelete = isAdm;

  // --- MÉTRICAS ---
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const allA = meetings.flatMap(m => (m.acoes || []).map(a => ({ ...a, mTitle: m.title })));
    const pending = allA.filter(a => a.status !== 'Concluído');
    return { 
        act: `${allA.filter(a=>a.status==='Concluído').length}/${allA.length}`, 
        pending, 
        atas: meetings.reduce((acc, m) => acc + (m.atas?.length || 0), 0) 
    };
  }, [meetings]);

  // --- HANDLERS AUTH ---
  const handleLogin = (e: any) => {
    e.preventDefault();
    const user = users.find(u => u.email === authForm.email && u.password === authForm.password);
    if (user) { 
      setCurrentUser(user); 
      setProfileForm({ name: user.name, email: user.email, password: user.password, newPass: '' }); 
      setActiveMenu('dashboard');
      addLog('Login', 'Acesso bem-sucedido ao painel.');
    } else {
        alert("Falha na autenticação. Verifique e-mail e senha.");
    }
  };

  const handleCreateUser = () => {
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) return alert("Preencha todos os campos, incluindo a senha temporária.");
    if (newUserForm.password.length < 6) return alert("A senha deve ter no mínimo 6 caracteres.");
    
    setUsers([...users, { ...newUserForm, id: Date.now() }]);
    addLog('Segurança', `Novo usuário criado: ${newUserForm.name} como ${newUserForm.role}`);
    setNewUserForm({ name: '', email: '', role: 'Conselheiro', password: '' });
    alert("Usuário registrado com sucesso!");
  };

  const handleSaveMeeting = () => {
    if (!currentMeeting.title) return alert("Título obrigatório!");
    const isNew = currentMeeting.id === 0;
    const entry = isNew ? { ...currentMeeting, id: Date.now() } : currentMeeting;
    setMeetings(isNew ? [entry, ...meetings] : meetings.map(m => m.id === entry.id ? entry : m));
    addLog(isNew ? 'Criação' : 'Edição', `Reunião salva: ${currentMeeting.title}`);
    setView('list'); setActiveMenu('dashboard');
  };

  // --- TELA DE LOGIN ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
          <div className="p-10 bg-slate-900 text-white text-center border-b-8 border-blue-600">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-blue-500" />
            <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">GovCorp</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-3">Governance Manager</p>
          </div>
          <div className="p-10">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative"><Mail className="absolute left-4 top-3.5 text-slate-400" size={18} /><input type="email" placeholder="E-mail Corporativo" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold italic outline-none focus:border-blue-500" value={authForm.email} onChange={e=>setAuthForm({...authForm, email: e.target.value})} /></div>
              <div className="relative"><Key className="absolute left-4 top-3.5 text-slate-400" size={18} /><input type="password" placeholder="Sua Senha" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold italic outline-none focus:border-blue-500" value={authForm.password} onChange={e=>setAuthForm({...authForm, password: e.target.value})} /></div>
              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all">Entrar no Sistema</button>
            </form>
            <p className="mt-8 text-center text-slate-300 text-[9px] font-black uppercase tracking-widest leading-relaxed">Ambiente Seguro INEPAD • 2026</p>
          </div>
        </div>
      </div>
    );
  }

  // --- CONTEÚDO PRINCIPAL ---
  let mainContent;

  if (activeMenu === 'dashboard') {
    mainContent = (
      <div className="space-y-8 animate-in fade-in">
        <div className="flex justify-between items-end"><h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Visão Estratégica</h1>{canCreate && <button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info'); setActiveMenu('reunioes');}} className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all">+ Nova Reunião</button>}</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[ {l:'Ações Concluídas', v:stats.act, i:<CheckCircle2/>, c:'blue'}, {l:'ATAs Registradas', v:stats.atas, i:<FileCheck/>, c:'green'} ].map((s, idx) => (
            <div key={idx} className="bg-white p-6 rounded-[32px] border shadow-sm"><div className={`w-10 h-10 rounded-2xl mb-4 flex items-center justify-center ${s.c==='blue'?'bg-blue-50 text-blue-600':'bg-green-50 text-green-600'}`}>{s.i}</div><p className="text-[9px] font-black text-slate-400 uppercase italic mb-1">{s.l}</p><p className="text-2xl font-black text-slate-800 tracking-tighter">{s.v}</p></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border shadow-sm h-96"><h3 className="text-[10px] font-black uppercase mb-6 italic text-slate-500 flex items-center gap-2"><BarChart3 size={16}/> Pendências</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={meetings.map(m=>({n:m.title.substring(0,10), a:m.acoes?.filter(x=>x.status!=='Concluído').length||0}))}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="n" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900}} /><Tooltip/><Bar dataKey="a" fill="#ef4444" radius={[6,6,0,0]} barSize={25}/></BarChart></ResponsiveContainer></div></div>
          <div className="bg-white p-8 rounded-[40px] border shadow-sm h-96 flex flex-col text-center justify-center"><PieIcon size={48} className="mx-auto text-slate-100 mb-4" /><p className="text-[10px] font-black text-slate-300 uppercase italic">Métricas de Saúde do Conselho</p></div>
        </div>
        <div className="bg-white p-8 rounded-[40px] border shadow-sm overflow-hidden"><div className="flex justify-between items-center mb-6"><h3 className="text-[10px] font-black uppercase italic text-slate-500 flex items-center gap-2"><Target size={16}/> Plano de Ações</h3></div><table className="w-full text-left font-bold italic"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="p-4">Tarefa</th><th className="p-4">Reunião</th><th className="p-4 text-center">Status</th><th className="p-4">Dono</th></tr></thead><tbody>{stats.pending.slice(0, 5).map((a, i) => (<tr key={i} className="border-t hover:bg-slate-50/50"><td className="p-4 text-slate-800 underline italic">{a.title}</td><td className="p-4 text-slate-400 text-[10px] uppercase font-black">{a.mTitle}</td><td className="p-4 text-center"><span className="px-3 py-1 rounded-full text-[8px] font-black uppercase bg-amber-100 text-amber-700">{a.status}</span></td><td className="p-4 text-slate-500">{a.resp}</td></tr>))}</tbody></table></div>
      </div>
    );
  } else if (activeMenu === 'auditoria' && isAdm) {
    mainContent = (
      <div className="space-y-8 animate-in fade-in">
        <h1 className="text-2xl font-black italic text-slate-800 tracking-tighter flex items-center gap-3"><History className="text-blue-600" size={28}/> Auditoria de Segurança</h1>
        <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden">
          <table className="w-full text-left font-bold italic">
            <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b italic"><tr><th className="p-6">Data/Hora</th><th className="p-6">Usuário</th><th className="p-6">Ação</th><th className="p-6">Detalhes</th></tr></thead>
            <tbody>{auditLogs.map((log) => (<tr key={log.id} className="border-t hover:bg-slate-50/50"><td className="p-6 text-[10px] text-slate-400 font-black">{log.date}</td><td className="p-6 text-xs text-blue-600 font-black uppercase">{log.user}</td><td className="p-6"><span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${log.action === 'Exclusão' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{log.action}</span></td><td className="p-6 text-xs text-slate-600">{log.details}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
    );
  } else if (activeMenu === 'usuarios' && isAdm) {
    mainContent = (
      <div className="space-y-8 animate-in fade-in">
        <h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Membros do Conselho</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4 h-fit sticky top-0">
             <h3 className="text-[10px] font-black uppercase italic text-slate-400 flex items-center gap-2"><UserPlus size={16}/> Novo Usuário</h3>
             <input placeholder="Nome" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold italic outline-none focus:border-blue-400" value={newUserForm.name} onChange={e=>setNewUserForm({...newUserForm, name: e.target.value})} />
             <input placeholder="Email" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold italic outline-none focus:border-blue-400" value={newUserForm.email} onChange={e=>setNewUserForm({...newUserForm, email: e.target.value})} />
             <input type="password" placeholder="Senha Temporária" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:border-blue-400" value={newUserForm.password} onChange={e=>setNewUserForm({...newUserForm, password: e.target.value})} />
             <select className="w-full p-3 border rounded-xl text-[10px] font-black uppercase italic bg-white" value={newUserForm.role} onChange={e=>setNewUserForm({...newUserForm, role: e.target.value})}>
               <option value="Administrador">Administrador</option><option value="Secretário">Secretário</option><option value="Conselheiro">Conselheiro</option>
             </select>
             <button onClick={handleCreateUser} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Cadastrar</button>
          </div>
          <div className="md:col-span-3 bg-white rounded-[40px] border shadow-sm overflow-hidden"><table className="w-full text-left font-bold italic"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="p-6">Usuário</th><th className="p-6">Perfil</th><th className="p-6 text-center">Ações</th></tr></thead><tbody>{users.map((u, i) => (
            <tr key={i} className="border-t"><td className="p-6 text-xs">{u.name}<p className="text-[9px] text-slate-400 font-black">{u.email}</p></td><td className="p-6"><span className="bg-slate-50 p-2 rounded-xl text-[9px] font-black uppercase">{u.role}</span></td><td className="p-6 text-center"><button onClick={()=>{if(u.id!==1){ setUsers(users.filter(x=>x.id!==u.id)); addLog('Exclusão', `Remoção do usuário: ${u.name}`); }}} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button></td></tr>
          ))}</tbody></table></div>
        </div>
      </div>
    );
  } else if (activeMenu === 'perfil') {
    mainContent = (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
        <h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Meu Perfil</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 bg-white p-8 rounded-[40px] border shadow-sm flex flex-col items-center text-center">
            <div className="relative mb-6 cursor-pointer" onClick={()=>profilePicRef.current?.click()}>
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-50 shadow-inner bg-slate-100 flex items-center justify-center">{currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : <UserCircle size={80} className="text-slate-300" />}</div>
              <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full border-4 border-white shadow-lg"><Camera size={14}/></div>
              <input type="file" ref={profilePicRef} className="hidden" onChange={(e)=>{const f=e.target.files?.[0]; if(f){const r=new FileReader(); r.onloadend=()=>{const b=r.result; setUsers(users.map(u=>u.id===currentUser.id?{...u, avatar:b}:u)); setCurrentUser({...currentUser, avatar:b}); addLog('Perfil', 'Avatar atualizado.');}; r.readAsDataURL(f);}}} />
            </div>
            <h3 className="font-black italic text-slate-800">{currentUser.name}</h3><p className="text-[10px] font-black uppercase text-slate-400">{currentUser.role}</p>
          </div>
          <div className="md:col-span-2 bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2">Nome</label><input className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold italic outline-none" value={profileForm.name} onChange={e=>setProfileForm({...profileForm, name: e.target.value})} /></div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2">E-mail</label><input className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold italic outline-none" value={profileForm.email} onChange={e=>setProfileForm({...profileForm, email: e.target.value})} /></div>
            </div>
            <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2">Alterar Senha</label><input type="password" placeholder="Mudar sua senha" title="Mínimo 6 caracteres" className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold outline-none focus:border-blue-500" onChange={e=>setProfileForm({...profileForm, newPass: e.target.value})} /></div>
            <button onClick={()=>{ if(profileForm.newPass && profileForm.newPass.length < 6) return alert("Nova senha muito curta!"); setUsers(users.map(u=>u.id===currentUser.id?{...u, name:profileForm.name, email:profileForm.email, password: profileForm.newPass || u.password}:u)); setCurrentUser({...currentUser, name:profileForm.name, email:profileForm.email}); addLog('Perfil', 'Dados atualizados.'); alert("Perfil salvo!");}} className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 shadow-xl hover:bg-black transition-all"><Save size={16}/> Confirmar Alterações</button>
          </div>
        </div>
      </div>
    );
  } else if (view === 'list') {
    mainContent = (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex justify-between items-center"><h1 className="text-2xl font-black italic tracking-tighter">Reuniões</h1><div className="flex gap-2">{canDelete && <button onClick={()=>{setMeetings([]); addLog('Exclusão', 'Histórico de reuniões limpo.');}} className="border-2 border-red-100 text-red-400 px-4 py-2 rounded-2xl font-black text-[10px] uppercase hover:bg-red-50">Zerar</button>}{canCreate && <button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">+ Agendar</button>}</div></div>
        <div className="grid gap-3">{meetings.map((m, idx) => (<div key={idx} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-6 rounded-[32px] border flex justify-between items-center group cursor-pointer hover:border-blue-400 shadow-sm transition-all"><div className="flex items-center gap-4"><div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all"><Calendar size={20}/></div><div><h3 className="font-bold italic">{m.title || "Rascunho"}</h3><p className="text-[9px] font-black text-blue-600 uppercase italic tracking-widest">{m.status} • {m.date || "Sem data"}</p></div></div><div className="flex items-center gap-4">{canDelete && <button onClick={(e)=>{e.stopPropagation(); setMeetings(meetings.filter(x=>x.id!==m.id)); addLog('Exclusão', `Reunião removida: ${m.title}`);}} className="p-2 text-slate-200 hover:text-red-500 transition-all"><Trash2 size={18}/></button>}<ChevronRight className="text-slate-200 group-hover:text-blue-600 transition-all"/></div></div>))}</div>
      </div>
    );
  } else {
    // EDITOR DE REUNIÃO (Preservado)
    mainContent = (
      <div className="animate-in fade-in pb-20">
        <div className="flex justify-between items-center mb-8"><button onClick={()=>setView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-[10px] font-black uppercase italic transition-all"><ChevronRight className="rotate-180" size={16}/> Voltar</button><button onClick={handleSaveMeeting} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all flex items-center gap-2"><Save size={16}/> Salvar Reunião</button></div>
        <input placeholder="Título da Reunião..." className="text-3xl font-black text-slate-800 tracking-tighter bg-transparent outline-none w-full italic mb-8 border-b-2 border-slate-100 focus:border-blue-300 pb-2 shadow-none" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} />
        <div className="border-b border-slate-200 flex gap-6 mb-8 overflow-x-auto scrollbar-hide font-black text-[9px] uppercase italic tracking-widest">{['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'Atas'].map((t, i) => (<button key={i} onClick={()=>setTab(['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i])} className={`pb-3 transition-all relative whitespace-nowrap ${tab === ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i] ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>{t}</button>))}</div>
        {tab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-[32px] border shadow-sm"><h3 className="text-[10px] font-black uppercase mb-4 italic text-slate-400 flex items-center gap-2"><UserPlus size={16}/> Participantes</h3><div className="space-y-2 mb-4">{currentMeeting.participants.map((p:any, i:any) => (<div key={i} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs font-bold italic border border-slate-100"><div>{p.name}<p className="text-[9px] text-slate-400 font-black">{p.email}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, participants: currentMeeting.participants.filter((_:any, idx:any)=>idx!==i)})}><X size={14}/></button></div>))}</div><div className="space-y-2 p-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><input placeholder="Nome" className="w-full p-2 text-xs border rounded-xl outline-none" value={tmpPart.name} onChange={e=>setTmpPart({...tmpPart, name:e.target.value})} /><input placeholder="Email" className="w-full p-2 text-xs border rounded-xl outline-none" value={tmpPart.email} onChange={e=>setTmpPart({...tmpPart, email:e.target.value})} /><button onClick={()=>{if(tmpPart.name){setCurrentMeeting({...currentMeeting, participants:[...currentMeeting.participants, tmpPart]}); setTmpPart({name:'', email:''});}}} className="w-full py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase">Adicionar</button></div></div>
            <div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4 h-full"><h3 className="text-[10px] font-black uppercase mb-4 italic text-slate-400 flex items-center gap-2"><Clock size={16}/> Logística</h3><div className="flex gap-2">{['Online', 'Presencial', 'Híbrida'].map(t => (<button key={t} onClick={()=>setCurrentMeeting({...currentMeeting, type: t})} className={`flex-1 py-2 border rounded-xl text-[9px] font-black uppercase transition-all ${currentMeeting.type === t ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>{t}</button>))}</div><div className="grid grid-cols-2 gap-2"><input type="date" value={currentMeeting.date} onChange={e=>setCurrentMeeting({...currentMeeting, date: e.target.value})} className="p-3 border rounded-xl text-xs font-bold italic bg-slate-50 outline-none" /><input type="time" value={currentMeeting.time} onChange={e=>setCurrentMeeting({...currentMeeting, time: e.target.value})} className="p-3 border rounded-xl text-xs font-bold italic bg-slate-50 outline-none" /></div><input placeholder="Link ou Sala" className="w-full p-3 border rounded-xl text-xs font-bold outline-none bg-slate-50 italic" value={currentMeeting.type === 'Online' ? currentMeeting.link : currentMeeting.address} onChange={e=>setCurrentMeeting({...currentMeeting, [currentMeeting.type === 'Online' ? 'link' : 'address']: e.target.value})} /></div>
          </div>
        )}
      </div>
    );
  }

  // --- RENDERIZAÇÃO FINAL ---
  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 overflow-hidden leading-tight animate-in fade-in duration-300">
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800"><CheckCircle2 className="text-blue-500" size={24}/><span className="font-bold text-white text-xl uppercase italic tracking-tighter">GovCorp</span></div>
        <nav className="flex-1 p-4 space-y-2 font-bold italic text-xs">
          <button onClick={() => {setActiveMenu('dashboard'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calendar size={18}/> Reuniões</button>
          {isAdm && <button onClick={() => {setActiveMenu('usuarios'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'usuarios' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><UserCog size={18}/> Usuários</button>}
          {isAdm && <button onClick={() => {setActiveMenu('auditoria'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'auditoria' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><History size={18}/> Auditoria</button>}
          <button onClick={() => {setActiveMenu('perfil'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'perfil' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Settings size={18}/> Meu Perfil</button>
          <div className="pt-10 border-t border-slate-800 mt-10"><button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"><LogOut size={18}/> Logout</button></div>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest italic">INEPAD Governança Profissional</span>
          <div className="flex gap-4 text-[10px] font-bold uppercase italic text-slate-400 items-center">
            <div className="text-right"><p className="text-slate-800 font-black tracking-tight">{currentUser.name}</p><p className="flex items-center gap-1 justify-end">{currentUser.role}</p></div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-blue-600 font-black shadow-sm overflow-hidden">
              {currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : <UserCheck size={16}/>}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">{mainContent}</div>
      </main>
    </div>
  );
};

export default App;
