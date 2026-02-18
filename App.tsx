import React, { useState, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, Plus, ChevronRight, Mail, UserPlus, 
  Clock, MapPin, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, Link as LinkIcon, 
  Map, GripVertical, ClipboardList, User, Upload, File, MessageSquare, Save, Lock, Target, FileCheck, BarChart3, PieChart as PieIcon
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const App = () => {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('info');
  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);

  // --- HISTÓRICO DE REUNIÕES (FONTE DE DADOS) ---
  const [meetings, setMeetings] = useState([
    { 
      id: 1, title: 'Conselho de Administração - Q4 2025', status: 'CONCLUÍDA', date: '2025-12-10', time: '10:00', type: 'Presencial',
      participants: [{name: 'Ricardo Oliveira'}],
      pautas: [{title: 'Aprovação de Verba', duration: '20', responsible: 'Ricardo'}],
      materiais: [{name: 'DRE.pdf'}],
      deliberacoes: [{id: 101, title: 'Verba Marketing 2026', votes: [{status: 'Aprovado', name: 'Ricardo'}]}],
      acoes: [{id: 201, title: 'Contratar agência', deadline: '2025-12-30', status: 'Concluído', resp: 'Ricardo'}],
      atas: [{name: 'Ata_Q4.pdf', uploadedBy: 'Ricardo', date: '10/12/25'}]
    }
  ]);

  // --- RASCUNHO / EDITOR ATIVO ---
  const blankMeeting = {
    id: 0, title: '', status: 'AGENDADA', date: '', time: '', type: 'Híbrida', location: '', address: '', link: '',
    participants: [] as any[], pautas: [] as any[], materiais: [] as any[], deliberacoes: [] as any[], acoes: [] as any[], atas: [] as any[]
  };
  const [currentMeeting, setCurrentMeeting] = useState(blankMeeting);

  // --- CÁLCULOS DINÂMICOS DO DASHBOARD ---
  const stats = useMemo(() => {
    const today = new Date();
    const allActions = meetings.flatMap(m => m.acoes || []);
    const allDelibs = meetings.flatMap(m => m.deliberacoes || []);
    
    const completedActions = allActions.filter(a => a.status === 'Concluído').length;
    const delayedActions = allActions.filter(a => {
      const isOverdue = a.deadline && new Date(a.deadline) < today;
      return isOverdue && a.status !== 'Concluído';
    }).length;

    const approvedDelibs = allDelibs.filter(d => 
      d.votes?.some((v:any) => v.status === 'Aprovado' || v.status === 'Aprovado com Ressalvas')
    ).length;

    const totalAtas = meetings.reduce((acc, m) => acc + (m.atas?.length || 0), 0);

    return {
      actions: `${completedActions}/${allActions.length || 0}`,
      delib: `${approvedDelibs}/${allDelibs.length || 0}`,
      atas: totalAtas,
      delayed: delayedActions,
      allDelibs: allDelibs.slice(0, 5) // Para a tabela de monitoramento
    };
  }, [meetings]);

  const barData = meetings.map(m => ({
    name: m.title.length > 15 ? m.title.substring(0, 15) + '...' : m.title,
    pautas: m.pautas?.length || 0,
    acoes: m.acoes?.length || 0
  }));

  // --- FUNÇÕES DE FORMULÁRIO ---
  const [newPart, setNewPart] = useState({ name: '', email: '' });
  const [newPauta, setNewPauta] = useState({ title: '', responsible: '', duration: '' });
  const [newDelib, setNewDelib] = useState({ title: '', mats: [] as string[], voters: [] as string[] });
  const [newAcao, setNewAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });

  const handleSave = () => {
    if (!currentMeeting.title) return alert("Defina um título!");
    const entry = currentMeeting.id === 0 ? { ...currentMeeting, id: Date.now() } : currentMeeting;
    setMeetings(currentMeeting.id === 0 ? [entry, ...meetings] : meetings.map(m => m.id === entry.id ? entry : m));
    setView('list');
    setActiveMenu('dashboard');
  };

  const handleUpload = (e: any, target: 'materiais' | 'atas') => {
    const f = e.target.files?.[0];
    if (f) {
      const entry = { id: Date.now(), name: f.name, uploadedBy: 'Ricardo Oliveira', date: new Date().toLocaleDateString('pt-BR') };
      setCurrentMeeting({ ...currentMeeting, [target]: [...(currentMeeting as any)[target], entry] });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 overflow-hidden leading-tight">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800">
          <CheckCircle2 className="text-blue-500" size={24}/><span className="font-bold text-white text-xl uppercase italic">GovCorp</span>
        </div>
        <nav className="flex-1 p-4 space-y-2 font-bold italic">
          <button onClick={() => setActiveMenu('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calendar size={18}/> Reuniões</button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] italic">INEPAD Governança Profissional</span>
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase italic text-slate-400">
            <div className="text-right"><p className="text-slate-800 font-black">Ricardo Oliveira</p><p>Secretário Geral</p></div>
            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-black">RO</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          
          {/* TELA: DASHBOARD */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="flex justify-between items-end"><h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Visão Estratégica</h1><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Guaxupé, {new Date().toLocaleDateString('pt-BR')}</div></div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  {l:'Ações Concluídas', v:stats.actions, i:<CheckCircle2/>, c:'blue'}, 
                  {l:'Deliberações Aprovadas', v:stats.delib, i:<FileText/>, c:'indigo'}, 
                  {l:'ATAs Registradas', v:stats.atas, i:<FileCheck/>, c:'green'}, 
                  {l:'Ações Atrasadas', v:stats.delayed, i:<AlertCircle/>, c:'red'}
                ].map((s,i)=>(
                  <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                    <div className={`w-10 h-10 rounded-2xl mb-4 flex items-center justify-center ${s.c==='blue'?'bg-blue-50 text-blue-600':s.c==='indigo'?'bg-indigo-50 text-indigo-600':s.c==='red'?'bg-red-50 text-red-600':'bg-green-50 text-green-600'}`}>{s.i}</div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">{s.l}</p>
                    <p className="text-2xl font-black text-slate-800 tracking-tighter">{s.v}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm h-96">
                  <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center gap-2 italic text-slate-500"><BarChart3 size={16}/> Decisões por Reunião</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                        <YAxis hide />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'}} />
                        <Bar dataKey="pautas" name="Itens de Pauta" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={30} />
                        <Bar dataKey="acoes" name="Ações no Plano" fill="#94a3b8" radius={[6, 6, 0, 0]} barSize={30} />
                        <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 700}} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm h-96 flex flex-col">
                  <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center gap-2 italic text-slate-500"><PieIcon size={16}/> Status das Ações do Conselho</h3>
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={[{n:'Concluídas', v:3}, {n:'Pendentes', v:2}, {n:'Atrasadas', v:stats.delayed}]} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="v">
                          <Cell fill="#10b981"/><Cell fill="#3b82f6"/><Cell fill="#ef4444"/>
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 text-[8px] font-black uppercase italic">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"/> Concluídas</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"/> Pendentes</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"/> Atrasadas</span>
                  </div>
                </div>
              </div>

              {/* TELA: MONITORAMENTO DE DECISÕES */}
              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                 <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center gap-2 italic text-slate-500"><ClipboardList size={16}/> Monitoramento de Decisões</h3>
                 <table className="w-full text-left">
                   <thead className="bg-slate-50 font-black uppercase text-[9px] text-slate-400 border-b italic">
                     <tr><th className="p-4">Data</th><th className="p-4">Reunião</th><th className="p-4">Item de Deliberação</th><th className="p-4">Resultado do Voto</th></tr>
                   </thead>
                   <tbody className="text-xs font-bold italic">
                     {meetings.flatMap(m => m.deliberacoes || []).map((d, i) => (
                       <tr key={i} className="border-t hover:bg-slate-50/50 transition-colors">
                         <td className="p-4 text-slate-400">13/02/2026</td>
                         <td className="p-4 text-slate-800">{meetings.find(m => m.deliberacoes.includes(d))?.title}</td>
                         <td className="p-4 text-slate-700 underline decoration-blue-200">{d.title}</td>
                         <td className="p-4">
                           <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[9px] font-black uppercase tracking-tighter">Aprovado por Unanimidade</span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                 {stats.delib === "0/0" && <div className="p-10 text-center text-slate-300 font-black uppercase text-[10px] italic">Aguardando primeiras deliberações...</div>}
              </div>
            </div>
          )}

          {/* TELA: REUNIÕES */}
          {activeMenu === 'reunioes' && view === 'list' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center"><h1 className="text-2xl font-black italic italic tracking-tighter">Gestão de Reuniões</h1><button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details');}} className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:scale-105 transition-all">+ Nova Reunião</button></div>
              <div className="grid gap-3">
                {meetings.map(m => (
                  <div key={m.id} onClick={()=>{setCurrentMeeting(m); setView('details');}} className="bg-white p-6 rounded-[32px] border border-slate-100 flex justify-between items-center group cursor-pointer hover:border-blue-400 transition-all shadow-sm">
                    <div className="flex items-center gap-4"><div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all"><Calendar size={20}/></div><div><h3 className="font-bold text-slate-800 italic">{m.title || "Rascunho Sem Título"}</h3><p className="text-[9px] font-black text-blue-600 uppercase italic tracking-widest">{m.status} • {m.date || "Agendar"}</p></div></div>
                    <ChevronRight className="text-slate-200 group-hover:text-blue-600 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TELA: EDITOR (COM ABAS RESTAURADAS) */}
          {activeMenu === 'reunioes' && view === 'details' && (
            <div className="animate-in fade-in pb-20">
              <div className="flex justify-between items-center mb-8">
                <button onClick={()=>setView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-[10px] font-black uppercase transition-all"><ChevronRight className="rotate-180" size={16}/> Voltar ao Histórico</button>
                <button onClick={handleSave} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-black shadow-xl transition-all shadow-slate-900/20"><Save size={16}/> Gravar no Conselho</button>
              </div>
              
              <div className="mb-8 border-b-2 border-slate-100 pb-2"><input placeholder="Título da Reunião de Conselho..." className="text-3xl font-black text-slate-800 tracking-tighter bg-transparent outline-none w-full italic" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} /></div>

              <div className="border-b border-slate-200 flex gap-6 mb-8 overflow-x-auto scrollbar-hide font-black text-[9px] uppercase italic tracking-widest">
                {['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'Atas'].map((t, i) => {
                  const id = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i];
                  return <button key={id} onClick={()=>setTab(id)} className={`pb-3 transition-all relative whitespace-nowrap ${tab === id ? 'text-blue-600' : 'text-slate-400'}`}>{t}{tab === id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"/>}</button>
                })}
              </div>

              {/* ABA INFO & CONVITES (Restaurada) */}
              {tab === 'info' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-blue-600 p-8 rounded-[40px] text-white shadow-2xl flex justify-between items-center border-b-8 border-blue-800/20">
                    <div className="space-y-1"><h3 className="font-black uppercase tracking-[0.2em] text-xs italic flex items-center gap-2"><Send size={18}/> Convocação de Conselheiros</h3><p className="text-blue-100 text-[10px] italic font-bold">Enviar notificação oficial para o conselho.</p></div>
                    <button className="bg-white text-blue-600 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Disparar Email</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-[32px] border shadow-sm">
                      <h3 className="text-[10px] font-black uppercase mb-4 italic flex items-center gap-2 text-slate-400"><UserPlus size={16}/> Participantes</h3>
                      <div className="space-y-2 mb-4">{currentMeeting.participants.map((p, i) => (<div key={i} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs font-bold italic border border-slate-100"><div>{p.name}<p className="text-[9px] text-slate-400">{p.email}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, participants: currentMeeting.participants.filter((_, idx)=>idx!==i)})}><X size={14} className="text-slate-300"/></button></div>))}</div>
                      <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><input placeholder="Nome" className="w-full p-2 text-xs border rounded-xl outline-none" value={newPart.name} onChange={e=>setNewPart({...newPart, name: e.target.value})} /><input placeholder="Email" className="w-full p-2 text-xs border rounded-xl outline-none" value={newPart.email} onChange={e=>setNewPart({...newPart, email: e.target.value})} /><button onClick={()=>{if(newPart.name){setCurrentMeeting({...currentMeeting, participants:[...currentMeeting.participants, newPart]}); setNewPart({name:'', email:''});}}} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase">Adicionar</button></div>
                    </div>
                    <div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4">
                      <h3 className="text-[10px] font-black uppercase mb-4 italic flex items-center gap-2 text-slate-400"><Clock size={16}/> Logística Híbrida</h3>
                      <div className="flex gap-2">{['Online', 'Presencial', 'Híbrida'].map(t => (<button key={t} onClick={()=>setCurrentMeeting({...currentMeeting, type: t})} className={`flex-1 py-2 border rounded-xl text-[9px] font-black uppercase transition-all ${currentMeeting.type === t ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>{t}</button>))}</div>
                      <div className="grid grid-cols-2 gap-2"><input type="date" value={currentMeeting.date} onChange={e=>setCurrentMeeting({...currentMeeting, date: e.target.value})} className="p-3 border rounded-xl text-xs font-bold italic outline-none" /><input type="time" value={currentMeeting.time} onChange={e=>setCurrentMeeting({...currentMeeting, time: e.target.value})} className="p-3 border rounded-xl text-xs font-bold italic outline-none" /></div>
                      <input placeholder="Link ou Local da Reunião" className="w-full p-3 border rounded-xl text-xs font-bold outline-none bg-slate-50 italic" value={currentMeeting.type === 'Online' ? currentMeeting.link : currentMeeting.address} onChange={e=>setCurrentMeeting({...currentMeeting, [currentMeeting.type === 'Online' ? 'link' : 'address']: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: ORDEM DO DIA (Restauração Completa) */}
              {tab === 'pauta' && (
                <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-6">
                  <div className="flex justify-between items-center"><h3 className="text-[10px] font-black uppercase tracking-widest italic text-slate-500">Cronograma Operacional</h3><span className="text-[9px] text-blue-600 font-black uppercase italic bg-blue-50 px-3 py-1 rounded-full">Previsão: {currentMeeting.pautas.reduce((acc, p) => acc + Number(p.duration || 0), 0)} min</span></div>
                  <div className="space-y-3">
                    {currentMeeting.pautas.map((p, i) => (<div key={i} className="flex gap-4 p-5 border rounded-3xl bg-slate-50/50 text-xs items-center shadow-sm font-bold italic transition-all hover:bg-white"><GripVertical className="text-slate-200"/><div className="flex-1 text-slate-800">{p.title}</div><div className="text-slate-400 font-black uppercase text-[9px]">{p.responsible}</div><div className="font-black text-blue-600">{p.duration} MIN</div><button onClick={()=>setCurrentMeeting({...currentMeeting, pautas: currentMeeting.pautas.filter((_, idx)=>idx!==i)})}><Trash2 size={16} className="text-slate-200 hover:text-red-500"/></button></div>))}
                  </div>
                  <div className="p-8 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 grid grid-cols-4 gap-3">
                    <input placeholder="Descrição do Assunto" className="col-span-2 p-3 text-xs border rounded-xl outline-none font-bold italic" value={newPauta.title} onChange={e=>setNewPauta({...newPauta, title: e.target.value})} />
                    <select className="p-3 text-xs border rounded-xl font-black uppercase italic outline-none bg-white" value={newPauta.responsible} onChange={e=>setNewPauta({...newPauta, responsible: e.target.value})}><option value="">Dono</option>{currentMeeting.participants.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}</select>
                    <input type="number" placeholder="Min" className="p-3 text-xs border rounded-xl outline-none font-bold" value={newPauta.duration} onChange={e=>setNewPauta({...newPauta, duration: e.target.value})} />
                    <button onClick={()=>{if(newPauta.title){setCurrentMeeting({...currentMeeting, pautas:[...currentMeeting.pautas, newPauta]}); setNewPauta({title:'', responsible:'', duration:''});}}} className="col-span-4 bg-blue-600 text-white rounded-2xl py-3 font-black text-[10px] uppercase tracking-[0.2em] shadow-lg">Registrar Pauta</button>
                  </div>
                </div>
              )}

              {/* ABA 3: MATERIAIS (Restauração Completa) */}
              {tab === 'materiais' && (
                <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-8">
                  <div className="flex justify-between items-center border-b pb-4"><h3 className="font-black text-[10px] uppercase italic tracking-widest text-slate-500">Repositório de Documentos</h3><button onClick={()=>fileRef.current?.click()} className="bg-blue-600 text-white px-6 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl"><Upload size={14} className="inline mr-2"/>Subir Material</button><input type="file" ref={fileRef} className="hidden" onChange={(e)=>handleUpload(e, 'materiais')} /></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentMeeting.materiais.map(m => (<div key={m.id} className="p-5 bg-white rounded-3xl flex items-center gap-4 border-2 border-slate-50 group hover:border-blue-200 transition-all shadow-sm"><div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><FileText size={24}/></div><div className="flex-1 text-xs font-bold truncate italic">{m.name}<p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-1">{m.uploadedBy} • {m.date}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, materiais: currentMeeting.materiais.filter(x=>x.id!==m.id)})} className="opacity-0 group-hover:opacity-100 text-red-300 transition-all"><Trash2 size={18}/></button></div>))}
                    {currentMeeting.materiais.length === 0 && <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-[40px] text-slate-300 font-black uppercase text-[10px] italic">Nenhum documento anexado ainda</div>}
                  </div>
                </div>
              )}

              {/* ABA 4: DELIBERAÇÕES (Voto 4 Níveis Preservado) */}
              {tab === 'delib' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-4">
                    <h3 className="text-[10px] font-black uppercase italic text-slate-400">Novo Ítem para Decisão</h3>
                    <input placeholder="Título da Deliberação Profissional..." className="w-full p-4 border rounded-2xl text-sm font-black italic outline-none bg-slate-50/50" value={newDelib.title} onChange={e=>setNewDelib({...newDelib, title: e.target.value})} />
                    <div className="flex flex-wrap gap-2 text-[9px] font-black text-slate-400 uppercase italic">Participantes: {currentMeeting.participants.map((p, i) => (<button key={i} onClick={()=>setNewDelib({...newDelib, voters: newDelib.voters.includes(p.name)?newDelib.voters.filter(v=>v!==p.name):[...newDelib.voters, p.name]})} className={`px-3 py-1.5 rounded-xl border transition-all ${newDelib.voters.includes(p.name)?'bg-blue-600 text-white shadow-md border-blue-600':'bg-white'}`}>{p.name}</button>))}</div>
                    <button onClick={()=>{if(newDelib.title && newDelib.voters.length > 0){setCurrentMeeting({...currentMeeting, deliberacoes:[...currentMeeting.deliberacoes, {id: Date.now(), title: newDelib.title, votes: newDelib.voters.map(n=>({name:n, status:'Pendente', just:'', saved:false}))}]}); setNewDelib({title:'', mats:[], voters:[]});}}} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl tracking-widest">Habilitar Painel de Votos</button>
                  </div>
                  {currentMeeting.deliberacoes.map(d => (
                    <div key={d.id} className="bg-white rounded-[40px] border shadow-lg overflow-hidden animate-in slide-in-from-top-4">
                      <div className="p-6 bg-slate-900 text-white flex justify-between items-center"><span className="font-black italic text-sm tracking-tight">{d.title}</span><div className="text-[8px] bg-white/10 px-3 py-1 rounded-full font-black uppercase tracking-widest">ID #{d.id.toString().slice(-4)}</div></div>
                      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
                        {d.votes.map((v:any, idx:number) => (
                          <div key={idx} className={`p-6 rounded-[32px] border-2 transition-all ${v.saved ? 'bg-slate-50 border-slate-100 opacity-80' : 'bg-white shadow-sm border-slate-50'}`}>
                            <div className="flex justify-between mb-4 font-black text-xs italic text-slate-700 uppercase tracking-tighter"><span>{v.name}</span>{v.saved && <Lock size={12} className="text-green-500"/>}</div>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                              {['Aprovado', 'Reprovado', 'Aprovado com Ressalvas', 'Reprovado com Ressalvas'].map(st => (
                                <button key={st} disabled={v.saved} onClick={()=>{const up=currentMeeting.deliberacoes.map(x=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, status:st}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up});}} className={`py-2 rounded-xl text-[8px] font-black uppercase transition-all ${v.status === st ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{st}</button>
                              ))}
                            </div>
                            {v.status.includes('Ressalva') && <textarea disabled={v.saved} className="w-full p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[10px] mb-4 font-bold italic outline-none text-amber-900" placeholder="Aponte aqui as ressalvas necessárias para auditoria..." value={v.just} onChange={e=>{const up=currentMeeting.deliberacoes.map(x=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, just:e.target.value}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up});}} />}
                            {!v.saved && v.status !== 'Pendente' && <button onClick={()=>{const up=currentMeeting.deliberacoes.map(x=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, saved:true}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up});}} className="w-full py-3 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase shadow-xl tracking-[0.2em] transition-all hover:bg-black">Gravar Decisão</button>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ABA 5: PLANO DE AÇÃO */}
              {tab === 'acoes' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-4">
                    <h3 className="text-[10px] font-black uppercase italic flex items-center gap-2 text-blue-600"><Target size={18}/> Nova Ação do Plano</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input placeholder="O que deve ser feito?" className="p-4 text-xs border rounded-2xl outline-none font-bold italic bg-slate-50/50" value={newAcao.title} onChange={e=>setNewAcao({...newAcao, title: e.target.value})} />
                      <select className="p-4 text-xs border rounded-2xl font-black uppercase italic outline-none bg-white" value={newAcao.resp} onChange={e=>setNewAcao({...newAcao, resp: e.target.value})}><option value="">Responsável</option>{currentMeeting.participants.map((p,i)=><option key={i} value={p.name}>{p.name}</option>)}</select>
                      <input type="date" className="p-4 text-xs border rounded-2xl outline-none font-bold" value={newAcao.date} onChange={e=>setNewAcao({...newAcao, date: e.target.value})} />
                    </div>
                    <button onClick={()=>{if(newAcao.title){setCurrentMeeting({...currentMeeting, acoes: [...currentMeeting.acoes, {...newAcao, id: Date.now()}]}); setNewAcao({title:'', resp:'', date:'', status:'Pendente'});}}} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl tracking-widest transition-all">Registrar no Plano de Gestão</button>
                  </div>
                  <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden text-[10px] font-bold italic">
                    <table className="w-full text-left"><thead className="bg-slate-50 font-black uppercase text-slate-400 border-b tracking-widest"><tr><th className="p-6">Ação / Tarefa</th><th className="p-6">Responsável</th><th className="p-6">Prazo</th><th className="p-6 text-center">Status</th></tr></thead>
                      <tbody>{currentMeeting.acoes.map(a => (<tr key={a.id} className="border-t hover:bg-slate-50/50 transition-all"><td className="p-6 text-slate-700 underline decoration-slate-100">{a.title}</td><td className="p-6 text-slate-500">{a.resp}</td><td className="p-6 text-slate-400 font-black uppercase">{a.date}</td><td className="p-6 text-center"><select value={a.status} onChange={e => setCurrentMeeting({...currentMeeting, acoes: currentMeeting.acoes.map(x => x.id === a.id ? {...x, status: e.target.value} : x)})} className={`p-2 border rounded-xl font-black uppercase text-[8px] outline-none shadow-sm ${a.status==='Concluído'?'bg-green-100 text-green-700 border-green-200':'bg-blue-100 text-blue-700 border-blue-200'}`}>{['Pendente', 'Andamento', 'Concluído'].map(s => <option key={s} value={s}>{s}</option>)}</select></td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ABA 6: ATAS (Restauração Completa) */}
              {tab === 'atas' && (
                <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-8">
                  <div className="flex justify-between items-center border-b pb-4">
                    <div><h3 className="text-[10px] font-black uppercase flex items-center gap-2 italic text-green-700"><FileCheck size={18}/> Registro Oficial de Atas</h3><p className="text-[8px] text-slate-400 font-black uppercase mt-1 tracking-widest italic">Documentação final assinada pelos conselheiros</p></div>
                    <button onClick={()=>ataRef.current?.click()} className="bg-green-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105"><Upload size={14} className="inline mr-2"/>Subir Ata Final</button><input type="file" ref={ataRef} className="hidden" onChange={(e)=>handleUpload(e, 'atas')} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentMeeting.atas.map(ata => (
                      <div key={ata.id} className="p-5 bg-green-50/50 border border-green-100 rounded-[32px] flex items-center gap-4 group transition-all hover:border-green-300">
                        <FileCheck size={28} className="text-green-600 shadow-sm"/><div className="flex-1 min-w-0"><p className="text-sm font-black text-slate-700 italic truncate tracking-tight">{ata.name}</p><p className="text-[8px] text-slate-400 font-black uppercase tracking-widest italic">{ata.uploadedBy} • {ata.date}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, atas: currentMeeting.atas.filter(a => a.id !== ata.id)})} className="text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                      </div>
                    ))}
                    {currentMeeting.atas.length === 0 && <div className="col-span-full py-24 text-center border-2 border-dashed border-slate-100 rounded-[40px] text-slate-300 font-black uppercase text-[10px] italic tracking-[0.3em]">Repositório de atas vazio</div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
