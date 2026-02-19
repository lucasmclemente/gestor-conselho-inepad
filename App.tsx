import React, { useState, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, Calendar, ChevronRight, UserPlus, 
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, 
  GripVertical, Upload, Save, Lock, Target, FileCheck, BarChart3, 
  PieChart as PieIcon, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, Settings, Camera, UserCircle, History, MessageSquare
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const App = () => {
  // --- SISTEMA DE USUÁRIOS ---
  const [users, setUsers] = useState([
    { id: 1, name: 'Administrador', email: 'admin@inepad.com.br', password: '@GovInepad2026!', role: 'Administrador' },
    { id: 2, name: 'Secretário Executivo', email: 'secretaria@inepad.com.br', password: 'Sec#Corp2026?', role: 'Secretário' }
  ]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });

  // --- MODELO DE REUNIÃO VAZIA (FIX PARA O BOTÃO NOVA REUNIÃO) ---
  const blankMeeting = {
    id: 0, title: '', status: 'Agendada', date: '', time: '', type: 'Híbrida', link: '', address: '',
    participants: [], pautas: [], materiais: [], deliberacoes: [], acoes: [], atas: []
  };

  // --- ESTADO CENTRAL DE REUNIÕES ---
  const [meetings, setMeetings] = useState<any[]>([
    { 
      id: 1, title: 'Conselho de Administração - Q1 2026', status: 'Agendada', date: '2026-03-15', time: '14:00', type: 'Híbrida', link: 'https://zoom.us/inepad',
      participants: [{name: 'Dr. Lucas Clemente', email: 'lucas@inepad.com.br'}],
      pautas: [{title: 'Expansão Ribeirão Preto', dur: '45', resp: 'Dr. Lucas Clemente'}],
      materiais: [], deliberacoes: [], acoes: [{id: 301, title: 'Relatório de Viabilidade', status: 'Pendente', resp: 'Dr. Lucas Clemente', date: '2026-04-01'}], atas: []
    }
  ]);

  // --- AUDITORIA ---
  const [auditLogs, setAuditLogs] = useState<any[]>([
    { id: 1, date: '19/02/2026 14:30', user: 'Sistema', action: 'Correção', details: 'Botão Nova Reunião restaurado e funções integradas.' }
  ]);

  const addLog = (action: string, details: string) => {
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    setAuditLogs(prev => [{ id: Date.now(), date: formattedDate, user: currentUser?.name || 'Sistema', action, details }, ...prev]);
  };

  // --- NAVEGAÇÃO ---
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('info');
  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);

  const [currentMeeting, setCurrentMeeting] = useState<any>(blankMeeting);

  const [tmpPart, setTmpPart] = useState({ name: '', email: '' });
  const [tmpPauta, setTmpPauta] = useState({ title: '', resp: '', dur: '' });
  const [tmpAcao, setTmpAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });
  const [tmpDelib, setTmpDelib] = useState({ title: '', voters: [] as string[] });
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', role: 'Conselheiro', password: '' });

  const isAdm = currentUser?.role === 'Administrador';

  // --- FUNÇÃO GLOBAL DE STATUS (SINCRONIZAÇÃO) ---
  const updateActionStatus = (meetingId: number, actionId: number, newStatus: string) => {
    setMeetings(prev => prev.map(m => {
      if (m.id === meetingId) {
        return { ...m, acoes: m.acoes.map((a:any) => a.id === actionId ? { ...a, status: newStatus } : a) };
      }
      return m;
    }));
    if (currentMeeting.id === meetingId) {
      setCurrentMeeting((prev:any) => ({
        ...prev,
        acoes: prev.acoes.map((a:any) => a.id === actionId ? { ...a, status: newStatus } : a)
      }));
    }
    addLog('Status', `Ação #${actionId} atualizada.`);
  };

  // --- DASHBOARD ---
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const allA = meetings.flatMap(m => (m.acoes || []).map((a:any) => ({ ...a, mTitle: m.title, mId: m.id })));
    const pendente = allA.filter(a => a.status === 'Pendente').length;
    const andamento = allA.filter(a => a.status === 'Em andamento').length;
    const concluida = allA.filter(a => a.status === 'Concluída').length;
    const atrasada = allA.filter(a => a.status !== 'Concluída' && a.date && new Date(a.date) < today).length;

    return {
      concluida: `${concluida}/${allA.length || 0}`,
      delibs: meetings.flatMap(m => m.deliberacoes || []).length,
      atas: meetings.reduce((acc, m) => acc + (m.atas?.length || 0), 0),
      atrasadas: atrasada,
      allActions: allA,
      pieData: [
        { name: 'Em Andamento', value: andamento, color: '#3b82f6' },
        { name: 'Pendente', value: pendente, color: '#f59e0b' },
        { name: 'Em Atraso', value: atrasada, color: '#ef4444' }
      ],
      barData: meetings.map(m => ({ name: m.date || 'S/D', 'Itens em Pauta': m.pautas?.length || 0, 'Ações no Plano': m.acoes?.length || 0 }))
    };
  }, [meetings]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-10 overflow-hidden">
          <div className="text-center mb-8"><CheckCircle2 size={48} className="mx-auto mb-2 text-blue-500" /><h1 className="text-2xl font-black italic tracking-tighter uppercase">GovCorp</h1></div>
          <form className="space-y-4" onSubmit={(e)=>{e.preventDefault(); const u=users.find(x=>x.email===authForm.email); if(u){setCurrentUser(u); setActiveMenu('dashboard');} else alert('Acesso Negado');}}>
            <input type="email" placeholder="E-mail" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold" onChange={e=>setAuthForm({...authForm, email:e.target.value})} />
            <input type="password" placeholder="Senha" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none" />
            <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase shadow-lg">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  let mainContent;

  if (activeMenu === 'dashboard') {
    mainContent = (
      <div className="space-y-8 animate-in fade-in">
        <h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Visão Estratégica</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[ {l:'Ações Concluídas', v:stats.concluida, i:<CheckCircle2/>, c:'blue'}, {l:'Deliberações', v:stats.delibs, i:<FileText/>, c:'amber'}, {l:'ATAs Registradas', v:stats.atas, i:<FileCheck/>, c:'emerald'}, {l:'Ações Atrasadas', v:stats.atrasadas, i:<AlertCircle/>, c:'red'} ].map((s, idx) => (
            <div key={idx} className="bg-white p-6 rounded-3xl border shadow-sm">
                <div className={`w-10 h-10 rounded-2xl mb-4 flex items-center justify-center ${s.c==='blue'?'bg-blue-50 text-blue-600':s.c==='red'?'bg-red-50 text-red-600':s.c==='amber'?'bg-amber-50 text-amber-600':'bg-emerald-50 text-emerald-600'}`}>{s.i}</div>
                <p className="text-[9px] font-black text-slate-400 uppercase italic mb-1">{s.l}</p><p className="text-2xl font-black text-slate-800 tracking-tighter">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[340px]">
          <div className="bg-white p-8 rounded-[40px] border shadow-sm flex flex-col h-full"><h3 className="text-[10px] font-black uppercase mb-6 text-slate-500 italic">Status das Ações do Conselho</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} innerRadius={50} outerRadius={70} dataKey="value" paddingAngle={5}>{stats.pieData.map((e,i)=>(<Cell key={i} fill={e.color}/>))}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div></div>
          <div className="bg-white p-8 rounded-[40px] border shadow-sm flex flex-col h-full"><h3 className="text-[10px] font-black uppercase mb-6 text-slate-500 italic">Decisões por Reunião</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.barData}><CartesianGrid vertical={false} stroke="#f1f5f9"/><XAxis dataKey="name" tick={{fontSize:9}}/><YAxis hide/><Tooltip/><Bar dataKey="Itens em Pauta" fill="#4f46e5" radius={[4,4,0,0]} barSize={20}/><Bar dataKey="Ações no Plano" fill="#10b981" radius={[4,4,0,0]} barSize={20}/></BarChart></ResponsiveContainer></div></div>
        </div>
        <div className="bg-white p-8 rounded-[40px] border shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-6"><h3 className="text-[10px] font-black uppercase italic text-slate-500">Monitoramento de Decisões</h3><button onClick={() => setActiveMenu('plano-geral')} className="text-blue-600 text-[10px] font-black uppercase hover:underline">Ver todas</button></div>
          <table className="w-full text-left font-bold italic text-xs"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="p-4">Ação</th><th className="p-4">Reunião</th><th className="p-4">Status</th><th className="p-4">Responsável</th></tr></thead>
            <tbody>{stats.allActions.slice(0, 5).map((a:any, i:number)=>(<tr key={i} className="border-t hover:bg-slate-50"><td className="p-4 text-slate-800 underline">{a.title}</td><td className="p-4 text-slate-400">{a.mTitle}</td><td className="p-4"><span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${a.status==='Concluída'?'bg-emerald-100 text-emerald-700':'bg-blue-100 text-blue-700'}`}>{a.status}</span></td><td className="p-4 text-slate-600">{a.resp}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
    );
  } else if (activeMenu === 'plano-geral') {
    mainContent = (
      <div className="space-y-6 animate-in fade-in"><button onClick={() => setActiveMenu('dashboard')} className="text-slate-400 flex items-center gap-1 text-[10px] font-black uppercase italic"><ChevronRight className="rotate-180" size={16}/> Voltar</button>
        <div className="bg-white p-8 rounded-[40px] border shadow-lg overflow-hidden"><h2 className="text-xl font-black italic mb-6">Plano de Ações Integral</h2><table className="w-full text-left font-bold italic text-xs"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="p-6">Ação</th><th className="p-6 text-center">Status</th><th className="p-6">Responsável</th></tr></thead><tbody>{stats.allActions.map((a:any, i:number)=>(<tr key={i} className="border-t hover:bg-slate-50"><td className="p-6 text-slate-800 font-bold">{a.title}</td><td className="p-6 text-center"><select value={a.status} className="p-2 border rounded-xl font-black uppercase text-[9px] outline-none bg-white shadow-sm" onChange={(e) => updateActionStatus(a.mId, a.id, e.target.value)}>{['Pendente','Em andamento','Concluída','Cancelada'].map(st => <option key={st} value={st}>{st}</option>)}</select></td><td className="p-6 font-black text-slate-600 uppercase tracking-tighter">{a.resp}</td></tr>))}</tbody></table></div>
      </div>
    );
  } else if (activeMenu === 'reunioes') {
    mainContent = view === 'list' ? (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex justify-between items-center"><h1 className="text-2xl font-black italic tracking-tighter">Histórico</h1><button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">+ Nova Reunião</button></div>
        <div className="grid gap-3">{meetings.map((m, idx) => (<div key={idx} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-6 rounded-[32px] border flex justify-between items-center group cursor-pointer hover:border-blue-400 shadow-sm transition-all"><div className="flex items-center gap-4"><div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all"><Calendar size={20}/></div><div><h3 className="font-bold italic">{m.title || "Rascunho"}</h3><p className="text-[9px] font-black text-blue-600 uppercase italic tracking-widest">{m.status} • {m.date || "Sem data"}</p></div></div><div className="flex items-center gap-4">{isAdm && <button onClick={(e)=>{e.stopPropagation(); if(window.confirm('Excluir reunião?')){setMeetings(meetings.filter(x=>x.id!==m.id)); addLog('Exclusão', `Reunião: ${m.title}`);}}} className="p-2 text-slate-200 hover:text-red-500 transition-all"><Trash2 size={18}/></button>}<ChevronRight size={18}/></div></div>))}</div>
      </div>
    ) : (
      <div className="animate-in fade-in pb-20">
        <div className="flex justify-between items-center mb-8"><button onClick={()=>setView('list')} className="text-slate-400 flex items-center gap-1 text-[10px] font-black uppercase italic transition-all"><ChevronRight className="rotate-180" size={16}/> Voltar</button><button onClick={()=>{ if(!currentMeeting.title) return alert("Título obrigatório!"); setMeetings(currentMeeting.id === 0 ? [{...currentMeeting, id: Date.now()}, ...meetings] : meetings.map(m=>m.id===currentMeeting.id?currentMeeting:m)); setView('list'); addLog('Registro', `Reunião ${currentMeeting.title} salva.`); }} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center gap-2 hover:bg-black transition-all"><Save size={16}/> Salvar</button></div>
        <input placeholder="Título da Reunião..." className="text-3xl font-black text-slate-800 bg-transparent outline-none w-full italic mb-8 border-b-2 border-slate-100 focus:border-blue-300 pb-2 shadow-none" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} />
        <div className="border-b flex gap-6 mb-8 overflow-x-auto font-black text-[9px] uppercase italic tracking-widest">{['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Plano de Ação', 'Atas'].map((t, i) => (<button key={i} onClick={()=>setTab(['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i])} className={`pb-3 transition-all relative whitespace-nowrap ${tab === ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i] ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>{t}</button>))}</div>
        
        {tab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-[32px] border shadow-sm"><h3 className="text-[10px] font-black uppercase mb-4 italic text-slate-400">Participantes Convidados</h3><div className="space-y-2 mb-4">{(currentMeeting.participants || []).map((p:any, i:any) => (<div key={i} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-[10px] font-bold italic"><span>{p.name} <span className="text-slate-400">({p.email})</span></span><button onClick={()=>setCurrentMeeting({...currentMeeting, participants: currentMeeting.participants.filter((_:any, idx:any)=>idx!==i)})}><X size={14}/></button></div>))}</div><div className="space-y-2 p-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><input placeholder="Nome" className="w-full p-2 text-xs border rounded-xl outline-none" value={tmpPart.name} onChange={e=>setTmpPart({...tmpPart, name:e.target.value})} /><input placeholder="E-mail" className="w-full p-2 text-xs border rounded-xl outline-none" value={tmpPart.email} onChange={e=>setTmpPart({...tmpPart, email:e.target.value})} /><button onClick={()=>{if(tmpPart.name){setCurrentMeeting({...currentMeeting, participants:[...(currentMeeting.participants || []), tmpPart]}); setTmpPart({name:'', email:''});}}} className="w-full py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase">Adicionar</button></div></div>
            <div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4 h-fit"><h3 className="text-[10px] font-black uppercase mb-4 italic text-slate-400">Logística</h3><div className="flex gap-2">{['Online', 'Presencial', 'Híbrida'].map(t => (<button key={t} onClick={()=>setCurrentMeeting({...currentMeeting, type: t})} className={`flex-1 py-3 border rounded-xl text-[9px] font-black uppercase transition-all ${currentMeeting.type === t ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>{t}</button>))}</div><div className="grid grid-cols-2 gap-2"><input type="date" value={currentMeeting.date} className="p-3 border rounded-xl text-xs font-bold bg-slate-50" onChange={e=>setCurrentMeeting({...currentMeeting, date:e.target.value})} /><input type="time" value={currentMeeting.time} className="p-3 border rounded-xl text-xs font-bold bg-slate-50" onChange={e=>setCurrentMeeting({...currentMeeting, time:e.target.value})} /></div><input placeholder={currentMeeting.type==='Online'?"Link da Sala":"Endereço Físico"} className="w-full p-3 border rounded-xl text-xs font-bold bg-slate-50 italic outline-none" value={currentMeeting.type === 'Online' ? currentMeeting.link : currentMeeting.address} onChange={e=>setCurrentMeeting({...currentMeeting, [currentMeeting.type === 'Online' ? 'link' : 'address']: e.target.value})} /></div>
          </div>
        )}
        {tab === 'pauta' && (
          <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-6"><h3 className="text-[10px] font-black uppercase italic text-slate-500">Ordem do Dia</h3><div className="space-y-3">{(currentMeeting.pautas || []).map((p:any, i:any) => (<div key={i} className="flex gap-4 p-5 border rounded-3xl bg-slate-50/50 text-xs items-center shadow-sm font-bold italic"><GripVertical className="text-slate-200"/><div className="flex-1">{p.title}</div><div className="font-black text-slate-400 uppercase text-[9px]">{p.resp}</div><div className="font-black text-blue-600">{p.dur} MIN</div><button onClick={()=>setCurrentMeeting({...currentMeeting, pautas: currentMeeting.pautas.filter((_:any, idx:any)=>idx!==i)})}><Trash2 size={16}/></button></div>))}</div><div className="p-8 bg-slate-50 rounded-[32px] border-2 border-dashed grid grid-cols-4 gap-3">
              <input placeholder="Assunto" className="col-span-2 p-3 text-xs border rounded-xl outline-none" value={tmpPauta.title} onChange={e=>setTmpPauta({...tmpPauta, title:e.target.value})} />
              <select className="p-3 text-xs border rounded-xl font-black uppercase italic bg-white outline-none" value={tmpPauta.resp} onChange={e=>setTmpPauta({...tmpPauta, resp:e.target.value})}>
                <option value="">Responsável</option>
                {(currentMeeting.participants || []).map((p:any, idx:number)=>(<option key={idx} value={p.name}>{p.name}</option>))}
              </select>
              <input type="number" placeholder="Min" className="p-3 text-xs border rounded-xl" value={tmpPauta.dur} onChange={e=>setTmpPauta({...tmpPauta, dur:e.target.value})} />
              <button onClick={()=>{if(tmpPauta.title){setCurrentMeeting({...currentMeeting, pautas:[...(currentMeeting.pautas || []), tmpPauta]}); setTmpPauta({title:'', resp:'', dur:''});}}} className="col-span-4 bg-blue-600 text-white rounded-2xl py-3 font-black text-[10px] uppercase shadow-lg">Adicionar à Pauta</button></div></div>
        )}
        {tab === 'materiais' && (
          <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-8"><div className="flex justify-between items-center border-b pb-4"><h3 className="font-black text-[10px] uppercase italic text-slate-500 tracking-widest">Documentação de Apoio</h3><button onClick={()=>fileRef.current?.click()} className="bg-blue-600 text-white px-6 py-2 rounded-2xl text-[9px] font-black uppercase shadow-xl hover:scale-105 transition-all"><Upload size={14} className="inline mr-2"/>Subir</button><input type="file" ref={fileRef} className="hidden" onChange={(e)=>{const f=e.target.files?.[0]; if(f){setCurrentMeeting({...currentMeeting, materiais: [...(currentMeeting.materiais || []), {id: Date.now(), name: f.name}]});}}} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{(currentMeeting.materiais || []).map((m:any, i:any) => (<div key={i} className="p-5 bg-white rounded-3xl flex items-center gap-4 border shadow-sm group"><FileText size={24} className="text-blue-600"/><div className="flex-1 text-xs font-bold truncate italic">{m.name}</div><button onClick={()=>setCurrentMeeting({...currentMeeting, materiais: currentMeeting.materiais.filter((_:any, idx:any)=>idx!==i)})}><Trash2 size={18}/></button></div>))}</div></div>
        )}
        {tab === 'delib' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-4"><h3 className="text-[10px] font-black uppercase italic text-slate-400">Votação Formal</h3><input placeholder="Item para Deliberação..." className="w-full p-4 border rounded-2xl text-sm font-black italic bg-slate-50 outline-none" value={tmpDelib.title} onChange={e=>setTmpDelib({...tmpDelib, title: e.target.value})} /><div className="flex flex-wrap gap-2 text-[9px] font-black text-slate-400 uppercase italic">Participantes: {(currentMeeting.participants || []).map((p:any, i:any) => (<button key={i} onClick={()=>setTmpDelib({...tmpDelib, voters: tmpDelib.voters.includes(p.name)?tmpDelib.voters.filter(v=>v!==p.name):[...tmpDelib.voters, p.name]})} className={`px-3 py-1.5 rounded-xl border transition-all ${tmpDelib.voters.includes(p.name)?'bg-blue-600 text-white border-blue-600 shadow-md':'bg-white'}`}>{p.name}</button>))}</div><button onClick={()=>{if(tmpDelib.title && tmpDelib.voters.length > 0){setCurrentMeeting({...currentMeeting, deliberacoes:[...(currentMeeting.deliberacoes || []), {id: Date.now(), title: tmpDelib.title, votes: tmpDelib.voters.map(n=>({name:n, status:'Pendente', saved:false, justification:''}))}]}); setTmpDelib({title:'', voters:[]});}}} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl tracking-widest">Iniciar Votação</button></div>
            {(currentMeeting.deliberacoes || []).map((d:any, i:any) => (
              <div key={i} className="bg-white rounded-[40px] border shadow-lg overflow-hidden mb-4"><div className="p-6 bg-slate-900 text-white flex justify-between items-center font-black italic text-sm"><span>{d.title}</span><div className="text-[8px] bg-white/10 px-3 py-1 rounded-full uppercase">Ref #{d.id.toString().slice(-4)}</div></div><div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">{d.votes.map((v:any, idx:number) => (
                <div key={idx} className={`p-6 rounded-[32px] border-2 transition-all ${v.saved ? 'bg-slate-50 opacity-80' : 'bg-white shadow-sm border-slate-100'}`}><div className="flex justify-between mb-4 font-black text-xs italic text-slate-700 uppercase"><span>{v.name}</span>{v.saved && <Lock size={12} className="text-green-500"/>}</div>
                <div className="grid grid-cols-2 gap-2 mb-4">{['Aprovado', 'Reprovado', 'Apr. Ressalva', 'Repr. Ressalva'].map(st => (<button key={st} disabled={v.saved} onClick={()=>{const up=currentMeeting.deliberacoes.map((x:any)=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, status:st}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up});}} className={`py-2 rounded-xl text-[8px] font-black uppercase transition-all ${v.status === st ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>{st}</button>))}</div>
                {v.status.includes('Ressalva') && !v.saved && (<textarea placeholder="Justificativa..." className="w-full p-3 bg-white border-2 border-amber-200 rounded-xl text-xs font-bold italic outline-none mb-4 shadow-inner" value={v.justification} onChange={(e)=>{const up=currentMeeting.deliberacoes.map((x:any)=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, justification:e.target.value}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up});}} />)}
                {!v.saved && v.status !== 'Pendente' && <button onClick={()=>{const up=currentMeeting.deliberacoes.map((x:any)=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, saved:true}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up}); addLog('Votação', v.name);}} className="w-full py-3 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase">Gravar Voto Oficial</button>}</div>))}</div></div>
            ))}
          </div>
        )}
        {tab === 'acoes' && (
          <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-6"><h3 className="text-[10px] font-black uppercase italic text-slate-500">Plano de Ação</h3><div className="grid grid-cols-3 gap-4 p-6 bg-slate-50 rounded-[32px]"><input placeholder="Descrição" className="col-span-3 p-3 text-xs border rounded-xl outline-none" value={tmpAcao.title} onChange={e=>setTmpAcao({...tmpAcao, title: e.target.value})} />
              <select className="p-3 text-xs border rounded-xl font-black uppercase italic bg-white outline-none" value={tmpAcao.resp} onChange={e=>setTmpAcao({...tmpAcao, resp: e.target.value})}>
                <option value="">Responsável</option>
                {(currentMeeting.participants || []).map((p:any, idx:number)=>(<option key={idx} value={p.name}>{p.name}</option>))}
              </select>
              <input type="date" className="p-3 text-xs border rounded-xl font-bold bg-white" value={tmpAcao.date} onChange={e=>setTmpAcao({...tmpAcao, date: e.target.value})} /><button onClick={()=>{if(tmpAcao.title){setCurrentMeeting({...currentMeeting, acoes: [...(currentMeeting.acoes || []), {...tmpAcao, id: Date.now()}]}); setTmpAcao({title:'', resp:'', date:'', status:'Pendente'});}}} className="bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Registrar Ação</button></div><div className="overflow-x-auto"><table className="w-full text-left text-[10px] font-bold italic"><thead className="bg-slate-50 uppercase text-slate-400 border-b"><tr><th className="p-4">Tarefa</th><th className="p-4">Dono</th><th className="p-4 text-center">Status</th></tr></thead><tbody>{(currentMeeting.acoes || []).map((a:any, i:any) => (<tr key={i} className="border-t hover:bg-slate-50"><td className="p-4 text-slate-800 underline">{a.title}</td><td className="p-4">{a.resp}</td><td className="p-4 text-center"><select value={a.status} className="p-2 border rounded-xl font-black uppercase text-[8px] outline-none" onChange={(e)=>updateActionStatus(currentMeeting.id, a.id, e.target.value)}>{['Pendente', 'Em andamento', 'Concluída'].map(st => <option key={st} value={st}>{st}</option>)}</select></td></tr>))}</tbody></table></div></div>
        )}
        {tab === 'atas' && (
          <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-8"><div className="flex justify-between items-center border-b pb-4"><h3 className="text-[10px] font-black uppercase flex items-center gap-2 italic text-green-700 tracking-widest"><FileCheck size={18}/> Documentação (Atas)</h3><button onClick={()=>ataRef.current?.click()} className="bg-green-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase shadow-xl hover:scale-105 transition-all"><Upload size={14} className="inline mr-2"/>Subir</button><input type="file" ref={ataRef} className="hidden" onChange={(e)=>{const f=e.target.files?.[0]; if(f){setCurrentMeeting({...currentMeeting, atas: [...(currentMeeting.atas || []), {id: Date.now(), name: f.name}]});}}} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{(currentMeeting.atas || []).map((ata:any, i:any) => (<div key={i} className="p-5 bg-green-50 border border-green-100 rounded-[32px] flex items-center gap-4 group shadow-sm"><FileCheck size={28} className="text-green-600"/><div className="flex-1 min-w-0 font-bold italic"><p className="text-sm text-slate-700 truncate tracking-tight">{ata.name}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, atas: currentMeeting.atas.filter((_:any, idx:any) => idx !== i)})} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button></div>))}</div></div>
        )}
      </div>
    );
  } else if (activeMenu === 'usuarios') {
    mainContent = (
      <div className="space-y-8 animate-in fade-in"><h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Membros do Conselho</h1><div className="grid grid-cols-1 md:grid-cols-4 gap-6"><div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4 h-fit sticky top-0"><h3 className="text-[10px] font-black uppercase italic text-slate-400 tracking-widest">Novo Perfil</h3><input placeholder="Nome" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none" value={newUserForm.name} onChange={e=>setNewUserForm({...newUserForm, name: e.target.value})} /><input placeholder="Email" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none" value={newUserForm.email} onChange={e=>setNewUserForm({...newUserForm, email: e.target.value})} /><input type="password" placeholder="Senha" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none" value={newUserForm.password} onChange={e=>setNewUserForm({...newUserForm, password: e.target.value})} /><select className="w-full p-3 border rounded-xl text-[10px] font-black uppercase italic bg-white" value={newUserForm.role} onChange={e=>setNewUserForm({...newUserForm, role: e.target.value})}><option value="Conselheiro">Conselheiro</option><option value="Secretário">Secretário</option><option value="Administrador">Administrador</option></select><button onClick={()=>{setUsers([...users, {...newUserForm, id: Date.now()}]); addLog('Segurança', newUserForm.name); alert("Sucesso!");}} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Cadastrar</button></div><div className="md:col-span-3 bg-white rounded-[32px] border shadow-sm overflow-hidden"><table className="w-full text-left font-bold italic text-xs"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="p-6">Nome / E-mail</th><th className="p-6 text-center">Perfil</th><th className="p-6 text-center">Ações</th></tr></thead><tbody>{users.map((u, i) => (<tr key={i} className="border-t hover:bg-slate-50"><td className="p-6 text-xs">{u.name}<p className="text-[9px] text-slate-400 font-black tracking-widest">{u.email}</p></td><td className="p-6 text-center"><span className="bg-slate-50 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase">{u.role}</span></td><td className="p-6 text-center"><button onClick={()=>{if(u.id!==1) setUsers(users.filter(x=>x.id!==u.id));}} className="text-red-300 hover:text-red-500 transition-all"><Trash2 size={18}/></button></td></tr>))}</tbody></table></div></div></div>
    );
  } else if (activeMenu === 'auditoria') {
    mainContent = (
      <div className="space-y-6 animate-in fade-in"><h1 className="text-xl font-bold flex items-center gap-3 italic"><History className="text-blue-600" /> Log de Auditoria</h1><div className="bg-white rounded-[40px] border shadow-sm overflow-hidden"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-400 uppercase font-bold border-b"><tr><th className="p-6">Data</th><th className="p-6">Usuário</th><th className="p-6">Ação</th><th className="p-6">Detalhes</th></tr></thead><tbody>{auditLogs.map((log)=>(<tr key={log.id} className="border-t"><td className="p-6 font-bold text-slate-400">{log.date}</td><td className="p-6 text-blue-600 font-bold uppercase">{log.user}</td><td className="p-6"><span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold uppercase text-[9px]">{log.action}</span></td><td className="p-6 text-slate-600">{log.details}</td></tr>))}</tbody></table></div></div>
    );
  }

  // --- ESTRUTURA FINAL ---
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800"><CheckCircle2 className="text-blue-500"/><span className="font-black text-white text-lg uppercase italic tracking-tighter">GovCorp</span></div>
        <nav className="flex-1 p-4 space-y-2 text-[10px] font-black uppercase italic tracking-widest">
          <button onClick={() => setActiveMenu('dashboard')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calendar size={18}/> Reuniões</button>
          {isAdm && <button onClick={() => setActiveMenu('usuarios')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu === 'usuarios' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><UserCog size={18}/> Membros</button>}
          {isAdm && <button onClick={() => setActiveMenu('auditoria')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu === 'auditoria' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><History size={18}/> Auditoria</button>}
          <div className="pt-10 border-t border-slate-800"><button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"><LogOut size={18}/> Sair</button></div>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">INEPAD Governança Profissional</span>
          <div className="flex gap-4 items-center">
            <div className="text-right"><p className="text-xs font-black text-slate-800 italic uppercase">{currentUser.name}</p><p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">{currentUser.role}</p></div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 border flex items-center justify-center text-blue-600 font-bold shadow-sm">{currentUser.name[0]}</div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">{mainContent}</div>
      </main>
    </div>
  );
};

export default App;
