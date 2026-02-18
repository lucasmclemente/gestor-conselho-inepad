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

  // --- HISTÓRICO DE REUNIÕES ---
  const [meetings, setMeetings] = useState([
    { 
      id: 1, title: 'Conselho Consultivo - Q4 2025', status: 'CONCLUÍDA', date: '2025-12-10', time: '10:00', type: 'Presencial',
      location: 'Sede INEPAD', address: 'Av. Paulista, 1000', link: '', participants: [], pautas: [], 
      materiais: [{name: 'Relatorio.pdf'}], deliberacoes: [1,2,3], acoes: [{status: 'Concluído'}], atas: [1]
    }
  ]);

  // --- RASCUNHO / EDITOR ATIVO ---
  const blankMeeting = {
    id: 0, title: '', status: 'AGENDADA', date: '', time: '', type: 'Híbrida',
    location: '', address: '', link: '', participants: [] as any[], 
    pautas: [] as any[], materiais: [] as any[], deliberacoes: [] as any[], acoes: [] as any[], atas: [] as any[]
  };
  const [currentMeeting, setCurrentMeeting] = useState(blankMeeting);

  // --- CÁLCULOS DO DASHBOARD (DINÂMICOS) ---
  const stats = useMemo(() => {
    const totalDelib = meetings.reduce((acc, m) => acc + (m.deliberacoes?.length || 0), 0);
    const totalAcoes = meetings.reduce((acc, m) => acc + (m.acoes?.length || 0), 0);
    const totalAtas = meetings.reduce((acc, m) => acc + (m.atas?.length || 0), 0);
    return { meetings: meetings.length, delib: totalDelib, acoes: totalAcoes, atas: totalAtas };
  }, [meetings]);

  const chartData = [
    { name: 'Out', delib: 4 }, { name: 'Nov', delib: 7 }, { name: 'Dez', delib: stats.delib }, { name: 'Jan', delib: 0 }
  ];

  // --- ESTADOS DE FORMULÁRIO ---
  const [newPart, setNewPart] = useState({ name: '', email: '' });
  const [newPauta, setNewPauta] = useState({ title: '', responsible: '', duration: '' });
  const [newDelib, setNewDelib] = useState({ title: '', mats: [] as string[], voters: [] as string[] });
  const [newAcao, setNewAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });

  // --- FUNÇÕES ---
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
      const entry = { id: Date.now(), name: f.name, uploadedBy: 'Ricardo Oliveira', date: new Date().toLocaleDateString() };
      setCurrentMeeting({ ...currentMeeting, [target]: [...(currentMeeting as any)[target], entry] });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 overflow-hidden leading-tight">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800">
          <CheckCircle2 className="text-blue-500" size={24}/><span className="font-bold text-white text-xl uppercase tracking-tighter">GovCorp</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveMenu('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calendar size={18}/> Reuniões</button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest italic tracking-widest">INEPAD Governança Profissional</span>
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase italic text-slate-400">
            <div className="text-right"><p className="text-slate-800 font-black tracking-tight">Ricardo Oliveira</p><p>Secretário Geral</p></div>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">RO</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          
          {/* TELA: DASHBOARD */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="flex justify-between items-center"><h1 className="text-2xl font-black italic text-slate-800">Visão Geral da Governança</h1><div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Atualizado: {new Date().toLocaleDateString()}</div></div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[{l:'Reuniões', v:stats.meetings, i:<Calendar/>, c:'blue'}, {l:'Deliberações', v:stats.delib, i:<FileText/>, c:'indigo'}, {l:'Ações Pendentes', v:stats.acoes, i:<Target/>, c:'amber'}, {l:'Atas Oficiais', v:stats.atas, i:<FileCheck/>, c:'green'}].map((s,i)=>(
                  <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                    <div className={`w-10 h-10 rounded-2xl mb-4 flex items-center justify-center ${s.c==='blue'?'bg-blue-50 text-blue-600':s.c==='indigo'?'bg-indigo-50 text-indigo-600':s.c==='amber'?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600'}`}>{s.i}</div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.l}</p>
                    <p className="text-3xl font-black text-slate-800 tracking-tighter">{s.v}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm h-80">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2 italic"><BarChart3 size={16}/> Histórico de Decisões</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} /><YAxis hide /><Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} /><Bar dataKey="delib" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={40} /></BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm h-80 flex flex-col">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2 italic"><PieIcon size={16}/> Status das Ações</h3>
                  <div className="flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{n:'Concluídas', v:3}, {n:'Pendentes', v:2}]} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="v"><Cell fill="#10b981"/><Cell fill="#f59e0b"/></Pie><Tooltip/></PieChart></ResponsiveContainer></div>
                  <div className="flex justify-center gap-4 text-[10px] font-bold uppercase"><span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"/> OK</span><span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"/> Pendente</span></div>
                </div>
              </div>
            </div>
          )}

          {/* TELA: REUNIÕES */}
          {activeMenu === 'reunioes' && view === 'list' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center"><h1 className="text-2xl font-black italic">Gestão de Reuniões</h1><button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details');}} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">+ Nova Reunião</button></div>
              <div className="grid gap-3">
                {meetings.map(m => (
                  <div key={m.id} onClick={()=>{setCurrentMeeting(m); setView('details');}} className="bg-white p-6 rounded-3xl border border-slate-100 flex justify-between items-center group cursor-pointer hover:border-blue-300 transition-all shadow-sm">
                    <div className="flex items-center gap-4"><div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all"><Calendar size={20}/></div><div><h3 className="font-bold text-slate-800 italic">{m.title || "Sem Título"}</h3><p className="text-[10px] font-bold text-blue-600 uppercase italic tracking-widest">{m.status} • {m.date || "Agendar"}</p></div></div>
                    <ChevronRight className="text-slate-300 group-hover:text-blue-600 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TELA: EDITOR (DETALHES) */}
          {activeMenu === 'reunioes' && view === 'details' && (
            <div className="animate-in fade-in pb-20">
              <div className="flex justify-between items-center mb-6">
                <button onClick={()=>setView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-xs font-bold transition-all"><ChevronRight className="rotate-180" size={16}/> Voltar</button>
                <button onClick={handleSave} className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-black shadow-xl transition-all"><Save size={16}/> Salvar Reunião</button>
              </div>
              <input placeholder="Título da Reunião..." className="text-3xl font-black text-slate-800 tracking-tighter bg-transparent outline-none w-full mb-8 border-b-2 border-transparent focus:border-blue-100 pb-2 italic" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} />

              <div className="border-b border-slate-200 flex gap-6 mb-8 overflow-x-auto scrollbar-hide font-bold text-[10px] uppercase italic">
                {['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'Atas'].map((t, i) => {
                  const id = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i];
                  return <button key={id} onClick={()=>setTab(id)} className={`pb-3 transition-all relative whitespace-nowrap ${tab === id ? 'text-blue-600' : 'text-slate-400'}`}>{t}{tab === id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"/>}</button>
                })}
              </div>

              {/* ABA INFO & CONVITES (HÍBRIDA + EMAIL) */}
              {tab === 'info' && (
                <div className="space-y-6 animate-in fade-in max-w-6xl">
                  <div className="bg-blue-600 p-8 rounded-[40px] text-white shadow-2xl flex justify-between items-center">
                    <div className="space-y-1"><h3 className="font-black uppercase tracking-widest text-sm italic flex items-center gap-2"><Send size={18}/> Convocação de Conselheiros</h3><p className="text-blue-100 text-xs italic">Notifique os participantes via e-mail corporativo INEPAD.</p></div>
                    <button className="bg-white text-blue-600 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all">Disparar Email</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl border shadow-sm">
                      <h3 className="text-xs font-bold uppercase mb-4 italic flex items-center gap-2"><UserPlus size={16}/> Participantes</h3>
                      <div className="space-y-2 mb-4">{currentMeeting.participants.map((p, i) => (<div key={i} className="flex justify-between p-3 bg-slate-50 rounded-xl text-xs font-bold italic border"><div>{p.name}<p className="text-[9px] text-slate-400">{p.email}</p></div><button onClick={()=>setCurrentMeeting({...currentMeeting, participants: currentMeeting.participants.filter((_, idx)=>idx!==i)})}><X size={14} className="text-slate-300 hover:text-red-500"/></button></div>))}</div>
                      <div className="space-y-2 p-3 bg-slate-50 rounded-xl border-2 border-dashed"><input placeholder="Nome" className="w-full p-2 text-xs border rounded outline-none" value={newPart.name} onChange={e=>setNewPart({...newPart, name: e.target.value})} /><input placeholder="Email" className="w-full p-2 text-xs border rounded outline-none" value={newPart.email} onChange={e=>setNewPart({...newPart, email: e.target.value})} /><button onClick={()=>{if(newPart.name){setCurrentMeeting({...currentMeeting, participants:[...currentMeeting.participants, newPart]}); setNewPart({name:'', email:''});}}} className="w-full py-2 bg-blue-600 text-white rounded text-xs font-bold uppercase tracking-widest">Adicionar</button></div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
                      <h3 className="text-xs font-bold uppercase mb-4 italic flex items-center gap-2"><Clock size={16}/> Logística Híbrida</h3>
                      <div className="flex gap-2">{['Online', 'Presencial', 'Híbrida'].map(t => (<button key={t} onClick={()=>setCurrentMeeting({...currentMeeting, type: t})} className={`flex-1 py-2 border rounded text-[10px] font-bold ${currentMeeting.type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-400'}`}>{t}</button>))}</div>
                      <div className="grid grid-cols-2 gap-2"><input type="date" value={currentMeeting.date} onChange={e=>setCurrentMeeting({...currentMeeting, date: e.target.value})} className="p-2 border rounded text-xs font-bold outline-none" /><input type="time" value={currentMeeting.time} onChange={e=>setCurrentMeeting({...currentMeeting, time: e.target.value})} className="p-2 border rounded text-xs font-bold outline-none" /></div>
                      <input placeholder="Link ou Endereço Físico" className="w-full p-2 border rounded text-xs font-bold outline-none bg-slate-50" value={currentMeeting.type === 'Online' ? currentMeeting.link : currentMeeting.address} onChange={e=>setCurrentMeeting({...currentMeeting, [currentMeeting.type === 'Online' ? 'link' : 'address']: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 4: DELIBERAÇÕES (Votos 4 Níveis + Vínculo) */}
              {tab === 'delib' && (
                <div className="space-y-6 animate-in fade-in max-w-5xl">
                  <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
                    <h3 className="text-xs font-bold uppercase italic text-slate-400">Nova Votação</h3>
                    <input placeholder="Item para Decisão..." className="w-full p-3 border rounded-xl text-sm font-bold outline-none italic" value={newDelib.title} onChange={e=>setNewDelib({...newDelib, title: e.target.value})} />
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-400 uppercase italic">Anexos: {currentMeeting.materiais.map(m => (<button key={m.id} onClick={()=>setNewDelib({...newDelib, mats: newDelib.mats.includes(m.name)?newDelib.mats.filter(x=>x!==m.name):[...newDelib.mats, m.name]})} className={`px-2 py-1 rounded border ${newDelib.mats.includes(m.name)?'bg-slate-800 text-white':'bg-white'}`}>{m.name}</button>))}</div>
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-400 uppercase italic">Votantes: {currentMeeting.participants.map((p, i) => (<button key={i} onClick={()=>setNewDelib({...newDelib, voters: newDelib.voters.includes(p.name)?newDelib.voters.filter(v=>v!==p.name):[...newDelib.voters, p.name]})} className={`px-2 py-1 rounded border ${newDelib.voters.includes(p.name)?'bg-blue-600 text-white':'bg-white'}`}>{p.name}</button>))}</div>
                    <button onClick={()=>{if(newDelib.title && newDelib.voters.length > 0){setCurrentMeeting({...currentMeeting, deliberacoes:[...currentMeeting.deliberacoes, {id: Date.now(), title: newDelib.title, mats: newDelib.mats, votes: newDelib.voters.map(n=>({name:n, status:'Pendente', just:'', saved:false}))}]}); setNewDelib({title:'', mats:[], voters:[]});}}} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase">Abrir Votação</button>
                  </div>
                  {currentMeeting.deliberacoes.map(d => (
                    <div key={d.id} className="bg-white rounded-3xl border shadow-sm overflow-hidden mb-4">
                      <div className="p-4 bg-slate-50 border-b flex justify-between items-center font-black italic text-slate-700">{d.title}<div className="flex gap-1">{d.mats.map((m:any, i:any)=><span key={i} className="text-[9px] font-bold bg-blue-50 text-blue-500 px-2 py-0.5 rounded border border-blue-200"># {m}</span>)}</div></div>
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {d.votes.map((v:any, idx:number) => (
                          <div key={idx} className={`p-4 rounded-xl border-2 transition-all ${v.saved ? 'bg-slate-50 opacity-75' : 'bg-white shadow-sm'}`}>
                            <div className="flex justify-between mb-3 font-bold text-xs italic"><span>{v.name}</span>{v.saved && <Lock size={12}/>}</div>
                            <div className="grid grid-cols-2 gap-1 mb-2">
                              {['Aprovado', 'Reprovado', 'Apr. Ressalva', 'Repr. Ressalva'].map(st => (
                                <button key={st} disabled={v.saved} onClick={()=>{const up=currentMeeting.deliberacoes.map(x=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, status:st}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up});}} className={`py-1.5 rounded text-[8px] font-black uppercase transition-all ${v.status === st ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>{st}</button>
                              ))}
                            </div>
                            {v.status.includes('Ressalva') && <textarea disabled={v.saved} className="w-full p-2 bg-amber-50 border-none rounded text-[10px] mb-2 font-medium" placeholder="Justificativa..." value={v.just} onChange={e=>{const up=currentMeeting.deliberacoes.map(x=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, just:e.target.value}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up});}} />}
                            {!v.saved && v.status !== 'Pendente' && <button onClick={()=>{const up=currentMeeting.deliberacoes.map(x=>x.id===d.id?{...x, votes:x.votes.map((v2:any)=>v2.name===v.name?{...v2, saved:true}:v2)}:x); setCurrentMeeting({...currentMeeting, deliberacoes:up});}} className="w-full py-2 bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase shadow-lg">Confirmar Voto</button>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ABA 5: PLANO DE AÇÃO */}
              {tab === 'acoes' && (
                <div className="space-y-6 animate-in fade-in max-w-6xl">
                  <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
                    <h3 className="text-xs font-bold uppercase italic flex items-center gap-2 tracking-widest text-blue-600"><Target size={18} /> Registrar Ação do Conselho</h3>
                    <div className="grid grid-cols-3 gap-4"><input placeholder="Tarefa..." className="p-3 text-xs border rounded-xl outline-none font-bold italic" value={newAcao.title} onChange={e=>setNewAcao({...newAcao, title: e.target.value})} /><select className="p-3 text-xs border rounded-xl font-bold italic" value={newAcao.resp} onChange={e=>setNewAcao({...newAcao, resp: e.target.value})}><option value="">Dono</option>{currentMeeting.participants.map((p,i)=><option key={i} value={p.name}>{p.name}</option>)}</select><input type="date" className="p-3 text-xs border rounded-xl outline-none font-bold italic" value={newAcao.date} onChange={e=>setNewAcao({...newAcao, date: e.target.value})} /></div>
                    <button onClick={()=>{if(newAcao.title){setCurrentMeeting({...currentMeeting, acoes: [...currentMeeting.acoes, {...newAcao, id: Date.now()}]}); setNewAcao({title:'', resp:'', date:'', status:'Pendente'});}}} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg tracking-widest transition-all">Vincular ao Plano</button>
                  </div>
                  <div className="bg-white rounded-3xl border shadow-sm overflow-hidden text-xs font-bold italic">
                    <table className="w-full text-left"><thead className="bg-slate-50 font-black uppercase text-slate-400 border-b tracking-widest"><tr><th className="p-6">Ação</th><th className="p-6">Dono</th><th className="p-6">Prazo</th><th className="p-6">Status</th></tr></thead>
                      <tbody>{currentMeeting.acoes.map(a => (<tr key={a.id} className="border-t hover:bg-slate-50/50"><td className="p-6 text-slate-700">{a.title}</td><td className="p-6 text-slate-500">{a.resp}</td><td className="p-6 text-slate-400">{a.date}</td><td className="p-6"><select value={a.status} onChange={e => setCurrentMeeting({...currentMeeting, acoes: currentMeeting.acoes.map(x => x.id === a.id ? {...x, status: e.target.value} : x)})} className={`p-2 border rounded-lg font-black uppercase text-[9px] ${a.status==='Concluído'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>{['Pendente', 'Andamento', 'Concluído'].map(s => <option key={s} value={s}>{s}</option>)}</select></td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ABAS PAUTA, MATERIAIS, ATAS (Compactadas para evitar tela branca) */}
              {['pauta', 'materiais', 'atas'].includes(tab) && (
                <div className="bg-white p-20 rounded-3xl border shadow-sm text-center italic text-slate-300 font-black uppercase">Módulo {tab.toUpperCase()} ativo. Use os botões de upload/add.</div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
