import React, { useState, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, Calendar, Plus, ChevronRight, Mail, UserPlus, 
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, 
  GripVertical, ClipboardList, Upload, File, MessageSquare, Save, Lock, Target, FileCheck, BarChart3, PieChart as PieIcon
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const App = () => {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('info');
  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);

  const [meetings, setMeetings] = useState([
    { 
      id: 1, title: 'Conselho de Administração - Q4 2025', status: 'CONCLUÍDA', date: '2025-12-10', time: '10:00', type: 'Presencial',
      participants: [{name: 'Ricardo Oliveira', email: 'ricardo@inepad.com.br'}],
      pautas: [{title: 'Aprovação de Verba', duration: '20', responsible: 'Ricardo Oliveira'}],
      materiais: [{id: 1, name: 'DRE_Projetado.pdf', uploadedBy: 'Ricardo', date: '10/12/25'}],
      deliberacoes: [{id: 101, title: 'Verba Marketing 2026', votes: [{status: 'Aprovado', name: 'Ricardo Oliveira', saved: true}]}],
      acoes: [{id: 201, title: 'Contratar agência de branding', date: '2025-12-30', status: 'Concluído', resp: 'Ricardo Oliveira'}],
      atas: [{id: 301, name: 'Ata_Assinada_Q4.pdf', uploadedBy: 'Ricardo', date: '10/12/25'}]
    }
  ]);

  const blankMeeting = {
    id: 0, title: '', status: 'AGENDADA', date: '', time: '', type: 'Híbrida', location: '', address: '', link: '',
    participants: [] as any[], pautas: [] as any[], materiais: [] as any[], deliberacoes: [] as any[], acoes: [] as any[], atas: [] as any[]
  };
  const [currentMeeting, setCurrentMeeting] = useState(blankMeeting);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const allActions = meetings.flatMap(m => (m.acoes || []).map(a => ({ ...a, meetingTitle: m.title })));
    const allDelibs = meetings.flatMap(m => m.deliberacoes || []);
    const completed = allActions.filter(a => a.status === 'Concluído').length;
    const delayed = allActions.filter(a => {
      if (!a.date || a.status === 'Concluído') return false;
      const d = new Date(a.date);
      d.setHours(d.getHours() + (d.getTimezoneOffset() / 60), 0, 0, 0);
      return d < today;
    }).length;
    const approved = allDelibs.filter(d => d.votes?.some((v:any) => v.status.startsWith('Aprovado'))).length;
    const totalAtas = meetings.reduce((acc, m) => acc + (m.atas?.length || 0), 0);
    return { actions: `${completed}/${allActions.length}`, delib: `${approved}/${allDelibs.length}`, atas: totalAtas, delayed, allActions };
  }, [meetings]);

  const [newPart, setNewPart] = useState({ name: '', email: '' });
  const [newPauta, setNewPauta] = useState({ title: '', responsible: '', duration: '' });
  const [newDelib, setNewDelib] = useState({ title: '', mats: [] as string[], voters: [] as string[] });
  const [newAcao, setNewAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });

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

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 overflow-hidden leading-tight">
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800">
          <CheckCircle2 className="text-blue-500" size={24}/><span className="font-bold text-white text-xl uppercase italic tracking-tighter">GovCorp</span>
        </div>
        <nav className="flex-1 p-4 space-y-2 font-bold italic text-xs">
          <button onClick={() => setActiveMenu('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calendar size={18}/> Reuniões</button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest italic tracking-widest">INEPAD Governança Profissional</span>
          <div className="flex gap-4 text-[10px] font-bold uppercase italic text-slate-400 items-center">
            <div className="text-right"><p className="text-slate-800 font-black tracking-tight">Ricardo Oliveira</p><p>Secretário Geral</p></div>
            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-black shadow-sm">RO</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          {activeMenu === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="flex justify-between items-end"><h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Visão Estratégica</h1><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Guaxupé, {new Date().toLocaleDateString('pt-BR')}</div></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  {l:'Ações Concluídas', v:stats.actions, i:<CheckCircle2/>, c:'bg-blue-50 text-blue-600'}, 
                  {l:'Deliberações Aprovadas', v:stats.delib, i:<FileText/>, c:'bg-indigo-50 text-indigo-600'}, 
                  {l:'ATAs Registradas', v:stats.atas, i:<FileCheck/>, c:'bg-green-50 text-green-600'}, 
                  {l:'Ações Atrasadas', v:stats.delayed, i:<AlertCircle/>, c:'bg-red-50 text-red-600'}
                ].map((s,i)=>(
                  <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm transition-all hover:shadow-md">
                    <div className={`w-10 h-10 rounded-2xl mb-4 flex items-center justify-center ${s.c}`}>{s.i}</div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">{s.l}</p>
                    <p className="text-2xl font-black text-slate-800 tracking-tighter">{s.v}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm h-96">
                  <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center gap-2 italic text-slate-500"><BarChart3 size={16}/> Decisões por Reunião</h3>
                  <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={meetings.map(m=>({n:m.title.substring(0,10), p:m.pautas?.length||0, a:m.acoes?.length||0}))}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="n" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} /><YAxis hide /><Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)'}} /><Bar dataKey="p" name="Pautas" fill="#2563eb" radius={[6,6,0,0]} barSize={25} /><Bar dataKey="a" name="Ações" fill="#94a3b8" radius={[6,6,0,0]} barSize={25} /><Legend wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 900}} /></BarChart></ResponsiveContainer></div>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm h-96 flex flex-col">
                  <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center gap-2 italic text-slate-500"><PieIcon size={16}/> Status das Ações do Conselho</h3>
                  <div className="flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{n:'OK', v:10}, {n:'Atrasadas', v:stats.delayed}]} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="v"><Cell fill="#10b981"/><Cell fill="#ef4444"/></Pie><Tooltip/></PieChart></ResponsiveContainer></div>
                  <div className="flex justify-center gap-4 text-[8px] font-black uppercase italic"><span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"/> OK</span><span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"/> Atrasadas</span></div>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                 <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center gap-2 italic text-slate-500"><Target size={16}/> Monitoramento do Plano de Ações</h3>
                 <table className="w-full text-left">
                   <thead className="bg-slate-50 font-black uppercase text-[9px] text-slate-400 border-b italic"><tr><th className="p-4">Ação</th><th className="p-4">Reunião</th><th className="p-4">Status</th><th className="p-4">Responsável</th></tr></thead>
                   <tbody className="text-xs font-bold italic">{stats.allActions.map((a, i) => (<tr key={i} className="border-t hover:bg-slate-50/50 transition-colors"><td className="p-4 text-slate-800 underline decoration-blue-200">{a.title}</td><td className="p-4 text-slate-400 text-[10px] uppercase font-black">{a.meetingTitle}</td><td className="p-4"><span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter ${a.status === 'Concluído' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{a.status}</span></td><td className="p-4 text-slate-500">{a.resp}</td></tr>))}</tbody>
                 </table>
              </div>
            </div>
          )}

          {activeMenu === 'reunioes' && (view === 'list' ? (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center"><h1 className="text-2xl font-black italic tracking-tighter">Gestão de Reuniões</h1><button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details');}} className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">+ Nova Reunião</button></div>
              <div className="grid gap-3">{meetings.map(m => (<div key={m.id} onClick={()=>{setCurrentMeeting(m); setView('details');}} className="bg-white p-6 rounded-[32px] border border-slate-100 flex justify-between items-center group cursor-pointer hover:border-blue-400 shadow-sm transition-all"><div className="flex items-center gap-4"><div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all"><Calendar size={20}/></div><div><h3 className="font-bold text-slate-800 italic">{m.title || "Sem Título"}</h3><p className="text-[9px] font-black text-blue-600 uppercase italic tracking-widest">{m.status} • {m.date || "Agendar"}</p></div></div><ChevronRight className="text-slate-200 group-hover:text-blue-600 transition-all"/></div>))}</div>
            </div>
          ) : (
            <div className="animate-in fade-in pb-20">
              <div className="flex justify-between items-center mb-8"><button onClick={()=>setView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-[10px] font-black uppercase italic"><ChevronRight className="rotate-180" size={16}/> Voltar</button><button onClick={handleSave} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all"><Save size={16}/> Salvar Histórico</button></div>
              <input placeholder="Título da Reunião..." className="text-3xl font-black text-slate-800 tracking-tighter bg-transparent outline-none w-full italic mb-8 border-b-2 border-slate-100 focus:border-blue-300 pb-2 shadow-none" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} />
              <div className="border-b border-slate-200 flex gap-6 mb-8 overflow-x-auto scrollbar-hide font-black text-[9px] uppercase italic tracking-widest">{['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'Atas'].map((t, i) => {
                  const id = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i];
                  return <button key={id} onClick={()=>setTab(id)} className={`pb-3 transition-all relative whitespace-nowrap ${tab === id ? 'text-blue-600' : 'text-slate-400'}`}>{t}{tab === id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"/>}</button>
                })}</div>

              {tab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                  <div className="bg-white p-6 rounded-[32px] border shadow-sm">
                    <h3 className="text-[10px] font-black uppercase mb-4 italic flex items-center gap-2 text-slate-400"><UserPlus size={16}/> Participantes</h3>
                    <div className="space-y-2 mb-4">{currentMeeting.participants.map((p, i) => (<div key={i} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs font-bold italic border border-slate-100"><div>{p.name}<p className="text-[9px] text-slate-400">{p.email}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, participants: currentMeeting.participants.filter((_, idx)=>idx!==i)})}><X size={14}/></button></div>))}</div>
                    <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><input placeholder="Nome" className="w-full p-2 text-xs border rounded-xl" value={newPart.name} onChange={e=>setNewPart({...newPart, name: e.target.value})} /><input placeholder="Email" className="w-full p-2 text-xs border rounded-xl" value={newPart.email} onChange={e=>setNewPart({...newPart, email: e.target.value})} /><button onClick={()=>{if(newPart.name){setCurrentMeeting({...currentMeeting, participants:[...currentMeeting.participants, newPart]}); setNewPart({name:'', email:''});}}} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase shadow-md">Adicionar</button></div>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4 h-full">
                    <h3 className="text-[10px] font-black uppercase mb-4 italic flex items-center gap-2 text-slate-400"><Clock size={16}/> Logística Híbrida</h3>
                    <div className="flex gap-2">{['Online', 'Presencial', 'Híbrida'].map(t => (<button key={t} onClick={()=>setCurrentMeeting({...currentMeeting, type: t})} className={`flex-1 py-2 border rounded-xl text-[9px] font-black uppercase transition-all ${currentMeeting.type === t ? 'bg-blue-600 text-white shadow-md border-blue-600' : 'bg-slate-50 text-slate-400'}`}>{t}</button>))}</div>
                    <div className="grid grid-cols-2 gap-2"><input type="date" value={currentMeeting.date} onChange={e=>setCurrentMeeting({...currentMeeting, date: e.target.value})} className="p-3 border rounded-xl text-xs font-bold italic outline-none bg-slate-50" /><input type="time" value={currentMeeting.time} onChange={e=>setCurrentMeeting({...currentMeeting, time: e.target.value})} className="p-3 border rounded-xl text-xs font-bold italic outline-none bg-slate-50" /></div>
                    <input placeholder="Local / Link" className="w-full p-3 border rounded-xl text-xs font-bold outline-none bg-slate-50 italic" value={currentMeeting.type === 'Online' ? currentMeeting.link : currentMeeting.address} onChange={e=>setCurrentMeeting({...currentMeeting, [currentMeeting.type === 'Online' ? 'link' : 'address']: e.target.value})} />
                  </div>
                </div>
              )}

              {tab === 'pauta' && (
                <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-6">
                  <div className="flex justify-between items-center"><h3 className="text-[10px] font-black uppercase tracking-widest italic text-slate-500">Cronograma</h3><span className="text-[9px] text-blue-600 font-black uppercase italic bg-blue-50 px-3 py-1 rounded-full">Total: {currentMeeting.pautas.reduce((acc, p) => acc + Number(p.duration || 0), 0)} min</span></div>
                  <div className="space-y-3">{currentMeeting.pautas.map((p, i) => (<div key={i} className="flex gap-4 p-5 border rounded-3xl bg-slate-50/50 text-xs items-center shadow-sm font-bold italic"><GripVertical className="text-slate-200"/><div className="flex-1">{p.title}</div><div className="text-[9px] font-black uppercase">{p.responsible}</div><div className="font-black text-blue-600">{p.duration} MIN</div><button onClick={()=>setCurrentMeeting({...currentMeeting, pautas: currentMeeting.pautas.filter((_, idx)=>idx!==i)})}><Trash2 size={16}/></button></div>))}</div>
                  <div className="p-8 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 grid grid-cols-4 gap-3">
                    <input placeholder="Assunto" className="col-span-2 p-3 text-xs border rounded-xl outline-none font-bold italic" value={newPauta.title} onChange={e=>setNewPauta({...newPauta, title: e.target.value})} />
                    <select className="p-3 text-xs border rounded-xl font-black uppercase italic bg-white" value={newPauta.responsible} onChange={e=>setNewPauta({...newPauta, responsible: e.target.value})}><option value="">Dono</option>{currentMeeting.participants.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}</select>
                    <input type="number" placeholder="Min" className="p-3 text-xs border rounded-xl outline-none font-bold" value={newPauta.duration} onChange={e=>setNewPauta({...newPauta, duration: e.target.value})} />
                    <button onClick={()=>{if(newPauta.title){setCurrentMeeting({...currentMeeting, pautas:[...currentMeeting.pautas, newPauta]}); setNewPauta({title:'', responsible:'', duration:''});}}} className="col-span-4 bg-blue-600 text-white rounded-2xl py-3 font-black text-[10px] uppercase shadow-lg">Registrar Pauta</button>
                  </div>
                </div>
              )}

              {tab === 'materiais' && (
                <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-8">
                  <div className="flex justify-between items-center border-b pb-4"><h3 className="font-black text-[10px] uppercase italic tracking-widest text-slate-500">Documentação</h3><button onClick={()=>fileRef.current?.click()} className="bg-blue-600 text-white px-6 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl"><Upload size={14} className="inline mr-2"/>Subir Material</button><input type="file" ref={fileRef} className="hidden" onChange={(e)=>handleUpload(e, 'materiais')} /></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{currentMeeting.materiais.map(m => (<div key={m.id} className="p-5 bg-white rounded-3xl flex items-center gap-4 border-2 border-slate-50 shadow-sm"><FileText size={24} className="text-blue-600"/><div className="flex-1 text-xs font-bold truncate italic">{m.name}<p className="text-[8px] text-slate-400 font-black uppercase mt-1 tracking-widest">{m.uploadedBy} • {m.date}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, materiais: currentMeeting.materiais.filter(x=>x.id!==m.id)})}><Trash2 size={18} className="text-red-300 hover:text-red-500"/></button></div>))}</div>
                </div>
              )}

              {tab === 'delib' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-4">
                    <h3 className="text-[10px] font-black uppercase italic text-slate-400 tracking-widest italic">Nova Pauta para Votação</h3>
                    <input placeholder="Título da Deliberação Profissional..." className="w-full p-4 border rounded-2xl text-sm font-black italic outline-none bg-slate-50/50" value={newDelib.title} onChange={e=>setNewDelib({...newDelib, title: e.target.value})} />
                    <div className="flex flex-wrap gap-2 text-[9px] font-black text-slate-400 uppercase italic">Votantes: {currentMeeting.participants.map((p, i) => (<button key={i} onClick={()=>setNewDelib({...newDelib, voters: newDelib.voters.includes(p.name)?newDelib.voters.filter(v=>v!==p.name):[...newDelib.voters, p.name]})} className={`px-3 py-1.5 rounded-xl border transition-all ${newDelib.voters.includes(p.name)?'bg-blue-600 text-white shadow-md border-blue-600':'bg-white'}`}>{p.name}</button>))}</div>
                    <button onClick={()=>{if(newDelib.title && newDelib.voters.length > 0){setCurrentMeeting({...currentMeeting, deliberacoes:[...currentMeeting.deliberacoes, {id: Date.now(), title: newDelib.title, votes: newDelib.voters.map(n=>({name:n, status:'Pendente', just:'', saved:false}))}]}); setNewDelib({title:'', mats:[], voters:[]});}}} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl tracking-widest">Habilitar Voto</button>
                  </div>
                  {currentMeeting.deliberacoes.map(d => (
                    <div key={d.id} className="bg-white rounded-[40px] border shadow-lg overflow-hidden mb-4">
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
                            {v.status.includes('Ressalva') && <textarea disabled={v.saved} className="w-full p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[10px] mb-4 font-bold italic outline-none text-amber-900 shadow-inner" placeholder="Justifique..." value={v.just} onChange={e=>{const up=currentMeeting.deliberacoes.map(x=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, just:e.target.value}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up});}} />}
                            {!v.saved && v.status !== 'Pendente' && <button onClick={()=>{const up=currentMeeting.deliberacoes.map(x=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, saved:true}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up});}} className="w-full py-3 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase shadow-xl tracking-[0.2em] transition-all hover:bg-black">Gravar Decisão</button>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'acoes' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-4">
                    <h3 className="text-[10px] font-black uppercase italic flex items-center gap-2 text-blue-600 tracking-[0.2em]"><Target size={18}/> Nova Ação do Plano</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input placeholder="O que deve ser feito?" className="p-4 text-xs border rounded-2xl outline-none font-bold italic bg-slate-50/50" value={newAcao.title} onChange={e=>setNewAcao({...newAcao, title: e.target.value})} />
                      <select className="p-4 text-xs border rounded-2xl font-black uppercase italic outline-none bg-white shadow-sm" value={newAcao.resp} onChange={e=>setNewAcao({...newAcao, resp: e.target.value})}><option value="">Responsável</option>{currentMeeting.participants.map((p,i)=><option key={i} value={p.name}>{p.name}</option>)}</select>
                      <input type="date" className="p-4 text-xs border rounded-2xl outline-none font-bold italic bg-slate-50/50 shadow-inner" value={newAcao.date} onChange={e=>setNewAcao({...newAcao, date: e.target.value})} />
                    </div>
                    <button onClick={()=>{if(newAcao.title){setCurrentMeeting({...currentMeeting, acoes: [...currentMeeting.acoes, {...newAcao, id: Date.now()}]}); setNewAcao({title:'', resp:'', date:'', status:'Pendente'});}}} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl tracking-widest transition-all hover:scale-[1.01]">Adicionar ao Plano</button>
                  </div>
                  <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden text-[10px] font-bold italic shadow-slate-100">
                    <table className="w-full text-left font-black tracking-tight"><thead className="bg-slate-50 font-black uppercase text-slate-400 border-b tracking-widest"><tr><th className="p-6">Tarefa</th><th className="p-6">Responsável</th><th className="p-6">Prazo</th><th className="p-6 text-center">Status</th></tr></thead>
                      <tbody>{currentMeeting.acoes.map(a => (<tr key={a.id} className="border-t hover:bg-slate-50/50 transition-all"><td className="p-6 text-slate-700 underline decoration-slate-100 italic">{a.title}</td><td className="p-6 text-slate-500">{a.resp}</td><td className="p-6 text-slate-400 font-black uppercase italic">{a.date}</td><td className="p-6 text-center"><select value={a.status} onChange={e => setCurrentMeeting({...currentMeeting, acoes: currentMeeting.acoes.map(x => x.id === a.id ? {...x, status: e.target.value} : x)})} className={`p-2 border rounded-xl font-black uppercase text-[8px] outline-none shadow-sm transition-all ${a.status==='Concluído'?'bg-green-100 text-green-700 border-green-200':'bg-blue-100 text-blue-700 border-blue-200'}`}>{['Pendente', 'Andamento', 'Concluído'].map(s => <option key={s} value={s}>{s}</option>)}</select></td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'atas' && (
                <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-8">
                  <div className="flex justify-between items-center border-b pb-4">
                    <div><h3 className="text-[10px] font-black uppercase flex items-center gap-2 italic text-green-700 tracking-widest"><FileCheck size={18}/> Registro Oficial de Atas</h3><p className="text-[8px] text-slate-400 font-black uppercase mt-1 tracking-widest italic">Documentação final assinada</p></div>
                    <button onClick={()=>ataRef.current?.click()} className="bg-green-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all"><Upload size={14} className="inline mr-2"/>Subir Ata Final</button><input type="file" ref={ataRef} className="hidden" onChange={(e)=>handleUpload(e, 'atas')} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentMeeting.atas.map(ata => (
                      <div key={ata.id} className="p-5 bg-green-50/50 border border-green-100 rounded-[32px] flex items-center gap-4 group transition-all hover:border-green-300">
                        <FileCheck size={28} className="text-green-600"/><div className="flex-1 min-w-0 font-bold italic"><p className="text-sm text-slate-700 truncate">{ata.name}</p><p className="text-[8px] text-slate-400 font-black uppercase tracking-widest italic">{ata.uploadedBy} • {ata.date}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, atas: currentMeeting.atas.filter(a => a.id !== ata.id)})} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                      </div>
                    ))}
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
