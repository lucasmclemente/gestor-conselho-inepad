import React, { useState, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, Calendar, ChevronRight, UserPlus, 
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, 
  GripVertical, Upload, Save, Lock, Target, FileCheck, BarChart3, 
  PieChart as PieIcon, ExternalLink, LogIn, User, Key, LogOut, UserCheck,
  Mail // Ícone que estava faltando e causou o erro
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const App = () => {
  // --- SISTEMA DE AUTENTICAÇÃO ---
  const [users, setUsers] = useState([
    { id: 1, name: 'Ricardo Oliveira', email: 'admin@inepad.com.br', password: '123456', role: 'Secretário Geral' }
  ]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authState, setAuthState] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });

  // --- NAVEGAÇÃO ---
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('info');
  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);

  // --- DADOS DAS REUNIÕES ---
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

  // --- MÉTRICAS (18/02/2026) ---
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const allA = meetings.flatMap(m => (m.acoes || []).map(a => ({ ...a, mTitle: m.title })));
    const allD = meetings.flatMap(m => m.deliberacoes || []);
    const completed = allA.filter(a => a.status === 'Concluído').length;
    const pending = allA.filter(a => a.status !== 'Concluído');
    const delayed = pending.filter(a => a.date && new Date(a.date) < today).length;
    return {
      act: `${completed}/${allA.length}`,
      del: `${allD.filter(d => d.votes?.some((v:any) => v.status.includes('Aprovado'))).length}/${allD.length}`,
      atas: meetings.reduce((acc, m) => acc + (m.atas?.length || 0), 0),
      delay: delayed, pending
    };
  }, [meetings]);

  // --- LÓGICA DE LOGIN ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.email === authForm.email && u.password === authForm.password);
    if (user) { setCurrentUser(user); setActiveMenu('dashboard'); } 
    else { alert("E-mail ou senha incorretos."); }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.name || !authForm.email || !authForm.password) return alert("Preencha todos os campos.");
    setUsers([...users, { id: Date.now(), ...authForm, role: 'Conselheiro' }]);
    setAuthState('login');
    alert("Conta criada! Agora você pode entrar.");
  };

  // --- LÓGICA DE REUNIÃO ---
  const handleSave = () => {
    if (!currentMeeting.title) return alert("O título é obrigatório!");
    const entry = currentMeeting.id === 0 ? { ...currentMeeting, id: Date.now() } : currentMeeting;
    setMeetings(currentMeeting.id === 0 ? [entry, ...meetings] : meetings.map(m => m.id === entry.id ? entry : m));
    setView('list'); setActiveMenu('dashboard');
  };

  const handleUpload = (e: any, target: 'materiais' | 'atas') => {
    const f = e.target.files?.[0];
    if (f) {
      const entry = { id: Date.now(), name: f.name, uploadedBy: currentUser.name, date: '18/02/2026' };
      setCurrentMeeting(prev => ({ ...prev, [target]: [...prev[target], entry] }));
    }
  };

  // --- COMPONENTES DE TELA ---
  const renderActionRows = (limit?: number) => {
    const data = limit ? stats.pending.slice(0, limit) : stats.pending;
    if (data.length === 0) return <tr><td colSpan={4} className="p-10 text-center text-slate-300 italic uppercase text-[10px]">Sem ações pendentes.</td></tr>;
    return data.map((a, i) => (
      <tr key={i} className="border-t hover:bg-slate-50/50">
        <td className="p-4 text-slate-800 underline decoration-blue-100 italic">{a.title}</td>
        <td className="p-4 text-slate-400 text-[10px] uppercase font-black">{a.mTitle}</td>
        <td className="p-4 text-center"><span className="px-3 py-1 rounded-full text-[8px] font-black uppercase bg-amber-100 text-amber-700">{a.status}</span></td>
        <td className="p-4 text-slate-500">{a.resp}</td>
      </tr>
    ));
  };

  // --- TELA DE LOGIN ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
          <div className="p-10 bg-slate-900 text-white text-center border-b-8 border-blue-600">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-blue-500" />
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">GovCorp</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">INEPAD Governance Manager</p>
          </div>
          <div className="p-10">
            <form onSubmit={authState === 'login' ? handleLogin : handleRegister} className="space-y-4">
              {authState === 'register' && (
                <div className="relative"><User className="absolute left-4 top-3.5 text-slate-400" size={18} /><input placeholder="Nome Completo" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold italic outline-none focus:border-blue-500" value={authForm.name} onChange={e=>setAuthForm({...authForm, name: e.target.value})} /></div>
              )}
              <div className="relative"><Mail className="absolute left-4 top-3.5 text-slate-400" size={18} /><input type="email" placeholder="E-mail" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold italic outline-none focus:border-blue-500" value={authForm.email} onChange={e=>setAuthForm({...authForm, email: e.target.value})} /></div>
              <div className="relative"><Key className="absolute left-4 top-3.5 text-slate-400" size={18} /><input type="password" placeholder="Senha" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold italic outline-none focus:border-blue-500" value={authForm.password} onChange={e=>setAuthForm({...authForm, password: e.target.value})} /></div>
              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all tracking-widest">{authState === 'login' ? 'Acessar Painel' : 'Criar Cadastro'}</button>
            </form>
            <button onClick={() => setAuthState(authState === 'login' ? 'register' : 'login')} className="w-full mt-6 text-slate-400 text-[10px] font-black uppercase hover:text-blue-600">
              {authState === 'login' ? 'Não tem conta? Solicite registro' : 'Já tem registro? Fazer Login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- CONTEÚDO DINÂMICO ---
  let mainContent;
  if (activeMenu === 'dashboard') {
    mainContent = (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-end"><h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Dashboard de Governança</h1><button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info'); setActiveMenu('reunioes');}} className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all tracking-widest">+ Nova Reunião</button></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[ {l:'Ações Concluídas', v:stats.act, i:<CheckCircle2/>, c:'blue'}, {l:'Deliberações Aprovadas', v:stats.del, i:<FileText/>, c:'indigo'}, {l:'ATAs Registradas', v:stats.atas, i:<FileCheck/>, c:'green'}, {l:'Ações Atrasadas', v:stats.delay, i:<AlertCircle/>, c:'red'} ].map((s, idx) => (
            <div key={idx} className="bg-white p-6 rounded-[32px] border shadow-sm"><div className={`w-10 h-10 rounded-2xl mb-4 flex items-center justify-center ${s.c==='blue'?'bg-blue-50 text-blue-600':s.c==='indigo'?'bg-indigo-50 text-indigo-600':s.c==='red'?'bg-red-50 text-red-600':'bg-green-50 text-green-600'}`}>{s.i}</div><p className="text-[9px] font-black text-slate-400 uppercase italic mb-1">{s.l}</p><p className="text-2xl font-black text-slate-800 tracking-tighter">{s.v}</p></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border shadow-sm h-96"><h3 className="text-[10px] font-black uppercase mb-6 italic text-slate-500 flex items-center gap-2"><BarChart3 size={16}/> Decisões por Reunião</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={meetings.map(m=>({n:m.title.substring(0,10), a:m.acoes?.filter(x=>x.status!=='Concluído').length||0}))}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="n" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900}} /><YAxis hide /><Tooltip/><Bar dataKey="a" name="Pendências" fill="#ef4444" radius={[6,6,0,0]} barSize={25}/><Legend/></BarChart></ResponsiveContainer></div></div>
          <div className="bg-white p-8 rounded-[40px] border shadow-sm h-96 flex flex-col"><h3 className="text-[10px] font-black uppercase mb-6 italic text-slate-500 flex items-center gap-2"><PieIcon size={16}/> Status das Ações</h3><div className="flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{n:'Concluídas', v:stats.act.split('/')[0]}, {n:'Pendentes', v:stats.pending.length}]} innerRadius={60} outerRadius={80} dataKey="v" paddingAngle={8}><Cell fill="#10b981"/><Cell fill="#f59e0b"/></Pie><Tooltip/></PieChart></ResponsiveContainer></div></div>
        </div>
        <div className="bg-white p-8 rounded-[40px] border shadow-sm overflow-hidden"><div className="flex justify-between items-center mb-6"><h3 className="text-[10px] font-black uppercase italic text-slate-500 flex items-center gap-2"><Target size={16}/> Monitoramento de Decisões</h3><button onClick={() => setActiveMenu('plano-geral')} className="text-blue-600 text-[10px] font-black uppercase hover:underline">Ver Todas</button></div><table className="w-full text-left font-bold italic"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b italic"><tr><th className="p-4">Decisão</th><th className="p-4">Reunião</th><th className="p-4 text-center">Status</th><th className="p-4">Responsável</th></tr></thead><tbody>{renderActionRows(5)}</tbody></table></div>
      </div>
    );
  } else if (activeMenu === 'plano-geral') {
    mainContent = (
      <div className="space-y-6 animate-in fade-in"><button onClick={() => setActiveMenu('dashboard')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-[10px] font-black uppercase italic"><ChevronRight className="rotate-180" size={16}/> Voltar</button><div className="bg-white p-8 rounded-[40px] border shadow-lg overflow-hidden"><h2 className="text-xl font-black italic text-slate-800 mb-6 flex items-center gap-2"><Target className="text-blue-600"/> Plano de Ações Completo</h2><table className="w-full text-left font-bold italic"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b italic"><tr><th className="p-4">Ação</th><th className="p-4">Reunião</th><th className="p-4 text-center">Status</th><th className="p-4">Responsável</th></tr></thead><tbody>{renderActionRows()}</tbody></table></div></div>
    );
  } else if (view === 'list') {
    mainContent = (
      <div className="space-y-6 animate-in fade-in"><div className="flex justify-between items-center"><h1 className="text-2xl font-black italic tracking-tighter">Histórico de Reuniões</h1><div className="flex gap-2"><button onClick={()=>setMeetings([])} className="border-2 border-red-100 text-red-400 px-4 py-2 rounded-2xl font-black text-[10px] uppercase hover:bg-red-50">Zerar Base</button><button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">+ Agendar</button></div></div><div className="grid gap-3">{meetings.map((m, idx) => (<div key={idx} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-6 rounded-[32px] border flex justify-between items-center group cursor-pointer hover:border-blue-400 shadow-sm transition-all"><div className="flex items-center gap-4"><div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all"><Calendar size={20}/></div><div><h3 className="font-bold italic">{m.title || "Rascunho"}</h3><p className="text-[9px] font-black text-blue-600 uppercase italic">{m.status} • {m.date || "Sem data"}</p></div></div><div className="flex items-center gap-4"><button onClick={(e)=>{e.stopPropagation(); setMeetings(meetings.filter(x=>x.id!==m.id))}} className="p-2 text-slate-200 hover:text-red-500 transition-all"><Trash2 size={18}/></button><ChevronRight className="text-slate-200 group-hover:text-blue-600 transition-all"/></div></div>))}</div></div>
    );
  } else {
    mainContent = (
      <div className="animate-in fade-in pb-20">
        <div className="flex justify-between items-center mb-8"><button onClick={()=>setView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-[10px] font-black uppercase italic transition-all"><ChevronRight className="rotate-180" size={16}/> Voltar</button><button onClick={handleSave} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all flex items-center gap-2"><Save size={16}/> Salvar Reunião</button></div>
        <input placeholder="Título da Reunião..." className="text-3xl font-black text-slate-800 tracking-tighter bg-transparent outline-none w-full italic mb-8 border-b-2 border-slate-100 focus:border-blue-300 pb-2 shadow-none" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} />
        <div className="border-b border-slate-200 flex gap-6 mb-8 overflow-x-auto scrollbar-hide font-black text-[9px] uppercase italic tracking-widest">{['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'Atas'].map((t, i) => (<button key={i} onClick={()=>setTab(['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i])} className={`pb-3 transition-all relative whitespace-nowrap ${tab === ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i] ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>{t}</button>))}</div>
        
        {/* ABAS DO EDITOR */}
        {tab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-[32px] border shadow-sm"><h3 className="text-[10px] font-black uppercase mb-4 italic text-slate-400 flex items-center gap-2"><UserPlus size={16}/> Participantes</h3><div className="space-y-2 mb-4">{currentMeeting.participants.map((p:any, i:any) => (<div key={i} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs font-bold italic border border-slate-100"><div>{p.name}<p className="text-[9px] text-slate-400 font-black">{p.email}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, participants: currentMeeting.participants.filter((_:any, idx:any)=>idx!==i)})}><X size={14}/></button></div>))}</div><div className="space-y-2 p-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><input placeholder="Nome" className="w-full p-2 text-xs border rounded-xl outline-none" value={tmpPart.name} onChange={e=>setTmpPart({...tmpPart, name:e.target.value})} /><input placeholder="Email" className="w-full p-2 text-xs border rounded-xl outline-none" value={tmpPart.email} onChange={e=>setTmpPart({...tmpPart, email:e.target.value})} /><button onClick={()=>{if(tmpPart.name){setCurrentMeeting({...currentMeeting, participants:[...currentMeeting.participants, tmpPart]}); setTmpPart({name:'', email:''});}}} className="w-full py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase">Adicionar</button></div></div>
            <div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4 h-full"><h3 className="text-[10px] font-black uppercase mb-4 italic text-slate-400 flex items-center gap-2"><Clock size={16}/> Logística</h3><div className="flex gap-2">{['Online', 'Presencial', 'Híbrida'].map(t => (<button key={t} onClick={()=>setCurrentMeeting({...currentMeeting, type: t})} className={`flex-1 py-2 border rounded-xl text-[9px] font-black uppercase transition-all ${currentMeeting.type === t ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>{t}</button>))}</div><div className="grid grid-cols-2 gap-2"><input type="date" value={currentMeeting.date} onChange={e=>setCurrentMeeting({...currentMeeting, date: e.target.value})} className="p-3 border rounded-xl text-xs font-bold italic bg-slate-50 outline-none" /><input type="time" value={currentMeeting.time} onChange={e=>setCurrentMeeting({...currentMeeting, time: e.target.value})} className="p-3 border rounded-xl text-xs font-bold italic bg-slate-50 outline-none" /></div><input placeholder="Link da Sala ou Endereço" className="w-full p-3 border rounded-xl text-xs font-bold outline-none bg-slate-50 italic" value={currentMeeting.type === 'Online' ? currentMeeting.link : currentMeeting.address} onChange={e=>setCurrentMeeting({...currentMeeting, [currentMeeting.type === 'Online' ? 'link' : 'address']: e.target.value})} /></div>
          </div>
        )}
        {tab === 'pauta' && (
          <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-6"><div className="flex justify-between items-center font-black uppercase text-[10px] italic text-slate-500"><h3>Ordem do Dia</h3></div><div className="space-y-3">{currentMeeting.pautas.map((p:any, i:any) => (<div key={i} className="flex gap-4 p-5 border rounded-3xl bg-slate-50/50 text-xs items-center shadow-sm font-bold italic"><GripVertical className="text-slate-200"/><div className="flex-1">{p.title}</div><div className="font-black text-blue-600">{p.dur} MIN</div><button onClick={()=>setCurrentMeeting({...currentMeeting, pautas: currentMeeting.pautas.filter((_:any, idx:any)=>idx!==i)})}><Trash2 size={16}/></button></div>))}</div><div className="p-8 bg-slate-50 rounded-[32px] border-2 border-dashed grid grid-cols-4 gap-3"><input placeholder="Assunto" className="col-span-2 p-3 text-xs border rounded-xl outline-none" value={tmpPauta.title} onChange={e=>setTmpPauta({...tmpPauta, title:e.target.value})} /><select className="p-3 text-xs border rounded-xl outline-none font-black uppercase italic bg-white" value={tmpPauta.resp} onChange={e=>setTmpPauta({...tmpPauta, resp:e.target.value})}><option value="">Dono</option>{currentMeeting.participants.map((p:any, idx:any)=>(<option key={idx} value={p.name}>{p.name}</option>))}</select><input type="number" placeholder="Min" className="p-3 text-xs border rounded-xl outline-none" value={tmpPauta.dur} onChange={e=>setTmpPauta({...tmpPauta, dur:e.target.value})} /><button onClick={()=>{if(tmpPauta.title){setCurrentMeeting({...currentMeeting, pautas:[...currentMeeting.pautas, tmpPauta]}); setTmpPauta({title:'', resp:'', dur:''});}}} className="col-span-4 bg-blue-600 text-white rounded-2xl py-3 font-black text-[10px] uppercase shadow-lg">Adicionar à Pauta</button></div></div>
        )}
        {tab === 'delib' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-4"><h3 className="text-[10px] font-black uppercase italic text-slate-400">Deliberação do Conselho</h3><input placeholder="Título da decisão..." className="w-full p-4 border rounded-2xl text-sm font-black italic outline-none bg-slate-50/50" value={tmpDelib.title} onChange={e=>setTmpDelib({...tmpDelib, title: e.target.value})} /><div className="flex flex-wrap gap-2 text-[9px] font-black text-slate-400 uppercase italic">Votantes: {currentMeeting.participants.map((p:any, i:any) => (<button key={i} onClick={()=>setTmpDelib({...tmpDelib, voters: tmpDelib.voters.includes(p.name)?tmpDelib.voters.filter((v:any)=>v!==p.name):[...tmpDelib.voters, p.name]})} className={`px-3 py-1.5 rounded-xl border transition-all ${tmpDelib.voters.includes(p.name)?'bg-blue-600 text-white border-blue-600 shadow-md':'bg-white'}`}>{p.name}</button>))}</div><button onClick={()=>{if(tmpDelib.title && tmpDelib.voters.length > 0){setCurrentMeeting({...currentMeeting, deliberacoes:[...currentMeeting.deliberacoes, {id: Date.now(), title: tmpDelib.title, votes: tmpDelib.voters.map((n:any)=>({name:n, status:'Pendente', saved:false}))}]}); setTmpDelib({title:'', voters:[]});}}} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl tracking-widest">Habilitar Votação</button></div>
            {currentMeeting.deliberacoes.map((d:any, i:any) => (
              <div key={i} className="bg-white rounded-[40px] border shadow-lg overflow-hidden mb-4"><div className="p-6 bg-slate-900 text-white flex justify-between items-center font-black italic text-sm"><span>{d.title}</span><div className="text-[8px] bg-white/10 px-3 py-1 rounded-full font-black uppercase">ID #{d.id.toString().slice(-4)}</div></div><div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">{d.votes.map((v:any, idx:number) => (<div key={idx} className={`p-6 rounded-[32px] border-2 transition-all ${v.saved ? 'bg-slate-50 opacity-80' : 'bg-white shadow-sm border-slate-50'}`}><div className="flex justify-between mb-4 font-black text-xs italic text-slate-700 uppercase"><span>{v.name}</span>{v.saved && <Lock size={12} className="text-green-500"/>}</div><div className="grid grid-cols-2 gap-2 mb-4">{['Aprovado', 'Reprovado', 'Apr. Ressalva', 'Repr. Ressalva'].map(st => (<button key={st} disabled={v.saved} onClick={()=>{const up=currentMeeting.deliberacoes.map((x:any)=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, status:st}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up});}} className={`py-2 rounded-xl text-[8px] font-black uppercase transition-all ${v.status === st ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>{st}</button>))}</div>{!v.saved && v.status !== 'Pendente' && <button onClick={()=>{const up=currentMeeting.deliberacoes.map((x:any)=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, saved:true}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up});}} className="w-full py-3 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase shadow-xl">Gravar Voto Oficial</button>}</div>))}</div></div>
            ))}
          </div>
        )}
        {tab === 'acoes' && (
          <div className="space-y-6 animate-in fade-in"><div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-4"><h3 className="text-[10px] font-black uppercase italic flex items-center gap-2 text-blue-600"><Target size={18}/> Nova Ação do Conselho</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><input placeholder="Tarefa?" className="p-4 text-xs border rounded-2xl outline-none font-bold italic bg-slate-50/50 shadow-inner" value={tmpAcao.title} onChange={e=>setTmpAcao({...tmpAcao, title: e.target.value})} /><select className="p-4 text-xs border rounded-2xl font-black uppercase italic bg-white" value={tmpAcao.resp} onChange={e=>setTmpAcao({...tmpAcao, resp: e.target.value})}><option value="">Dono</option>{currentMeeting.participants.map((p:any,i:any)=>(<option key={i} value={p.name}>{p.name}</option>))}</select><input type="date" className="p-4 text-xs border rounded-2xl font-bold italic bg-slate-50/50 outline-none" value={tmpAcao.date} onChange={e=>setTmpAcao({...tmpAcao, date: e.target.value})} /></div><button onClick={()=>{if(tmpAcao.title){setCurrentMeeting({...currentMeeting, acoes: [...currentMeeting.acoes, {...tmpAcao, id: Date.now()}]}); setTmpAcao({title:'', resp:'', date:'', status:'Pendente'});}}} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl tracking-widest hover:scale-[1.01] transition-all">Registrar Ação</button></div><div className="bg-white rounded-[40px] border shadow-sm overflow-hidden text-[10px] font-bold italic"><table className="w-full text-left font-black tracking-tight"><thead className="bg-slate-50 font-black uppercase text-slate-400 border-b tracking-widest"><tr><th className="p-6">Tarefa</th><th className="p-6">Dono</th><th className="p-6 text-center">Prazo</th><th className="p-6 text-center">Status</th></tr></thead><tbody>{currentMeeting.acoes.map((a:any, i:any) => (<tr key={i} className="border-t hover:bg-slate-50/50 transition-all"><td className="p-6 text-slate-700 underline decoration-slate-100 italic">{a.title}</td><td className="p-6 text-slate-500">{a.resp}</td><td className="p-6 text-center text-slate-400 font-black uppercase">{a.date}</td><td className="p-6 text-center"><select value={a.status} onChange={e => setCurrentMeeting({...currentMeeting, acoes: currentMeeting.acoes.map((x:any) => x.id === a.id ? {...x, status: e.target.value} : x)})} className="p-2 border rounded-xl font-black uppercase text-[8px] outline-none shadow-sm transition-all">{['Pendente', 'Andamento', 'Concluído'].map(s => <option key={s} value={s}>{s}</option>)}</select></td></tr>))}</tbody></table></div></div>
        )}
        {tab === 'materiais' && (
          <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-8"><div className="flex justify-between items-center border-b pb-4"><h3 className="font-black text-[10px] uppercase italic text-slate-500">Documentação</h3><button onClick={()=>fileRef.current?.click()} className="bg-blue-600 text-white px-6 py-2 rounded-2xl text-[9px] font-black uppercase shadow-xl hover:scale-105 transition-all"><Upload size={14} className="inline mr-2"/>Subir Material</button><input type="file" ref={fileRef} className="hidden" onChange={(e)=>handleUpload(e, 'materiais')} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{currentMeeting.materiais.map((m:any, i:any) => (<div key={i} className="p-5 bg-white rounded-3xl flex items-center gap-4 border shadow-sm group transition-all hover:border-blue-100"><FileText size={24} className="text-blue-600"/><div className="flex-1 text-xs font-bold truncate italic">{m.name}<p className="text-[8px] text-slate-400 font-black uppercase mt-1">Enviado por {m.uploadedBy}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, materiais: currentMeeting.materiais.filter((_:any, idx:any)=>idx!==i)})} className="text-red-300 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button></div>))}</div></div>
        )}
        {tab === 'atas' && (
          <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-8"><div className="flex justify-between items-center border-b pb-4"><div><h3 className="text-[10px] font-black uppercase flex items-center gap-2 italic text-green-700 tracking-widest"><FileCheck size={18}/> Atas Registradas</h3><p className="text-[8px] text-slate-400 font-black uppercase mt-1 italic tracking-widest tracking-widest">Documentação oficial INEPAD</p></div><button onClick={()=>ataRef.current?.click()} className="bg-green-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105"><Upload size={14} className="inline mr-2"/>Subir Ata Final</button><input type="file" ref={ataRef} className="hidden" onChange={(e)=>handleUpload(e, 'atas')} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{currentMeeting.atas.map((ata:any, i:any) => (<div key={i} className="p-5 bg-green-50/50 border border-green-100 rounded-[32px] flex items-center gap-4 group transition-all hover:border-green-300 shadow-sm"><FileCheck size={28} className="text-green-600 shadow-sm"/><div className="flex-1 min-w-0 font-bold italic"><p className="text-sm text-slate-700 truncate tracking-tight">{ata.name}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, atas: currentMeeting.atas.filter((_:any, idx:any) => idx !== i)})} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button></div>))}</div></div>
        )}
      </div>
    );
  }

  // --- ESTRUTURA FINAL ---
  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 overflow-hidden leading-tight animate-in fade-in duration-300">
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800"><CheckCircle2 className="text-blue-500" size={24}/><span className="font-bold text-white text-xl uppercase italic tracking-tighter">GovCorp</span></div>
        <nav className="flex-1 p-4 space-y-2 font-bold italic text-xs">
          <button onClick={() => {setActiveMenu('dashboard'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calendar size={18}/> Reuniões</button>
          <div className="pt-10 border-t border-slate-800 mt-10"><button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"><LogOut size={18}/> Logout</button></div>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest italic tracking-widest">INEPAD Governança Profissional</span>
          <div className="flex gap-4 text-[10px] font-bold uppercase italic text-slate-400 items-center"><div className="text-right"><p className="text-slate-800 font-black tracking-tight">{currentUser.name}</p><p>{currentUser.role}</p></div><div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-black shadow-sm"><UserCheck size={16}/></div></div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">{mainContent}</div>
      </main>
    </div>
  );
};

export default App;
