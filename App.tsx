import React, { useState, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, Calendar, Plus, ChevronRight, Mail, UserPlus, 
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, 
  GripVertical, ClipboardList, Upload, File, MessageSquare, Save, Lock, Target, FileCheck, BarChart3, PieChart as PieIcon, ExternalLink
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const App = () => {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('info');
  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);

  // --- HISTÓRICO DE REUNIÕES ---
  const [meetings, setMeetings] = useState([
    { 
      id: 1, title: 'Conselho de Administração - INEPAD Q4', status: 'CONCLUÍDA', date: '2025-12-10', time: '10:00', type: 'Presencial',
      participants: [{name: 'Ricardo Oliveira', email: 'ricardo@inepad.com.br'}],
      pautas: [{title: 'Aprovação de Verba', duration: '20', responsible: 'Ricardo Oliveira'}],
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

  // --- CÁLCULOS DO DASHBOARD (FILTRANDO CONCLUÍDOS) ---
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const allA = meetings.flatMap(m => (m.acoes || []).map(a => ({ ...a, mTitle: m.title })));
    const allD = meetings.flatMap(m => m.deliberacoes || []);
    
    const completedCount = allA.filter(a => a.status === 'Concluído').length;
    
    // FILTRO: Apenas o que NÃO está concluído
    const pendingActions = allA.filter(a => a.status !== 'Concluído');
    
    const delayed = pendingActions.filter(a => {
      if (!a.date) return false;
      const d = new Date(a.date);
      d.setHours(d.getHours() + (d.getTimezoneOffset() / 60), 0, 0, 0);
      return d < today;
    }).length;

    const approved = allD.filter(d => d.votes?.some((v:any) => v.status.includes('Aprovado'))).length;

    return {
      actLabel: `${completedCount}/${allA.length}`,
      delLabel: `${approved}/${allD.length}`,
      atas: meetings.reduce((acc, m) => acc + (m.atas?.length || 0), 0),
      delay: delayed,
      pendingList: pendingActions
    };
  }, [meetings]);

  // --- ESTADOS TEMPORÁRIOS ---
  const [newPart, setNewPart] = useState({ name: '', email: '' });
  const [newPauta, setNewPauta] = useState({ title: '', responsible: '', duration: '' });
  const [newDelib, setNewDelib] = useState({ title: '', voters: [] as string[] });
  const [newAcao, setNewAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });

  // --- HANDLERS ---
  const handleSave = () => {
    if (!currentMeeting.title) return alert("Defina um título!");
    const entry = currentMeeting.id === 0 ? { ...currentMeeting, id: Date.now() } : currentMeeting;
    setMeetings(currentMeeting.id === 0 ? [entry, ...meetings] : meetings.map(m => m.id === entry.id ? entry : m));
    setView('list'); setActiveMenu('dashboard');
  };

  const handleUpload = (e: any, target: 'materiais' | 'atas') => {
    const f = e.target.files?.[0];
    if (f) {
      const entry = { id: Date.now(), name: f.name, uploadedBy: 'Ricardo Oliveira', date: new Date().toLocaleDateString('pt-BR') };
      setCurrentMeeting({ ...currentMeeting, [target]: [...(currentMeeting as any)[target], entry] });
    }
  };

  // --- RENDERIZADORES DE TABELAS ---
  const renderAcoesTable = (limit?: number) => {
    const list = limit ? stats.pendingList.slice(0, limit) : stats.pendingList;
    return (
      <table className="w-full text-left font-bold italic">
        <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b italic">
          <tr><th className="p-4">Ação</th><th className="p-4">Reunião</th><th className="p-4 text-center">Status</th><th className="p-4">Dono</th></tr>
        </thead>
        <tbody className="text-xs">
          {list.map((a, i) => (
            <tr key={i} className="border-t hover:bg-slate-50/50">
              <td className="p-4 text-slate-800 underline decoration-blue-100">{a.title}</td>
              <td className="p-4 text-slate-400 text-[10px] uppercase font-black">{a.mTitle}</td>
              <td className="p-4 text-center">
                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${a.status==='Andamento'?'bg-blue-100 text-blue-700':'bg-amber-100 text-amber-700'}`}>{a.status}</span>
              </td>
              <td className="p-4 text-slate-500">{a.resp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // --- TELAS PRINCIPAIS ---
  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex justify-between items-end"><h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Visão Estratégica</h1><div className="text-[10px] font-black text-slate-400 uppercase italic">Guaxupé, 18/02/2026</div></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[ {l:'Ações Concluídas', v:stats.actLabel, i:<CheckCircle2/>, c:'blue'}, {l:'Deliberações Aprovadas', v:stats.delLabel, i:<FileText/>, c:'indigo'}, {l:'ATAs Registradas', v:stats.atas, i:<FileCheck/>, c:'green'}, {l:'Ações Atrasadas', v:stats.delay, i:<AlertCircle/>, c:'red'} ].map((s, idx) => (
          <div key={idx} className="bg-white p-6 rounded-[32px] border shadow-sm">
            <div className={`w-10 h-10 rounded-2xl mb-4 flex items-center justify-center ${s.c==='blue'?'bg-blue-50 text-blue-600':s.c==='indigo'?'bg-indigo-50 text-indigo-600':s.c==='red'?'bg-red-50 text-red-600':'bg-green-50 text-green-600'}`}>{s.i}</div>
            <p className="text-[9px] font-black text-slate-400 uppercase italic mb-1">{s.l}</p><p className="text-2xl font-black text-slate-800 tracking-tighter">{s.v}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border shadow-sm h-96"><h3 className="text-[10px] font-black uppercase mb-6 italic text-slate-500">Decisões por Reunião</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={meetings.map(m=>({n:m.title.substring(0,10), p:m.pautas?.length||0, a:m.acoes?.filter(x=>x.status!=='Concluído').length||0}))}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="n" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900}} /><YAxis hide /><Tooltip/><Bar dataKey="p" name="Itens de Pauta" fill="#2563eb" radius={[6,6,0,0]} barSize={25}/><Bar dataKey="a" name="Ações Pendentes" fill="#ef4444" radius={[6,6,0,0]} barSize={25}/><Legend wrapperStyle={{fontSize: '10px', fontWeight: 900, paddingTop: '20px'}}/></BarChart></ResponsiveContainer></div></div>
        <div className="bg-white p-8 rounded-[40px] border shadow-sm h-96 flex flex-col"><h3 className="text-[10px] font-black uppercase mb-6 italic text-slate-500">Saúde do Plano de Ações</h3><div className="flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{n:'Pendentes', v:stats.pendingList.length - stats.delay}, {n:'Atrasadas', v:stats.delay}]} innerRadius={60} outerRadius={80} dataKey="v" paddingAngle={8}><Cell fill="#3b82f6"/><Cell fill="#ef4444"/></Pie><Tooltip/></PieChart></ResponsiveContainer></div><div className="flex justify-center gap-4 text-[8px] font-black uppercase italic"><span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"/> OK</span><span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"/> Atrasadas</span></div></div>
      </div>
      <div className="bg-white p-8 rounded-[40px] border shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[10px] font-black uppercase italic text-slate-500 flex items-center gap-2"><Target size={16}/> Monitoramento do Plano de Ações (Top 5)</h3>
          <button onClick={() => setActiveMenu('plano-geral')} className="text-blue-600 text-[10px] font-black uppercase flex items-center gap-1 hover:underline">Ver Todas <ExternalLink size={12}/></button>
        </div>
        {renderAcoesTable(5)}
        {stats.pendingList.length === 0 && <div className="p-10 text-center text-slate-300 font-black uppercase text-[10px] italic tracking-widest">Nenhuma pendência ativa.</div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 overflow-hidden leading-tight">
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800"><CheckCircle2 className="text-blue-500" size={24}/><span className="font-bold text-white text-xl uppercase italic tracking-tighter">GovCorp</span></div>
        <nav className="flex-1 p-4 space-y-2 font-bold italic text-xs">
          <button onClick={() => setActiveMenu('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calendar size={18}/> Reuniões</button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest italic">INEPAD Governança Profissional</span>
          <div className="flex gap-4 text-[10px] font-bold uppercase italic text-slate-400 items-center"><div className="text-right"><p className="text-slate-800 font-black">Ricardo Oliveira</p><p>Secretário Geral</p></div><div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-black">RO</div></div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          {activeMenu === 'dashboard' && renderDashboard()}
          
          {activeMenu === 'plano-geral' && (
            <div className="space-y-6 animate-in fade-in">
              <button onClick={() => setActiveMenu('dashboard')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-[10px] font-black uppercase italic"><ChevronRight className="rotate-180" size={16}/> Voltar ao Dashboard</button>
              <div className="bg-white p-8 rounded-[40px] border shadow-lg overflow-hidden">
                <h2 className="text-xl font-black italic text-slate-800 mb-6 flex items-center gap-3"><ClipboardList className="text-blue-600" /> Plano de Ações Completo (Pendências)</h2>
                {renderAcoesTable()}
              </div>
            </div>
          )}

          {activeMenu === 'reunioes' && (view === 'list' ? (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center"><h1 className="text-2xl font-black italic tracking-tighter">Gestão de Reuniões</h1><button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all tracking-widest">+ Nova Reunião</button></div>
              <div className="grid gap-3">{meetings.map(m => (<div key={m.id} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-6 rounded-[32px] border flex justify-between items-center group cursor-pointer hover:border-blue-400 shadow-sm transition-all"><div className="flex items-center gap-4"><div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all"><Calendar size={20}/></div><div><h3 className="font-bold italic">{m.title || "Rascunho"}</h3><p className="text-[9px] font-black text-blue-600 uppercase italic tracking-widest">{m.status} • {m.date || "Agendar"}</p></div></div><ChevronRight className="text-slate-200 group-hover:text-blue-600 transition-all"/></div>))}</div>
            </div>
          ) : (
            <div className="animate-in fade-in pb-20">
              <div className="flex justify-between items-center mb-8"><button onClick={()=>setView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-[10px] font-black uppercase italic transition-all"><ChevronRight className="rotate-180" size={16}/> Voltar</button><button onClick={handleSave} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all flex items-center gap-2"><Save size={16}/> Salvar no Histórico</button></div>
              <input placeholder="Título da Reunião..." className="text-3xl font-black text-slate-800 tracking-tighter bg-transparent outline-none w-full italic mb-8 border-b-2 border-slate-100 focus:border-blue-300 pb-2 shadow-none" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} />
              <div className="border-b border-slate-200 flex gap-6 mb-8 overflow-x-auto scrollbar-hide font-black text-[9px] uppercase italic tracking-widest">{['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'Atas'].map((t, i) => (<button key={i} onClick={()=>setTab(['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i])} className={`pb-3 transition-all relative whitespace-nowrap ${tab === ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i] ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>{t}</button>))}</div>
              
              {/* RENDER DAS ABAS DO EDITOR */}
              {tab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                  <div className="bg-white p-6 rounded-[32px] border shadow-sm"><h3 className="text-[10px] font-black uppercase mb-4 italic text-slate-400 flex items-center gap-2"><UserPlus size={16}/> Participantes</h3><div className="space-y-2 mb-4">{currentMeeting.participants.map((p, i) => (<div key={i} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs font-bold italic border"><div>{p.name}<p className="text-[9px] text-slate-400">{p.email}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, participants: currentMeeting.participants.filter((_, idx)=>idx!==i)})}><X size={14}/></button></div>))}</div><div className="space-y-2 p-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><input placeholder="Nome" className="w-full p-2 text-xs border rounded-xl" value={newPart.name} onChange={e=>setNewPart({...newPart, name: e.target.value})} /><input placeholder="Email" className="w-full p-2 text-xs border rounded-xl" value={newPart.email} onChange={e=>setNewPart({...newPart, email: e.target.value})} /><button onClick={()=>{if(newPart.name){setCurrentMeeting({...currentMeeting, participants:[...currentMeeting.participants, newPart]}); setNewPart({name:'', email:''});}}} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase shadow-md">Adicionar</button></div></div>
                  <div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4 h-full"><h3 className="text-[10px] font-black uppercase mb-4 italic text-slate-400 flex items-center gap-2"><Clock size={16}/> Logística</h3><div className="flex gap-2">{['Online', 'Presencial', 'Híbrida'].map(t => (<button key={t} onClick={()=>setCurrentMeeting({...currentMeeting, type: t})} className={`flex-1 py-2 border rounded-xl text-[9px] font-black uppercase ${currentMeeting.type === t ? 'bg-blue-600 text-white shadow-md border-blue-600' : 'bg-slate-50 text-slate-400'}`}>{t}</button>))}</div><div className="grid grid-cols-2 gap-2"><input type="date" value={currentMeeting.date} onChange={e=>setCurrentMeeting({...currentMeeting, date: e.target.value})} className="p-3 border rounded-xl text-xs font-bold italic bg-slate-50 outline-none" /><input type="time" value={currentMeeting.time} onChange={e=>setCurrentMeeting({...currentMeeting, time: e.target.value})} className="p-3 border rounded-xl text-xs font-bold italic bg-slate-50 outline-none" /></div><input placeholder="Link ou Local" className="w-full p-3 border rounded-xl text-xs font-bold outline-none bg-slate-50 italic shadow-inner" value={currentMeeting.type === 'Online' ? currentMeeting.link : currentMeeting.address} onChange={e=>setCurrentMeeting({...currentMeeting, [currentMeeting.type === 'Online' ? 'link' : 'address']: e.target.value})} /></div>
                </div>
              )}
              {tab === 'pauta' && (
                <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-6"><div className="flex justify-between items-center font-black uppercase text-[10px] italic text-slate-500"><h3>Ordem do Dia</h3><span className="text-blue-600">Tempo: {currentMeeting.pautas.reduce((acc, p) => acc + Number(p.duration || 0), 0)} min</span></div><div className="space-y-3">{currentMeeting.pautas.map((p, i) => (<div key={i} className="flex gap-4 p-5 border rounded-3xl bg-slate-50/50 text-xs items-center shadow-sm font-bold italic"><GripVertical className="text-slate-200"/><div className="flex-1">{p.title}</div><div className="font-black text-blue-600">{p.duration} MIN</div><button onClick={()=>setCurrentMeeting({...currentMeeting, pautas: currentMeeting.pautas.filter((_, idx)=>idx!==i)})}><Trash2 size={16}/></button></div>))}</div><button onClick={()=>setCurrentMeeting({...currentMeeting, pautas:[...currentMeeting.pautas, {title: 'Novo Item', duration: '15'}]})} className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Adicionar Pauta</button></div>
              )}
              {tab === 'materiais' && (
                <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-8"><div className="flex justify-between items-center border-b pb-4"><h3 className="font-black text-[10px] uppercase italic text-slate-500">Documentação</h3><button onClick={()=>fileRef.current?.click()} className="bg-blue-600 text-white px-6 py-2 rounded-2xl text-[9px] font-black uppercase shadow-xl"><Upload size={14} className="inline mr-2"/>Subir</button><input type="file" ref={fileRef} className="hidden" onChange={(e)=>handleUpload(e, 'materiais')} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{currentMeeting.materiais.map((m, i) => (<div key={i} className="p-5 bg-white rounded-3xl flex items-center gap-4 border shadow-sm"><FileText size={24} className="text-blue-600"/><div className="flex-1 text-xs font-bold truncate italic">{m.name}</div><button onClick={()=>setCurrentMeeting({...currentMeeting, materiais: currentMeeting.materiais.filter((_, idx)=>idx!==i)})}><Trash2 size={18}/></button></div>))}</div></div>
              )}
              {tab === 'delib' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-4"><h3 className="text-[10px] font-black uppercase italic text-slate-400">Votação</h3><input placeholder="Item para Decisão..." className="w-full p-4 border rounded-2xl text-sm font-black italic outline-none bg-slate-50/50" value={newDelib.title} onChange={e=>setNewDelib({...newDelib, title: e.target.value})} /><button onClick={()=>{if(newDelib.title){setCurrentMeeting({...currentMeeting, deliberacoes:[...currentMeeting.deliberacoes, {id: Date.now(), title: newDelib.title, votes: currentMeeting.participants.map(p=>({name:p.name, status:'Pendente', saved:false}))}]}); setNewDelib({title:'', voters:[]});}}} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl">Abrir Painel</button></div>
                  {currentMeeting.deliberacoes.map((d, i) => (
                    <div key={i} className="bg-white rounded-[40px] border shadow-lg overflow-hidden mb-4"><div className="p-6 bg-slate-900 text-white flex justify-between items-center font-black italic text-sm"><span>{d.title}</span><div className="text-[8px] bg-white/10 px-3 py-1 rounded-full font-black uppercase text-white/50">ID #{d.id.toString().slice(-4)}</div></div><div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">{d.votes.map((v:any, idx:number) => (<div key={idx} className={`p-6 rounded-[32px] border-2 transition-all ${v.saved ? 'bg-slate-50 opacity-80' : 'bg-white shadow-sm border-slate-50'}`}><div className="flex justify-between mb-4 font-black text-xs italic text-slate-700 uppercase"><span>{v.name}</span>{v.saved && <Lock size={12} className="text-green-500"/>}</div><div className="grid grid-cols-2 gap-2 mb-4">{['Aprovado', 'Reprovado', 'Apr. Ressalva', 'Repr. Ressalva'].map(st => (<button key={st} disabled={v.saved} onClick={()=>{const up=currentMeeting.deliberacoes.map(x=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, status:st}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up});}} className={`py-2 rounded-xl text-[8px] font-black uppercase transition-all ${v.status === st ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>{st}</button>))}</div>{!v.saved && v.status !== 'Pendente' && <button onClick={()=>{const up=currentMeeting.deliberacoes.map(x=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, saved:true}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up});}} className="w-full py-3 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase shadow-xl hover:bg-black transition-all">Gravar Voto</button>}</div>))}</div></div>
                  ))}
                </div>
              )}
              {tab === 'acoes' && (
                <div className="space-y-6 animate-in fade-in"><div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-4"><h3 className="text-[10px] font-black uppercase italic flex items-center gap-2 text-blue-600"><Target size={18}/> Nova Ação</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><input placeholder="Tarefa?" className="p-4 text-xs border rounded-2xl outline-none font-bold italic bg-slate-50/50" value={newAcao.title} onChange={e=>setNewAcao({...newAcao, title: e.target.value})} /><select className="p-4 text-xs border rounded-2xl font-black uppercase italic bg-white shadow-sm outline-none" value={newAcao.resp} onChange={e=>setNewAcao({...newAcao, resp: e.target.value})}><option value="">Dono</option>{currentMeeting.participants.map((p,i)=>(<option key={i} value={p.name}>{p.name}</option>))}</select><input type="date" className="p-4 text-xs border rounded-2xl font-bold italic bg-slate-50/50 outline-none" value={newAcao.date} onChange={e=>setNewAcao({...newAcao, date: e.target.value})} /></div><button onClick={()=>{if(newAcao.title){setCurrentMeeting({...currentMeeting, acoes: [...currentMeeting.acoes, {...newAcao, id: Date.now()}]}); setNewAcao({title:'', resp:'', date:'', status:'Pendente'});}}} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl tracking-widest transition-all">Registrar no Plano</button></div><div className="bg-white rounded-[40px] border shadow-sm overflow-hidden text-[10px] font-bold italic"><table className="w-full text-left font-black tracking-tight"><thead className="bg-slate-50 font-black uppercase text-slate-400 border-b tracking-widest"><tr><th className="p-6">Tarefa</th><th className="p-6">Dono</th><th className="p-6">Prazo</th><th className="p-6 text-center">Status</th></tr></thead><tbody>{currentMeeting.acoes.map((a, i) => (<tr key={i} className="border-t hover:bg-slate-50/50 transition-all"><td className="p-6 text-slate-700 underline decoration-slate-100 italic">{a.title}</td><td className="p-6 text-slate-500">{a.resp}</td><td className="p-6 text-slate-400 font-black uppercase italic">{a.date}</td><td className="p-6 text-center"><select value={a.status} onChange={e => setCurrentMeeting({...currentMeeting, acoes: currentMeeting.acoes.map(x => x.id === a.id ? {...x, status: e.target.value} : x)})} className={`p-2 border rounded-xl font-black uppercase text-[8px] outline-none shadow-sm transition-all ${a.status==='Concluído'?'bg-green-100 text-green-700 border-green-200':'bg-blue-100 text-blue-700 border-blue-200'}`}>{['Pendente', 'Andamento', 'Concluído'].map(s => <option key={s} value={s}>{s}</option>)}</select></td></tr>))}</tbody></table></div></div>
              )}
              {tab === 'atas' && (
                <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-8"><div className="flex justify-between items-center border-b pb-4"><div><h3 className="text-[10px] font-black uppercase flex items-center gap-2 italic text-green-700 tracking-widest"><FileCheck size={18}/> Atas Finais</h3><p className="text-[8px] text-slate-400 font-black uppercase mt-1 italic tracking-widest">Documentação oficial assinada</p></div><button onClick={()=>ataRef.current?.click()} className="bg-green-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105"><Upload size={14} className="inline mr-2"/>Subir</button><input type="file" ref={ataRef} className="hidden" onChange={(e)=>handleUpload(e, 'atas')} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{currentMeeting.atas.map((ata, i) => (<div key={i} className="p-5 bg-green-50/50 border border-green-100 rounded-[32px] flex items-center gap-4 group transition-all hover:border-green-300 shadow-sm"><FileCheck size={28} className="text-green-600 shadow-sm"/><div className="flex-1 min-w-0 font-bold italic"><p className="text-sm text-slate-700 truncate tracking-tight">{ata.name}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, atas: currentMeeting.atas.filter((_, idx) => idx !== i)})} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button></div>))}</div></div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
