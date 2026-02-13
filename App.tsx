import React, { useState, useRef } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, Plus, ChevronRight, Mail, UserPlus, 
  Clock, MapPin, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, Link as LinkIcon, 
  Map, GripVertical, ClipboardList, User, Upload, File, MessageSquare, Save, Lock, Target, FileCheck
} from 'lucide-react';

const App = () => {
  // Navegação Principal
  const [activeMenu, setActiveMenu] = useState('reunioes');
  const [view, setView] = useState('list'); // 'list' ou 'details'
  const [tab, setTab] = useState('info');
  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);

  // --- ESTADO CENTRAL ---
  const [meeting, setMeeting] = useState({
    title: 'Conselho de Administração - INEPAD', status: 'AGENDADA', date: '2026-02-13', time: '14:00', type: 'Híbrida',
    location: 'Sede / Virtual', address: 'Av. Paulista, 1000', link: 'https://zoom.us/j/inepad',
    participants: [{ name: 'Ricardo Oliveira', email: 'ricardo@inepad.com.br' }],
    pautas: [{ title: 'Abertura', responsible: 'Ricardo Oliveira', duration: '15' }],
    materiais: [{ id: 1, name: 'DRE_Projetado.pdf', uploadedBy: 'Ricardo', date: '13/02/26' }],
    deliberacoes: [] as any[],
    acoes: [] as any[],
    atas: [] as any[]
  });

  // --- ESTADOS DE FORMULÁRIO ---
  const [newPart, setNewPart] = useState({ name: '', email: '' });
  const [newPauta, setNewPauta] = useState({ title: '', responsible: '', duration: '' });
  const [newDelib, setNewDelib] = useState({ title: '', desc: '', mats: [] as string[], voters: [] as string[] });
  const [newAcao, setNewAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });

  // --- FUNÇÕES ---
  const addParticipant = () => {
    if (newPart.name && newPart.email) {
      setMeeting({ ...meeting, participants: [...meeting.participants, newPart] });
      setNewPart({ name: '', email: '' });
    }
  };

  const addPauta = () => {
    if (newPauta.title && newPauta.responsible) {
      setMeeting({ ...meeting, pautas: [...meeting.pautas, newPauta] });
      setNewPauta({ title: '', responsible: '', duration: '' });
    }
  };

  const handleUpload = (e: any, target: 'materiais' | 'atas') => {
    const f = e.target.files?.[0];
    if (f) {
      const entry = { id: Date.now(), name: f.name, uploadedBy: 'Ricardo Oliveira', date: new Date().toLocaleDateString() };
      setMeeting({ ...meeting, [target]: [...meeting[target], entry] });
    }
  };

  const createDelib = () => {
    if (!newDelib.title || newDelib.voters.length === 0) return;
    const item = {
      id: Date.now(), title: newDelib.title, mats: newDelib.mats,
      votes: newDelib.voters.map(n => ({ name: n, status: 'Pendente', just: '', saved: false }))
    };
    setMeeting({ ...meeting, deliberacoes: [...meeting.deliberacoes, item] });
    setNewDelib({ title: '', desc: '', mats: [], voters: [] });
  };

  const handleVote = (id: number, name: string, status: string, just?: string) => {
    const updated = meeting.deliberacoes.map(d => {
      if (d.id === id) {
        return { ...d, votes: d.votes.map((v: any) => v.name === name ? { ...v, status, just: just ?? v.just } : v) };
      }
      return d;
    });
    setMeeting({ ...meeting, deliberacoes: updated });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 leading-tight">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800">
          <CheckCircle2 className="text-blue-500" size={24}/><span className="font-bold text-white text-xl">GovCorp</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => {setActiveMenu('dashboard'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calendar size={18}/> Reuniões</button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest italic tracking-widest">Portal de Governança INEPAD</span>
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase italic text-slate-400">
            <div className="text-right"><p className="text-slate-800">Ricardo Oliveira</p><p>Secretário Geral</p></div>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">RO</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          {/* VISUALIZAÇÃO EM LISTA */}
          {activeMenu === 'reunioes' && view === 'list' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center"><h1 className="text-2xl font-black italic">Histórico de Reuniões</h1><button onClick={() => setView('details')} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">+ Nova Reunião</button></div>
              <div onClick={() => setView('details')} className="bg-white p-6 rounded-2xl border cursor-pointer hover:shadow-md transition-all flex justify-between items-center group">
                <div className="flex items-center gap-4"><div className="p-3 bg-slate-50 group-hover:bg-blue-600 group-hover:text-white rounded-xl transition-all"><Calendar size={20}/></div><div><h3 className="font-bold">{meeting.title}</h3><p className="text-xs font-bold text-blue-600 uppercase italic">{meeting.status} • {meeting.date}</p></div></div><ChevronRight className="text-slate-300"/>
              </div>
            </div>
          )}

          {/* VISUALIZAÇÃO EM DETALHES */}
          {activeMenu === 'reunioes' && view === 'details' && (
            <div className="animate-in fade-in pb-20">
              <button onClick={() => setView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-xs font-bold mb-4"><ChevronRight className="rotate-180" size={16}/> Voltar para a lista</button>
              <div className="flex items-center gap-3 mb-6"><h1 className="text-2xl font-black">{meeting.title}</h1><span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded uppercase tracking-widest">{meeting.status}</span></div>

              <div className="border-b border-slate-200 flex gap-6 mb-8 overflow-x-auto scrollbar-hide font-bold text-xs uppercase italic">
                {['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'Atas'].map((t, i) => {
                  const id = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i];
                  return <button key={id} onClick={() => setTab(id)} className={`pb-3 transition-all relative ${tab === id ? 'text-blue-600' : 'text-slate-400'}`}>{t}{tab === id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"/>}</button>
                })}
              </div>

              {/* ABA 1: INFO (Logística Híbrida) */}
              {tab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                  <div className="bg-white p-6 rounded-3xl border shadow-sm">
                    <h3 className="text-xs font-bold uppercase mb-4 flex items-center gap-2 italic"><UserPlus size={16}/> Participantes</h3>
                    <div className="space-y-2 mb-4">
                      {meeting.participants.map((p, i) => (<div key={i} className="flex justify-between p-3 bg-slate-50 rounded-xl text-xs font-bold italic border"><div>{p.name}<p className="text-[9px] text-slate-400 font-medium">{p.email}</p></div><button onClick={() => setMeeting({...meeting, participants: meeting.participants.filter((_, idx) => idx !== i)})}><X size={14} className="text-slate-300 hover:text-red-500"/></button></div>))}
                    </div>
                    <div className="space-y-2 p-3 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                      <input placeholder="Nome" className="w-full p-2 text-xs border rounded outline-none" value={newPart.name} onChange={e => setNewPart({...newPart, name: e.target.value})} />
                      <input placeholder="Email" className="w-full p-2 text-xs border rounded outline-none" value={newPart.email} onChange={e => setNewPart({...newPart, email: e.target.value})} />
                      <button onClick={addParticipant} className="w-full py-2 bg-blue-600 text-white rounded text-xs font-bold uppercase tracking-widest">Adicionar</button>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
                    <h3 className="text-xs font-bold uppercase mb-4 flex items-center gap-2 italic"><Clock size={16}/> Logística Híbrida</h3>
                    <div className="flex gap-2">
                      {['Online', 'Presencial', 'Híbrida'].map(t => (<button key={t} onClick={() => setMeeting({...meeting, type: t})} className={`flex-1 py-1.5 border rounded text-[10px] font-bold ${meeting.type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-400'}`}>{t}</button>))}
                    </div>
                    <div className="grid grid-cols-2 gap-2"><input type="date" value={meeting.date} className="p-2 border rounded text-xs font-bold outline-none" /><input type="time" value={meeting.time} className="p-2 border rounded text-xs font-bold outline-none" /></div>
                    {meeting.type !== 'Presencial' && <input placeholder="Link da Reunião" value={meeting.link} className="w-full p-2 border border-blue-100 bg-blue-50 rounded text-xs font-bold text-blue-800 outline-none" />}
                    {meeting.type !== 'Online' && <input placeholder="Endereço / Sala" value={meeting.address} className="w-full p-2 border rounded text-xs font-bold outline-none" />}
                  </div>
                </div>
              )}

              {/* ABA 2: PAUTA */}
              {tab === 'pauta' && (
                <div className="bg-white p-8 rounded-3xl border shadow-sm animate-in fade-in">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-xs font-bold uppercase tracking-widest italic">Cronograma</h3><span className="text-xs text-blue-600 font-bold uppercase italic tracking-widest">Tempo Total: {meeting.pautas.reduce((acc, p) => acc + Number(p.duration || 0), 0)} min</span></div>
                  <div className="space-y-2 mb-6">{meeting.pautas.map((p, i) => (<div key={i} className="flex gap-4 p-4 border rounded-2xl bg-slate-50/50 text-xs items-center shadow-sm"><GripVertical className="text-slate-200"/><div className="flex-1 font-bold italic">{p.title}</div><div className="text-slate-400 font-bold">{p.responsible}</div><div className="font-black text-blue-600">{p.duration} min</div><button onClick={() => setMeeting({...meeting, pautas: meeting.pautas.filter((_, idx) => idx !== i)})}><Trash2 size={14}/></button></div>))}</div>
                  <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed grid grid-cols-4 gap-2">
                    <input placeholder="Assunto" className="col-span-2 p-2 border rounded text-xs outline-none" value={newPauta.title} onChange={e => setNewPauta({...newPauta, title: e.target.value})} />
                    <select className="p-2 border rounded text-xs outline-none font-bold" value={newPauta.responsible} onChange={e => setNewPauta({...newPauta, responsible: e.target.value})}><option value="">Dono</option>{meeting.participants.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}</select>
                    <input type="number" placeholder="Min" className="p-2 border rounded text-xs outline-none" value={newPauta.duration} onChange={e => setNewPauta({...newPauta, duration: e.target.value})} />
                    <button onClick={addPauta} className="col-span-4 bg-blue-600 text-white rounded-xl py-2 font-bold text-[10px] uppercase tracking-widest">Adicionar Pauta</button>
                  </div>
                </div>
              )}

              {/* ABA 3: MATERIAIS */}
              {tab === 'materiais' && (
                <div className="bg-white p-8 rounded-3xl border shadow-sm animate-in fade-in">
                  <div className="flex justify-between mb-8 border-b pb-4"><h3 className="font-bold text-xs uppercase tracking-widest italic">Arquivos e Anexos</h3><button onClick={() => fileRef.current?.click()} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase shadow-lg"><Upload size={14} className="inline mr-2"/>Subir Arquivo</button><input type="file" ref={fileRef} className="hidden" onChange={(e) => handleUpload(e, 'materiais')} /></div>
                  <div className="grid grid-cols-2 gap-4">{meeting.materiais.map(m => (<div key={m.id} className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4 border group shadow-sm transition-all hover:border-blue-200"><FileText size={24} className="text-blue-500"/><div className="flex-1 text-xs font-bold truncate italic">{m.name}<p className="text-[9px] text-slate-400 font-bold uppercase">{m.uploadedBy} • {m.date}</p></div><button onClick={() => setMeeting({...meeting, materiais: meeting.materiais.filter(x => x.id !== m.id)})} className="opacity-0 group-hover:opacity-100 text-red-300 transition-all"><Trash2 size={16}/></button></div>))}</div>
                </div>
              )}

              {/* ABA 4: DELIBERAÇÕES */}
              {tab === 'delib' && (
                <div className="space-y-6 animate-in fade-in max-w-5xl">
                  <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
                    <h3 className="text-xs font-bold uppercase italic tracking-widest">Nova Deliberação Oficial</h3>
                    <input placeholder="Título da Decisão" className="w-full p-3 border rounded-xl text-sm font-bold outline-none italic" value={newDelib.title} onChange={e => setNewDelib({...newDelib, title: e.target.value})} />
                    <div className="space-y-2 text-[10px] font-bold text-slate-400 uppercase">
                      Vincular Materiais: {meeting.materiais.map(m => (<button key={m.id} onClick={() => setNewDelib({...newDelib, mats: newDelib.mats.includes(m.name)?newDelib.mats.filter(x=>x!==m.name):[...newDelib.mats, m.name]})} className={`px-2 py-1 rounded border mr-2 transition-all ${newDelib.mats.includes(m.name)?'bg-slate-800 text-white shadow-sm':'bg-white'}`}>{m.name}</button>))}
                    </div>
                    <div className="space-y-2 text-[10px] font-bold text-slate-400 uppercase">
                      Habilitar Votantes: {meeting.participants.map((p, i) => (<button key={i} onClick={() => setNewDelib({...newDelib, voters: newDelib.voters.includes(p.name)?newDelib.voters.filter(v=>v!==p.name):[...newDelib.voters, p.name]})} className={`px-2 py-1 rounded border mr-2 transition-all ${newDelib.voters.includes(p.name)?'bg-blue-600 text-white shadow-sm':'bg-white'}`}>{p.name}</button>))}
                    </div>
                    <button onClick={createDelib} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase shadow-lg shadow-blue-600/20">Iniciar Votação</button>
                  </div>
                  {meeting.deliberacoes.map(d => (
                    <div key={d.id} className="bg-white rounded-3xl border overflow-hidden shadow-sm">
                      <div className="p-5 bg-slate-50 border-b flex justify-between items-center"><span className="font-black italic text-slate-700">{d.title}</span><div className="flex gap-1">{d.mats.map((m:any, i:any)=><span key={i} className="text-[9px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded border border-blue-200"># {m}</span>)}</div></div>
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {d.votes.map((v:any, idx:number) => (
                          <div key={idx} className={`p-5 rounded-2xl border-2 ${v.saved ? 'bg-slate-50 opacity-75' : 'bg-white shadow-sm'}`}>
                            <div className="flex justify-between mb-3 font-bold text-xs italic"><span>{v.name}</span>{v.saved && <Lock size={12}/>}</div>
                            <div className="grid grid-cols-2 gap-1 mb-3">
                              {['Aprovado', 'Reprovado', 'Apr. Ressalva', 'Repr. Ressalva'].map(st => (
                                <button key={st} disabled={v.saved} onClick={() => handleVote(d.id, v.name, st)} className={`py-1.5 rounded text-[8px] font-black uppercase transition-all ${v.status === st ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{st}</button>
                              ))}
                            </div>
                            {(v.status.includes('Ressalva')) && <textarea disabled={v.saved} className="w-full p-2 bg-amber-50 border border-amber-100 rounded text-[10px] mb-2 font-medium outline-none" placeholder="Justificativa..." value={v.just} onChange={e => handleVote(d.id, v.name, v.status, e.target.value)} />}
                            {!v.saved && v.status !== 'Pendente' && <button onClick={() => { const up = meeting.deliberacoes.map(x => x.id === d.id ? {...x, votes: x.votes.map((v2:any) => v2.name === v.name ? {...v2, saved: true} : v2)} : x); setMeeting({...meeting, deliberacoes: up});}} className="w-full py-2 bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg">Confirmar Voto</button>}
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
                  <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
                    <h3 className="text-xs font-bold uppercase flex items-center gap-2 italic tracking-widest"><Target size={18} className="text-blue-600" /> Definir Ação Corretiva</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <input placeholder="Tarefa" className="p-3 text-xs border rounded-xl outline-none" value={newAcao.title} onChange={e => setNewAcao({...newAcao, title: e.target.value})} />
                      <select className="p-3 text-xs border rounded-xl outline-none font-bold" value={newAcao.resp} onChange={e => setNewAcao({...newAcao, resp: e.target.value})}><option value="">Dono</option>{meeting.participants.map((p,i) => <option key={i} value={p.name}>{p.name}</option>)}</select>
                      <input type="date" className="p-3 text-xs border rounded-xl outline-none" value={newAcao.date} onChange={e => setNewAcao({...newAcao, date: e.target.value})} />
                    </div>
                    <button onClick={() => {if(newAcao.title){setMeeting({...meeting, acoes: [...meeting.acoes, {...newAcao, id: Date.now()}]}); setNewAcao({title:'', resp:'', date:'', status:'Pendente'});}}} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-600/20">Registrar no Plano</button>
                  </div>
                  <div className="bg-white rounded-3xl border shadow-sm overflow-hidden text-xs">
                    <table className="w-full text-left"><thead className="bg-slate-50 font-black uppercase text-slate-400 border-b"><tr><th className="p-6">Tarefa</th><th className="p-6">Dono</th><th className="p-6">Prazo</th><th className="p-6">Status</th></tr></thead>
                      <tbody>{meeting.acoes.map(a => (<tr key={a.id} className="border-t hover:bg-slate-50/50"><td className="p-6 font-bold text-slate-700 italic">{a.title}</td><td className="p-6 font-medium text-slate-500">{a.resp}</td><td className="p-6 font-bold text-slate-400 italic">{a.date}</td><td className="p-6"><select value={a.status} onChange={e => setMeeting({...meeting, acoes: meeting.acoes.map(x => x.id === a.id ? {...x, status: e.target.value} : x)})} className="p-2 border rounded-lg font-black uppercase text-[9px] bg-white shadow-sm">{['Pendente', 'Andamento', 'Concluído'].map(s => <option key={s} value={s}>{s}</option>)}</select></td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ABA 6: ATAS */}
              {tab === 'atas' && (
                <div className="bg-white p-8 rounded-3xl border shadow-sm animate-in fade-in">
                  <div className="flex justify-between items-center mb-8 border-b pb-4">
                    <div><h3 className="text-xs font-bold uppercase flex items-center gap-2 italic text-green-700"><FileCheck size={18}/> Repositório de Atas</h3><p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest italic">Documentos Finais Assinados</p></div>
                    <button onClick={() => ataRef.current?.click()} className="bg-green-600 text-white px-5 py-2 rounded-xl text-[10px] font-bold uppercase shadow-lg shadow-green-600/20"><Upload size={14} className="inline mr-2"/>Subir Ata</button><input type="file" ref={ataRef} className="hidden" onChange={(e) => handleUpload(e, 'atas')} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {meeting.atas.map(ata => (
                      <div key={ata.id} className="p-4 bg-green-50/50 border border-green-100 rounded-2xl flex items-center gap-4 group transition-all hover:border-green-300">
                        <FileCheck size={24} className="text-green-600"/><div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-700 italic truncate">{ata.name}</p><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest italic">{ata.uploadedBy} • {ata.date}</p></div><button onClick={() => setMeeting({...meeting, atas: meeting.atas.filter(a => a.id !== ata.id)})} className="text-slate-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
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
