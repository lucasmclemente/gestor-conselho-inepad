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
  // --- ESTADO INICIAL E USUÁRIOS ---
  const [users, setUsers] = useState([
    { id: 1, name: 'Administrador', email: 'admin@inepad.com.br', password: '@GovInepad2026!', role: 'Administrador' },
    { id: 2, name: 'Secretaria', email: 'secretaria@inepad.com.br', password: 'Sec#Corp2026?', role: 'Secretário' }
  ]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });

  // --- SISTEMA DE REUNIÕES ---
  const [meetings, setMeetings] = useState<any[]>([
    { 
      id: 1, title: 'Reunião Ordinária do Conselho de Administração - Q1', status: 'Concluída', date: '2025-12-10', time: '10:00', type: 'Presencial',
      participants: [{name: 'Beatriz Costa', email: 'b.costa@inepad.com.br'}],
      pautas: [{title: 'Comunicar acionistas sobre dividendos', dur: '20', resp: 'Beatriz Costa'}],
      materiais: [], deliberacoes: [], 
      acoes: [{id: 201, title: 'Comunicar acionistas sobre dividendos', date: '2026-03-20', status: 'Concluída', resp: 'Beatriz Costa'}], 
      atas: [{name: 'Ata_Q1_Final.pdf'}]
    }
  ]);

  const [currentMeeting, setCurrentMeeting] = useState<any>({
    id: 0, title: '', status: 'Agendada', date: '', time: '', type: 'Híbrida', participants: [], pautas: [], materiais: [], deliberacoes: [], acoes: [], atas: []
  });

  // --- LOGS ---
  const [auditLogs, setAuditLogs] = useState<any[]>([
    { id: 1, date: '19/02/2026 14:00', user: 'Sistema', action: 'Integração', details: 'Dashboard e menus de seleção sincronizados.' }
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

  // --- AUXILIARES ---
  const [tmpPart, setTmpPart] = useState({ name: '', email: '' });
  const [tmpPauta, setTmpPauta] = useState({ title: '', resp: '', dur: '' });
  const [tmpAcao, setTmpAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', role: 'Conselheiro', password: '' });

  const isAdm = currentUser?.role === 'Administrador';

  // --- LÓGICA DO DASHBOARD (ESTRITAMENTE CONFORME PRINT) ---
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const allA = meetings.flatMap(m => (m.acoes || []).map((a:any) => ({ ...a, mTitle: m.title })));
    
    const concluidaCount = allA.filter(a => a.status === 'Concluída').length;
    const atrasadaCount = allA.filter(a => a.status !== 'Concluída' && a.date && new Date(a.date) < today).length;
    const andamentoCount = allA.filter(a => a.status === 'Em andamento').length;
    const pendenteCount = allA.filter(a => a.status === 'Pendente').length;
    
    const approvedDelibs = meetings.flatMap(m => m.deliberacoes || []).filter(d => d.votes?.some((v:any) => v.status === 'Aprovado')).length;
    const totalAtas = meetings.reduce((acc, m) => acc + (m.atas?.length || 0), 0);

    return {
      concluida: `${concluidaCount}/${allA.length || 0}`,
      delibs: approvedDelibs,
      atas: totalAtas,
      atrasadas: atrasadaCount,
      allActions: allA,
      pieData: [
        { name: 'Concluídas', value: concluidaCount, color: '#10b981' },
        { name: 'Pendentes', value: pendenteCount + andamentoCount, color: '#f59e0b' },
        { name: 'Atrasadas', value: atrasadaCount, color: '#ef4444' }
      ],
      barData: meetings.map(m => ({
        name: m.date || 'S/D',
        'Itens de Pauta': m.pautas?.length || 0,
        'Planos de Ação': m.acoes?.length || 0
      }))
    };
  }, [meetings]);

  // --- LOGIN ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border">
          <div className="p-8 bg-slate-900 text-white text-center">
            <CheckCircle2 size={40} className="mx-auto mb-2 text-blue-500" />
            <h1 className="text-2xl font-bold uppercase tracking-tighter italic">INEPAD Governança</h1>
          </div>
          <form className="p-8 space-y-4" onSubmit={(e)=>{e.preventDefault(); const u=users.find(x=>x.email===authForm.email); if(u){setCurrentUser(u); addLog('Login', 'Acesso ao sistema.');} else alert('Acesso negado.');}}>
            <input type="email" placeholder="E-mail" className="w-full p-4 border rounded-xl outline-none" onChange={e=>setAuthForm({...authForm, email: e.target.value})} />
            <input type="password" placeholder="Senha" className="w-full p-4 border rounded-xl outline-none" />
            <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold uppercase">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  let mainContent;

  // --- TELA DASHBOARD ---
  if (activeMenu === 'dashboard') {
    mainContent = (
      <div className="space-y-6 animate-in fade-in">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><LayoutDashboard size={20} className="text-blue-600"/> Dashboard de Governança</h1>
        
        {/* CARDS SUPERIORES */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[ {l:'Ações Concluídas', v:stats.concluida, i:<CheckCircle2/>, c:'text-blue-600', bg:'bg-blue-50'}, {l:'Deliberações Aprovadas', v:stats.delibs, i:<Clock/>, c:'text-amber-600', bg:'bg-amber-50'}, {l:'ATAs Registradas', v:stats.atas, i:<FileText/>, c:'text-emerald-600', bg:'bg-emerald-50'}, {l:'Ações Atrasadas', v:stats.atrasadas, i:<AlertCircle/>, c:'text-red-600', bg:'bg-red-50'} ].map((card, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border flex items-center gap-4 shadow-sm">
              <div className={`p-3 rounded-xl ${card.bg} ${card.c}`}>{card.i}</div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">{card.l}</p><p className="text-xl font-black text-slate-800">{card.v}</p></div>
            </div>
          ))}
        </div>

        {/* GRÁFICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border shadow-sm h-80">
            <h3 className="text-sm font-bold text-slate-700 mb-6">Status das Ações do Conselho</h3>
            <div className="h-56"><ResponsiveContainer><PieChart><Pie data={stats.pieData} innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>{stats.pieData.map((e,idx)=>(<Cell key={idx} fill={e.color}/>))}</Pie><Tooltip/><Legend verticalAlign="bottom" height={36}/></PieChart></ResponsiveContainer></div>
          </div>
          <div className="bg-white p-6 rounded-3xl border shadow-sm h-80">
            <h3 className="text-sm font-bold text-slate-700 mb-6">Decisões por Reunião</h3>
            <div className="h-56"><ResponsiveContainer><BarChart data={stats.barData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{fontSize:10}} /><YAxis hide /><Tooltip /><Legend /><Bar dataKey="Itens de Pauta" fill="#4f46e5" radius={[4,4,0,0]} /><Bar dataKey="Planos de Ação" fill="#10b981" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div>
          </div>
        </div>

        {/* TABELA DE MONITORAMENTO */}
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center"><h3 className="text-sm font-bold text-slate-700">Monitoramento de Decisões</h3><button onClick={() => setActiveMenu('plano-geral')} className="text-blue-600 text-xs font-bold hover:underline">Ver todas</button></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-400 uppercase font-bold"><tr className="border-b"><th className="p-4">Ação / Deliberação</th><th className="p-4">Reunião</th><th className="p-4">Status</th><th className="p-4">Responsável</th></tr></thead>
            <tbody>{stats.allActions.slice(0, 5).map((a:any, i:number)=>(<tr key={i} className="border-b hover:bg-slate-50 transition-colors"><td className="p-4 font-bold text-slate-700">{a.title}</td><td className="p-4 text-slate-500 italic">{a.mTitle}</td><td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${a.status==='Concluída'?'bg-emerald-100 text-emerald-700':'bg-blue-100 text-blue-700'}`}>{a.status}</span></td><td className="p-4 font-bold text-slate-600">{a.resp}</td></tr>))}</tbody>
          </table></div>
        </div>
      </div>
    );
  }

  // --- TELA PLANO COMPLETO ---
  else if (activeMenu === 'plano-geral') {
    mainContent = (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex items-center gap-2"><button onClick={() => setActiveMenu('dashboard')} className="p-2 hover:bg-slate-100 rounded-full transition-all"><ChevronRight size={20} className="rotate-180"/></button><h1 className="text-xl font-bold">Plano de Ações Completo</h1></div>
        <div className="bg-white rounded-3xl border shadow-xl overflow-hidden"><table className="w-full text-left text-sm"><thead className="bg-slate-900 text-white uppercase text-[10px] tracking-widest"><tr className="border-b"><th className="p-6">Ação</th><th className="p-6">Origem</th><th className="p-6">Prazo</th><th className="p-6">Status</th><th className="p-6">Dono</th></tr></thead>
          <tbody>{stats.allActions.map((a:any, i:number)=>(<tr key={i} className="border-b hover:bg-slate-50"><td className="p-6 font-bold">{a.title}</td><td className="p-6 text-slate-400 italic">{a.mTitle}</td><td className="p-6 text-slate-500">{a.date}</td><td className="p-6"><select value={a.status} className="p-2 border rounded-lg text-xs font-bold outline-none">{['Pendente','Em andamento','Concluída','Cancelada'].map(s=>(<option key={s} value={s}>{s}</option>))}</select></td><td className="p-6 font-black uppercase text-xs">{a.resp}</td></tr>))}</tbody>
        </table></div>
      </div>
    );
  }

  // --- TELA REUNIÕES ---
  else if (activeMenu === 'reunioes') {
    mainContent = view === 'list' ? (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex justify-between items-center"><h1 className="text-xl font-bold">Conselho de Administração</h1><button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-all">+ Nova Reunião</button></div>
        <div className="grid gap-4">{meetings.map((m, idx) => (<div key={idx} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-6 rounded-2xl border flex justify-between items-center hover:border-blue-500 cursor-pointer transition-all shadow-sm"><div className="flex items-center gap-4"><div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Calendar size={24}/></div><div><h3 className="font-bold">{m.title}</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{m.date} • {m.status}</p></div></div><div className="flex items-center gap-4">{isAdm && <button onClick={(e)=>{e.stopPropagation(); if(window.confirm('Excluir registro?')){setMeetings(meetings.filter(x=>x.id!==m.id)); addLog('Exclusão', `Reunião: ${m.title}`);}}} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={20}/></button>}<ChevronRight className="text-slate-200"/></div></div>))}</div>
      </div>
    ) : (
      <div className="animate-in slide-in-from-right duration-300 pb-20">
        <div className="flex justify-between items-center mb-6"><button onClick={()=>setView('list')} className="text-slate-400 flex items-center gap-1 font-bold"><ChevronRight size={18} className="rotate-180"/> Voltar</button><button onClick={()=>{if(!currentMeeting.title) return alert('Título!'); setMeetings(currentMeeting.id===0?[{...currentMeeting,id:Date.now()},...meetings]:meetings.map(m=>m.id===currentMeeting.id?currentMeeting:m)); setView('list'); addLog('Registro', `Reunião salva: ${currentMeeting.title}`);}} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2"><Save size={18}/> Salvar</button></div>
        <input className="text-3xl font-bold bg-transparent outline-none w-full border-b pb-2 mb-8" placeholder="Título da Reunião" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title:e.target.value})} />
        <div className="flex gap-6 border-b mb-8 overflow-x-auto text-xs font-bold uppercase tracking-widest">{['Informações','Ordem do Dia','Materiais','Deliberações','Plano de Ação','Atas'].map((t,i)=>(<button key={i} onClick={()=>setTab(['info','pauta','materiais','delib','acoes','atas'][i])} className={`pb-4 transition-all ${tab===['info','pauta','materiais','delib','acoes','atas'][i]?'text-blue-600 border-b-2 border-blue-600':'text-slate-400'}`}>{t}</button>))}</div>

        {tab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in">
            <div className="bg-white p-6 rounded-3xl border shadow-sm">
              <h3 className="text-xs font-bold uppercase text-slate-400 mb-4">Participantes Convidados</h3>
              <div className="space-y-3 mb-6">{(currentMeeting.participants || []).map((p:any,i:number)=>(<div key={i} className="flex justify-between p-3 bg-slate-50 rounded-xl text-sm font-bold border"><span>{p.name}</span><button onClick={()=>setCurrentMeeting({...currentMeeting, participants: currentMeeting.participants.filter((_:any,idx:any)=>idx!==i)})}><X size={16}/></button></div>))}</div>
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-dashed border-blue-200 space-y-3"><input placeholder="Nome Completo" className="w-full p-3 rounded-xl border outline-none text-sm" value={tmpPart.name} onChange={e=>setTmpPart({...tmpPart, name:e.target.value})} /><button onClick={()=>{if(tmpPart.name){setCurrentMeeting({...currentMeeting, participants:[...(currentMeeting.participants || []), tmpPart]}); setTmpPart({name:'', email:''});}}} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-xs">ADICIONAR</button></div>
            </div>
            <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase text-slate-400 mb-4">Logística</h3>
              <div className="flex gap-2">{['Online','Presencial','Híbrida'].map(type=>(<button key={type} onClick={()=>setCurrentMeeting({...currentMeeting, type})} className={`flex-1 py-3 border rounded-xl text-xs font-bold transition-all ${currentMeeting.type===type?'bg-blue-600 text-white shadow-md':'bg-slate-50'}`}>{type}</button>))}</div>
              <div className="grid grid-cols-2 gap-4"><input type="date" className="p-3 border rounded-xl font-bold" value={currentMeeting.date} onChange={e=>setCurrentMeeting({...currentMeeting, date:e.target.value})} /><input type="time" className="p-3 border rounded-xl font-bold" value={currentMeeting.time} onChange={e=>setCurrentMeeting({...currentMeeting, time:e.target.value})} /></div>
              <input placeholder={currentMeeting.type==='Online'?'Link da Chamada':'Local da Reunião'} className="w-full p-4 bg-slate-50 border rounded-xl outline-none" value={currentMeeting.link || currentMeeting.address} onChange={e=>setCurrentMeeting({...currentMeeting, [currentMeeting.type==='Online'?'link':'address']:e.target.value})} />
            </div>
          </div>
        )}

        {tab === 'pauta' && (
          <div className="bg-white p-8 rounded-3xl border shadow-sm animate-in fade-in space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase">Itens em Pauta</h3>
            <div className="space-y-3">{(currentMeeting.pautas || []).map((p:any,i:number)=>(<div key={i} className="flex gap-4 p-5 bg-slate-50 rounded-2xl border items-center text-sm font-bold italic"><div className="flex-1">{p.title}</div><div className="text-blue-600">{p.resp}</div><div className="text-slate-400">{p.dur} MIN</div><button onClick={()=>setCurrentMeeting({...currentMeeting, pautas: currentMeeting.pautas.filter((_:any,idx:any)=>idx!==i)})}><Trash2 size={16}/></button></div>))}</div>
            <div className="p-8 bg-slate-50 rounded-3xl border-2 border-dashed grid grid-cols-3 gap-4">
              <input placeholder="Assunto" className="col-span-3 p-3 rounded-xl border" value={tmpPauta.title} onChange={e=>setTmpPauta({...tmpPauta, title:e.target.value})} />
              <select className="p-3 rounded-xl border outline-none font-bold" value={tmpPauta.resp} onChange={e=>setTmpPauta({...tmpPauta, resp:e.target.value})}>
                <option value="">Responsável</option>
                {(currentMeeting.participants || []).map((p:any,i:number)=>(<option key={i} value={p.name}>{p.name}</option>))}
              </select>
              <input type="number" placeholder="Duração (Min)" className="p-3 rounded-xl border" value={tmpPauta.dur} onChange={e=>setTmpPauta({...tmpPauta, dur:e.target.value})} />
              <button onClick={()=>{if(tmpPauta.title){setCurrentMeeting({...currentMeeting, pautas:[...(currentMeeting.pautas||[]), tmpPauta]}); setTmpPauta({title:'',resp:'',dur:''});}}} className="bg-blue-600 text-white rounded-xl font-bold">ADICIONAR ITEM</button>
            </div>
          </div>
        )}

        {tab === 'acoes' && (
          <div className="bg-white p-8 rounded-3xl border shadow-sm animate-in fade-in space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase">Novo Plano de Ação</h3>
            <div className="grid grid-cols-3 gap-4 p-6 bg-slate-50 rounded-2xl">
              <input placeholder="Descrição da Ação" className="col-span-3 p-3 rounded-xl border" value={tmpAcao.title} onChange={e=>setTmpAcao({...tmpAcao, title:e.target.value})} />
              <select className="p-3 rounded-xl border outline-none font-bold" value={tmpAcao.resp} onChange={e=>setTmpAcao({...tmpAcao, resp:e.target.value})}>
                <option value="">Responsável</option>
                {(currentMeeting.participants || []).map((p:any,i:number)=>(<option key={i} value={p.name}>{p.name}</option>))}
              </select>
              <input type="date" className="p-3 rounded-xl border" value={tmpAcao.date} onChange={e=>setTmpAcao({...tmpAcao, date:e.target.value})} />
              <button onClick={()=>{if(tmpAcao.title){setCurrentMeeting({...currentMeeting, acoes:[...(currentMeeting.acoes||[]), {...tmpAcao, id:Date.now()}]}); setTmpAcao({title:'',resp:'',date:'',status:'Pendente'});}}} className="bg-blue-600 text-white rounded-xl font-bold">ADICIONAR AÇÃO</button>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 border-b uppercase"><tr className="text-slate-400"><th className="p-4">Ação</th><th className="p-4">Dono</th><th className="p-4">Prazo</th><th className="p-4">Status</th></tr></thead>
              <tbody>{(currentMeeting.acoes || []).map((a:any,i:number)=>(<tr key={i} className="border-b"><td className="p-4 font-bold">{a.title}</td><td className="p-4">{a.resp}</td><td className="p-4 font-bold text-blue-600">{a.date}</td><td className="p-4"><span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold uppercase text-[9px]">{a.status}</span></td></tr>))}</tbody>
            </table></div>
          </div>
        )}
      </div>
    );
  } else if (activeMenu === 'usuarios' && isAdm) {
    mainContent = (
      <div className="space-y-8 animate-in fade-in">
        <h1 className="text-xl font-bold">Membros do Conselho</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4 h-fit sticky top-0">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Novo Perfil</h3>
            <input placeholder="Nome" className="w-full p-3 border rounded-xl outline-none text-sm" value={newUserForm.name} onChange={e=>setNewUserForm({...newUserForm, name:e.target.value})} />
            <select className="w-full p-3 border rounded-xl text-xs font-bold bg-white" value={newUserForm.role} onChange={e=>setNewUserForm({...newUserForm, role:e.target.value})}>
              <option value="Conselheiro">Conselheiro</option><option value="Secretário">Secretário</option><option value="Administrador">Administrador</option>
            </select>
            <button onClick={()=>{setUsers([...users,{...newUserForm, id:Date.now()}]); alert('Criado!');}} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase">Cadastrar</button>
          </div>
          <div className="md:col-span-3 bg-white rounded-3xl border shadow-sm overflow-hidden"><table className="w-full text-left text-sm font-bold italic text-xs"><thead className="bg-slate-50 text-slate-400 uppercase border-b"><tr><th className="p-6">Nome</th><th className="p-6">Perfil</th></tr></thead><tbody>{users.map((u,i)=>(<tr key={i} className="border-t hover:bg-slate-50 transition-all"><td className="p-6 text-slate-700">{u.name}</td><td className="p-6"><span className="bg-slate-50 px-4 py-1.5 rounded-xl font-black uppercase text-[9px]">{u.role}</span></td></tr>))}</tbody></table></div>
        </div>
      </div>
    );
  } else if (activeMenu === 'auditoria' && isAdm) {
    mainContent = (
      <div className="space-y-6 animate-in fade-in">
        <h1 className="text-xl font-bold flex items-center gap-3"><History className="text-blue-600" /> Log de Auditoria</h1>
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-400 uppercase font-bold border-b"><tr><th className="p-6">Data</th><th className="p-6">Usuário</th><th className="p-6">Ação</th><th className="p-6">Detalhes</th></tr></thead><tbody>{auditLogs.map((log)=>(<tr key={log.id} className="border-t"><td className="p-6 font-bold text-slate-400">{log.date}</td><td className="p-6 text-blue-600 font-bold uppercase">{log.user}</td><td className="p-6"><span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold uppercase text-[9px]">{log.action}</span></td><td className="p-6 text-slate-600">{log.details}</td></tr>))}</tbody></table></div>
      </div>
    );
  }

  // --- ESTRUTURA FINAL ---
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800"><CheckCircle2 className="text-blue-500"/><span className="font-black text-white text-lg uppercase italic tracking-tighter">GovCorp</span></div>
        <nav className="flex-1 p-4 space-y-2 text-xs font-bold uppercase tracking-widest italic">
          <button onClick={()=>setActiveMenu('dashboard')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu==='dashboard'?'bg-blue-600 text-white shadow-lg shadow-blue-500/20':'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={()=>{setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu==='reunioes'?'bg-blue-600 text-white shadow-lg shadow-blue-500/20':'hover:bg-slate-800'}`}><Calendar size={18}/> Reuniões</button>
          {isAdm && <button onClick={()=>setActiveMenu('usuarios')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu==='usuarios'?'bg-blue-600 text-white shadow-lg shadow-blue-500/20':'hover:bg-slate-800'}`}><UserCog size={18}/> Membros</button>}
          {isAdm && <button onClick={()=>setActiveMenu('auditoria')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu==='auditoria'?'bg-blue-600 text-white shadow-lg shadow-blue-500/20':'hover:bg-slate-800'}`}><History size={18}/> Auditoria</button>}
          <div className="pt-10"><button onClick={()=>setCurrentUser(null)} className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-red-400 hover:bg-red-500/10 transition-all uppercase"><LogOut size={18}/> Sair</button></div>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] italic">INEPAD • Ribeirão Preto</span>
          <div className="flex items-center gap-4">
             <div className="text-right"><p className="text-xs font-black text-slate-800 italic uppercase">{currentUser.name}</p><p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">{currentUser.role}</p></div>
             <div className="w-10 h-10 rounded-xl bg-slate-50 border flex items-center justify-center text-blue-600 font-bold shadow-sm uppercase">{currentUser.name[0]}</div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">{mainContent}</div>
      </main>
    </div>
  );
};

export default App;
