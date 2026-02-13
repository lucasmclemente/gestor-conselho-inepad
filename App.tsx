import React, { useState, useRef } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, Plus, ChevronRight, Mail, UserPlus, 
  Clock, MapPin, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, Link as LinkIcon, 
  Map, GripVertical, ClipboardList, User, Upload, File, MessageSquare, Save, Lock, Target, FileCheck
} from 'lucide-react';

const App = () => {
  const [activeMenu, setActiveMenu] = useState('reunioes');
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('info');
  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);

  // --- HISTÓRICO PERMANENTE ---
  const [meetings, setMeetings] = useState([
    { 
      id: 1, title: 'Conselho de Administração - INEPAD Q4', status: 'CONCLUÍDA', date: '2025-12-10', time: '10:00', type: 'Presencial',
      location: 'Sede INEPAD', address: 'Av. Paulista, 1000', link: '', participants: [], pautas: [], materiais: [], deliberacoes: [], acoes: [], atas: []
    }
  ]);

  // --- RASCUNHO / EDITOR ATIVO ---
  const blankMeeting = {
    id: 0, title: '', status: 'AGENDADA', date: '', time: '', type: 'Híbrida',
    location: '', address: '', link: '',
    participants: [] as any[], pautas: [] as any[], materiais: [] as any[],
    deliberacoes: [] as any[], acoes: [] as any[], atas: [] as any[]
  };

  const [currentMeeting, setCurrentMeeting] = useState(blankMeeting);

  // --- ESTADOS DE FORMULÁRIO ---
  const [newPart, setNewPart] = useState({ name: '', email: '' });
  const [newPauta, setNewPauta] = useState({ title: '', responsible: '', duration: '' });
  const [newDelib, setNewDelib] = useState({ title: '', mats: [] as string[], voters: [] as string[] });
  const [newAcao, setNewAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });

  // --- FUNÇÕES DE NAVEGAÇÃO E PERSISTÊNCIA ---
  const handleSaveMeeting = () => {
    if (!currentMeeting.title) return alert("Dê um título à reunião!");
    
    if (currentMeeting.id === 0) {
      // Nova reunião
      const savedEntry = { ...currentMeeting, id: Date.now() };
      setMeetings([savedEntry, ...meetings]);
    } else {
      // Atualizar reunião existente
      setMeetings(meetings.map(m => m.id === currentMeeting.id ? currentMeeting : m));
    }
    setView('list');
  };

  const openMeeting = (m: any) => {
    setCurrentMeeting(m);
    setView('details');
    setTab('info');
  };

  const startNew = () => {
    setCurrentMeeting(blankMeeting);
    setView('details');
    setTab('info');
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
          <button onClick={() => {setActiveMenu('dashboard'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calendar size={18}/> Reuniões</button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest italic">INEPAD Governança</span>
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase italic text-slate-400">
            <div className="text-right"><p className="text-slate-800">Ricardo Oliveira</p><p>Secretário Geral</p></div>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">RO</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          {/* TELA DE LISTAGEM */}
          {activeMenu === 'reunioes' && view === 'list' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center"><h1 className="text-2xl font-black italic text-slate-800">Histórico de Reuniões</h1><button onClick={startNew} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">+ Nova Reunião</button></div>
              <div className="space-y-3">
                {meetings.map(m => (
                  <div key={m.id} onClick={() => openMeeting(m)} className="bg-white p-5 rounded-2xl border flex justify-between items-center group hover:border-blue-400 cursor-pointer transition-all shadow-sm">
                    <div className="flex items-center gap-4"><div className="p-3 bg-slate-50 text-slate-400 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all"><Calendar size={20}/></div><div><h3 className="font-bold text-slate-800 italic">{m.title || "Rascunho Sem Título"}</h3><p className="text-[10px] font-bold text-blue-600 uppercase italic">{m.status} • {m.date || "Sem Data"}</p></div></div>
                    <ChevronRight className="text-slate-300" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TELA DE DETALHES / EDITOR */}
          {activeMenu === 'reunioes' && view === 'details' && (
            <div className="animate-in fade-in pb-20">
              <div className="flex justify-between items-center mb-6">
                <button onClick={() => setView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-xs font-bold transition-all"><ChevronRight className="rotate-180" size={16}/> Voltar</button>
                <button onClick={handleSaveMeeting} className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-black shadow-xl transition-all"><Save size={16}/> Salvar no Sistema</button>
              </div>
              
              <div className="mb-8 border-b-2 border-slate-100 pb-2"><input placeholder="Título da Reunião..." className="text-3xl font-black text-slate-800 tracking-tighter bg-transparent outline-none w-full" value={currentMeeting.title} onChange={e => setCurrentMeeting({...currentMeeting, title: e.target.value})} /></div>

              {/* TABS */}
              <div className="border-b border-slate-200 flex gap-6 mb-8 overflow-x-auto scrollbar-hide font-bold text-[10px] uppercase italic">
                {['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'Atas'].map((t, i) => {
                  const id = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i];
                  return <button key={id} onClick={() => setTab(id)} className={`pb-3 transition-all relative whitespace-nowrap ${tab === id ? 'text-blue-600' : 'text-slate-400'}`}>{t}{tab === id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"/>}</button>
                })}
              </div>

              {/* ABA 1: INFO & CONVITES (Restaurada) */}
              {tab === 'info' && (
                <div className="space-y-6 animate-in fade-in max-w-6xl">
                  <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl flex justify-between items-center">
                    <div className="space-y-2"><h3 className="font-black uppercase tracking-widest text-sm flex items-center gap-2 italic"><Send size={18}/> Convocação e Invites</h3><p className="text-blue-100 text-xs font-medium italic">Dispare o convite oficial por e-mail para todos os participantes com data, link e pauta.</p></div>
                    <button className="bg-white text-blue-600 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-blue-50 transition-all">Enviar Convites</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl border shadow-sm">
                      <h3 className="text-xs font-bold uppercase mb-4 flex items-center gap-2 italic"><UserPlus size={16}/> Participantes</h3>
                      <div className="space-y-2 mb-4">
                        {currentMeeting.participants.map((p, i) => (<div key={i} className="flex justify-between p-3 bg-slate-50 rounded-xl text-xs font-bold italic border"><div>{p.name}<p className="text-[9px] text-slate-400 font-medium">{p.email}</p></div><button onClick={() => setCurrentMeeting({...currentMeeting, participants: currentMeeting.participants.filter((_, idx) => idx !== i)})}><X size={14} className="text-slate-300 hover:text-red-500"/></button></div>))}
                      </div>
                      <div className="space-y-2 p-3 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <input placeholder="Nome" className="w-full p-2 text-xs border rounded outline-none" value={newPart.name} onChange={e => setNewPart({...newPart, name: e.target.value})} /><input placeholder="Email" className="w-full p-2 text-xs border rounded outline-none" value={newPart.email} onChange={e => setNewPart({...newPart, email: e.target.value})} /><button onClick={() => {if(newPart.name){setCurrentMeeting({...currentMeeting, participants:[...currentMeeting.participants, newPart]}); setNewPart({name:'', email:''});}}} className="w-full py-2 bg-blue-600 text-white rounded text-xs font-bold uppercase">Adicionar</button>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border shadow-sm h-full space-y-4">
                      <h3 className="text-xs font-bold uppercase mb-4 flex items-center gap-2 italic"><Clock size={16}/> Logística Híbrida</h3>
                      <div className="flex gap-2">
                        {['Online', 'Presencial', 'Híbrida'].map(t => (<button key={t} onClick={() => setCurrentMeeting({...currentMeeting, type: t})} className={`flex-1 py-1.5 border rounded text-[10px] font-bold ${currentMeeting.type === t ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 text-slate-400'}`}>{t}</button>))}
                      </div>
                      <div className="grid grid-cols-2 gap-2"><input type="date" value={currentMeeting.date} onChange={e => setCurrentMeeting({...currentMeeting, date: e.target.value})} className="p-2 border rounded text-xs font-bold outline-none" /><input type="time" value={currentMeeting.time} onChange={e => setCurrentMeeting({...currentMeeting, time: e.target.value})} className="p-2 border rounded text-xs font-bold outline-none" /></div>
                      <input placeholder="Link ou Local" className="w-full p-2 border rounded text-xs font-bold outline-none bg-slate-50" value={currentMeeting.type === 'Online' ? currentMeeting.link : currentMeeting.address} onChange={e => setCurrentMeeting({...currentMeeting, [currentMeeting.type === 'Online' ? 'link' : 'address']: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: PAUTA */}
              {tab === 'pauta' && (
                <div className="bg-white p-8 rounded-3xl border shadow-sm animate-in fade-in">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-xs font-bold uppercase italic tracking-widest">Ordem do Dia</h3><span className="text-xs text-blue-600 font-bold italic uppercase">Tempo: {currentMeeting.pautas.reduce((acc, p) => acc + Number(p.duration || 0), 0)} min</span></div>
                  <div className="space-y-2 mb-6">{currentMeeting.pautas.map((p, i) => (<div key={i} className="flex gap-4 p-4 border rounded-2xl bg-slate-50/50 text-xs items-center shadow-sm font-bold italic"><GripVertical className="text-slate-200"/><div className="flex-1">{p.title}</div><div className="text-slate-400">{p.responsible}</div><div className="text-blue-600">{p.duration} min</div></div>))}</div>
                  <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed grid grid-cols-4 gap-2">
                    <input placeholder="Assunto" className="col-span-2 p-2 border rounded text-xs outline-none" value={newPauta.title} onChange={e => setNewPauta({...newPauta, title: e.target.value})} /><select className="p-2 border rounded text-xs font-bold outline-none" value={newPauta.responsible} onChange={e => setNewPauta({...newPauta, responsible: e.target.value})}><option value="">Dono</option>{currentMeeting.participants.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}</select><input type="number" placeholder="Min" className="p-2 border rounded text-xs outline-none" value={newPauta.duration} onChange={e => setNewPauta({...newPauta, duration: e.target.value})} />
                    <button onClick={() => {if(newPauta.title){setCurrentMeeting({...currentMeeting, pautas:[...currentMeeting.pautas, newPauta]}); setNewPauta({title:'', responsible:'', duration:''});}}} className="col-span-4 bg-blue-600 text-white rounded-xl py-2 font-black text-[10px] uppercase tracking-widest">Adicionar</button>
                  </div>
                </div>
              )}

              {/* ABA 3: MATERIAIS */}
              {tab === 'materiais' && (
                <div className="bg-white p-8 rounded-3xl border shadow-sm animate-in fade-in">
                  <div className="flex justify-between mb-8 border-b pb-4"><h3 className="font-bold text-xs uppercase italic tracking-widest">Materiais de Apoio</h3><button onClick={() => fileRef.current?.click()} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase shadow-lg"><Upload size={14} className="inline mr-2"/>Subir</button><input type="file" ref={fileRef} className="hidden" onChange={(e) => handleUpload(e, 'materiais')} /></div>
                  <div className="grid grid-cols-2 gap-4">{currentMeeting.materiais.map(m => (<div key={m.id} className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4 border group transition-all hover:border-blue-200"><FileText size={24} className="text-blue-600"/><div className="flex-1 text-xs font-bold truncate italic">{m.name}<p className="text-[9px] text-slate-400 font-bold uppercase">{m.uploadedBy} • {m.date}</p></div><button onClick={() => setCurrentMeeting({...currentMeeting, materiais: currentMeeting.materiais.filter(x => x.id !== m.id)})} className="opacity-0 group-hover:opacity-100 text-red-300 transition-all"><Trash2 size={16}/></button></div>))}</div>
                </div>
              )}

              {/* ABA 4: DELIBERAÇÕES (Vínculo restaurado) */}
              {tab === 'delib' && (
                <div className="space-y-6 animate-in fade-in max-w-5xl">
                  <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
                    <h3 className="text-xs font-bold uppercase italic tracking-widest text-slate-400">Nova Votação</h3>
                    <input placeholder="Título da Decisão..." className="w-full p-3 border rounded-xl text-sm font-bold outline-none italic" value={newDelib.title} onChange={e => setNewDelib({...newDelib, title: e.target.value})} />
                    <div className="space-y-2 text-[10px] font-bold text-slate-400 uppercase italic">Vincular Documentos: {currentMeeting.materiais.map(m => (<button key={m.id} onClick={() => setNewDelib({...newDelib, mats: newDelib.mats.includes(m.name)?newDelib.mats.filter(x=>x!==m.name):[...newDelib.mats, m.name]})} className={`px-2 py-1 rounded border mr-2 transition-all ${newDelib.mats.includes(m.name)?'bg-slate-800 text-white shadow-sm':'bg-white'}`}>{m.name}</button>))}</div>
                    <div className="space-y-2 text-[10px] font-bold text-slate-400 uppercase italic">Votantes: {currentMeeting.participants.map((p, i) => (<button key={i} onClick={() => setNewDelib({...newDelib, voters: newDelib.voters.includes(p.name)?newDelib.voters.filter(v=>v!==p.name):[...newDelib.voters, p.name]})} className={`px-2 py-1 rounded border mr-2 transition-all ${newDelib.voters.includes(p.name)?'bg-blue-600 text-white shadow-sm':'bg-white'}`}>{p.name}</button>))}</div>
                    <button onClick={() => {if(newDelib.title && newDelib.voters.length > 0){setCurrentMeeting({...currentMeeting, deliberacoes:[...currentMeeting.deliberacoes, {id: Date.now(), title: newDelib.title, mats: newDelib.mats, votes: newDelib.voters.map(n=>({name:n, status:'Pendente', just:'', saved:false}))}]}); setNewDelib({title:'', mats:[], voters:[]});}}} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase">Abrir Votação</button>
                  </div>
                  {currentMeeting.deliberacoes.map(d => (
                    <div key={d.id} className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-in slide-in-from-top-4">
                      <div className="p-4 bg-slate-50 border-b flex justify-between items-center font-black italic text-slate-700">{d.title}<div className="flex gap-1">{d.mats.map((m:any, i:any)=><span key={i} className="text-[9px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded border border-blue-200"># {m}</span>)}</div></div>
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {d.votes.map((v:any, idx:number) => (
                          <div key={idx} className={`p-4 rounded-xl border-2 transition-all ${v.saved ? 'bg-slate-50 opacity-75' : 'bg-white shadow-sm'}`}>
                            <div className="flex justify-between mb-3 font-bold text-xs italic"><span>{v.name}</span>{v.saved && <Lock size={12}/>}</div>
                            <div className="grid grid-cols-2 gap-1 mb-2">
                              {['Aprovado', 'Reprovado', 'Aprovado Ressalva', 'Reprovado Ressalva'].map(st => (
                                <button key={st} disabled={v.saved} onClick={() => {const up = currentMeeting.deliberacoes.map(x => x.id === d.id ? {...x, votes: x.votes.map((v2:any) => v2.name === v.name ? {...v2, status: st} : v2)} : x); setCurrentMeeting({...currentMeeting, deliberacoes: up});}} className={`py-1.5 rounded text-[8px] font-black uppercase transition-all ${v.status === st ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{st}</button>
                              ))}
                            </div>
                            {(v.status.includes('Ressalva')) && <textarea disabled={v.saved} className="w-full p-2 bg-amber-50 border-none rounded text-[10px] mb-2 font-medium" placeholder="Justificativa..." value={v.just} onChange={e => {const up = currentMeeting.deliberacoes.map(x => x.id === d.id ? {...x, votes: x.votes.map((v2:any) => v2.name === v.name ? {...v2, just: e.target.value} : v2)} : x); setCurrentMeeting({...currentMeeting, deliberacoes: up});}} />}
                            {!v.saved && v.status !== 'Pendente' && <button onClick={() => {const up = currentMeeting.deliberacoes.map(x => x.id === d.id ? {...x, votes: x.votes.map((v2:any) => v2.name === v.name ? {...v2, saved: true} : v2)} : x); setCurrentMeeting({...currentMeeting, deliberacoes: up});}} className="w-full py-2 bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase shadow-lg">Gravar Voto</button>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ABA 5: PLANO DE ACÇÃO */}
              {tab === 'acoes' && (
                <div className="space-y-6 animate-in fade-in max-w-6xl">
                  <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
                    <h3 className="text-xs font-bold uppercase italic flex items-center gap-2"><Target size={18} className="text-blue-600" /> Registrar Nova Ação</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <input placeholder="Tarefa..." className="p-3 text-xs border rounded-xl outline-none font-bold italic" value={newAcao.title} onChange={e => setNewAcao({...newAcao, title: e.target.value})} />
                      <select className="p-3 text-xs border rounded-xl font-bold" value={newAcao.resp} onChange={e => setNewAcao({...newAcao, resp: e.target.value})}><option value="">Responsável</option>{currentMeeting.participants.map((p,i) => <option key={i} value={p.name}>{p.name}</option>)}</select>
                      <input type="date" className="p-3 text-xs border rounded-xl outline-none" value={newAcao.date} onChange={e => setNewAcao({...newAcao, date: e.target.value})} />
                    </div>
                    <button onClick={() => {if(newAcao.title){setCurrentMeeting({...currentMeeting, acoes: [...currentMeeting.acoes, {...newAcao, id: Date.now()}]}); setNewAcao({title:'', resp:'', date:'', status:'Pendente'});}}} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg tracking-widest">Adicionar</button>
                  </div>
                  <div className="bg-white rounded-3xl border shadow-sm overflow-hidden text-xs font-bold italic">
                    <table className="w-full text-left"><thead className="bg-slate-50 font-black uppercase text-slate-400 border-b"><tr><th className="p-4">Ação</th><th className="p-4">Dono</th><th className="p-4">Prazo</th><th className="p-4">Status</th></tr></thead>
                      <tbody>{currentMeeting.acoes.map(a => (<tr key={a.id} className="border-t hover:bg-slate-50/50"><td className="p-4 text-slate-700">{a.title}</td><td className="p-4 text-slate-500">{a.resp}</td><td className="p-4 text-slate-400">{a.date}</td><td className="p-4"><select value={a.status} onChange={e => setCurrentMeeting({...currentMeeting, acoes: currentMeeting.acoes.map(x => x.id === a.id ? {...x, status: e.target.value} : x)})} className="p-1 border rounded font-black uppercase text-[9px] bg-white outline-none">{['Pendente', 'Andamento', 'Concluído'].map(s => <option key={s} value={s}>{s}</option>)}</select></td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ABA 6: ATAS */}
              {tab === 'atas' && (
                <div className="bg-white p-8 rounded-3xl border shadow-sm animate-in fade-in">
                  <div className="flex justify-between items-center mb-8 border-b pb-4">
                    <div><h3 className="text-xs font-bold uppercase flex items-center gap-2 italic text-green-700"><FileCheck size={18}/> Repositório de Atas</h3><p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest italic">Documentos Finais Assinados</p></div>
                    <button onClick={() => ataRef.current?.click()} className="bg-green-600 text-white px-5 py-2 rounded-xl text-[10px] font-bold uppercase shadow-lg"><Upload size={14} className="inline mr-2"/>Subir</button><input type="file" ref={ataRef} className="hidden" onChange={(e) => handleUpload(e, 'atas')} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {currentMeeting.atas.map(ata => (
                      <div key={ata.id} className="p-4 bg-green-50/50 border border-green-100 rounded-2xl flex items-center gap-4 group shadow-sm">
                        <FileCheck size={24} className="text-green-600"/><div className="flex-1 min-w-0 font-bold italic"><p className="text-sm text-slate-700 truncate">{ata.name}</p><p className="text-[9px] text-slate-400 font-black uppercase">{ata.uploadedBy} • {ata.date}</p></div><button onClick={() => setCurrentMeeting({...currentMeeting, atas: currentMeeting.atas.filter(a => a.id !== ata.id)})} className="text-slate-200 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
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
