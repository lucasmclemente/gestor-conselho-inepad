import React, { useState, useRef } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, Plus, ChevronRight, Mail, UserPlus, 
  Clock, MapPin, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, Link as LinkIcon, 
  Map, GripVertical, ClipboardList, User, Upload, File, MessageSquare, Save, Lock, Target
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const App = () => {
  const [activeMenu, setActiveMenu] = useState('reunioes');
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('info');
  const fileRef = useRef<HTMLInputElement>(null);

  const [meeting, setMeeting] = useState({
    title: 'Nova Reunião Estratégica', status: 'AGENDADA', date: '2026-02-13', time: '10:00', type: 'Online',
    location: 'Google Meet', address: '', link: 'https://meet.google.com/inepad',
    participants: [{ name: 'Ricardo Oliveira', email: 'ricardo@inepad.com.br' }],
    pautas: [{ title: 'Abertura', responsible: 'Ricardo Oliveira', duration: '10' }],
    materiais: [{ id: 1, name: 'DRE_2025.pdf', size: '1.2MB', uploadedBy: 'Ricardo', date: '13/02/26' }],
    deliberacoes: [] as any[],
    acoes: [] as any[]
  });

  const [newPart, setNewPart] = useState({ name: '', email: '' });
  const [newPauta, setNewPauta] = useState({ title: '', responsible: '', duration: '' });
  const [newDelib, setNewDelib] = useState({ title: '', description: '', materials: [] as string[], voters: [] as string[] });
  const [newAcao, setNewAcao] = useState({ title: '', responsible: '', deadline: '', status: 'Pendente' });

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 overflow-hidden">
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800">
          <CheckCircle2 className="text-blue-500" size={24} /><span className="font-bold text-white text-xl">GovCorp</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => {setActiveMenu('dashboard'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18} /> Dashboard</button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><Calendar size={18} /> Reuniões</button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">INEPAD Governança</span>
          <div className="flex items-center gap-4"><div className="text-right text-[10px] font-bold uppercase"><p className="text-slate-800">Ricardo Oliveira</p><p className="text-slate-400">Secretário</p></div><div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-xs">RO</div></div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          {activeMenu === 'dashboard' && <h1 className="text-2xl font-black text-slate-800">Painel de Controle Ativo</h1>}

          {activeMenu === 'reunioes' && view === 'list' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center"><h1 className="text-2xl font-black text-slate-800">Reuniões</h1><button onClick={() => setView('details')} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 transition-all">+ Nova Reunião</button></div>
              <div onClick={() => setView('details')} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:shadow-md transition-all flex items-center justify-between"><div className="flex items-center gap-4"><div className="p-3 bg-slate-50 text-slate-400 rounded-xl"><Calendar size={20}/></div><div><h3 className="font-bold text-slate-800">{meeting.title}</h3><p className="text-xs text-blue-600 font-bold uppercase">{meeting.status} • {meeting.date}</p></div></div><ChevronRight className="text-slate-300" /></div>
            </div>
          )}

          {activeMenu === 'reunioes' && view === 'details' && (
            <div className="animate-in fade-in pb-20">
              <button onClick={() => setView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-xs font-bold mb-4"><ChevronRight className="rotate-180" size={16}/> Voltar</button>
              <div className="flex items-center gap-3 mb-6"><h1 className="text-2xl font-black text-slate-800 tracking-tighter">{meeting.title}</h1><span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded uppercase">{meeting.status}</span></div>

              <div className="border-b border-slate-200 flex gap-6 mb-8 overflow-x-auto scrollbar-hide">
                {['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação'].map((t, i) => {
                  const id = ['info', 'pauta', 'materiais', 'delib', 'acoes'][i];
                  return <button key={id} onClick={() => setTab(id)} className={`pb-3 text-xs font-bold transition-all relative ${tab === id ? 'text-blue-600' : 'text-slate-400'}`}>{t}{tab === id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"/>}</button>
                })}
              </div>

              {tab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="text-slate-800 font-bold text-xs uppercase mb-4">Participantes</h3>
                    <div className="space-y-2 mb-4">{meeting.participants.map((p, i) => (<div key={i} className="flex justify-between p-3 bg-slate-50 rounded-xl text-xs"><div className="font-bold">{p.name}<p className="text-[9px] text-slate-400">{p.email}</p></div><button onClick={() => setMeeting({...meeting, participants: meeting.participants.filter((_, idx) => idx !== i)})}><X size={14}/></button></div>))}</div>
                    <div className="space-y-2"><input placeholder="Nome" className="w-full p-2 text-xs border border-slate-100 rounded-lg outline-none" value={newPart.name} onChange={e => setNewPart({...newPart, name: e.target.value})} /><input placeholder="Email" className="w-full p-2 text-xs border border-slate-100 rounded-lg outline-none" value={newPart.email} onChange={e => setNewPart({...newPart, email: e.target.value})} /><button onClick={() => { if(newPart.name) {setMeeting({...meeting, participants: [...meeting.participants, newPart]}); setNewPart({name:'', email:''});} }} className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Adicionar</button></div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="text-slate-800 font-bold text-xs uppercase mb-4">Logística</h3>
                    <div className="space-y-4 text-xs font-bold">
                      <div className="flex gap-2">Tipo: {['Online', 'Presencial'].map(t => <button key={t} onClick={() => setMeeting({...meeting, type: t})} className={`px-2 py-1 border rounded ${meeting.type === t ? 'bg-blue-600 text-white' : ''}`}>{t}</button>)}</div>
                      <input type="date" value={meeting.date} onChange={e => setMeeting({...meeting, date: e.target.value})} className="w-full p-2 border border-slate-100 rounded-lg" />
                      <input type="time" value={meeting.time} onChange={e => setMeeting({...meeting, time: e.target.value})} className="w-full p-2 border border-slate-100 rounded-lg" />
                      <input placeholder="Local / Link" value={meeting.type === 'Online' ? meeting.link : meeting.address} onChange={e => setMeeting({...meeting, [meeting.type === 'Online' ? 'link' : 'address']: e.target.value})} className="w-full p-2 border border-slate-100 rounded-lg" />
                    </div>
                  </div>
                </div>
              )}

              {tab === 'pauta' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100">
                  <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-xs uppercase">Ordem do Dia</h3><span className="text-xs text-blue-600 font-bold">{meeting.pautas.reduce((acc, p) => acc + Number(p.duration || 0), 0)} min totais</span></div>
                  {meeting.pautas.map((p, i) => (<div key={i} className="flex gap-4 p-3 border-b text-xs"><GripVertical className="text-slate-200"/><div className="flex-1 font-bold">{p.title}</div><div className="text-slate-400">{p.responsible}</div><div>{p.duration} min</div></div>))}
                  <div className="mt-6 grid grid-cols-4 gap-2"><input placeholder="Assunto" className="col-span-2 p-2 border rounded text-xs" value={newPauta.title} onChange={e => setNewPauta({...newPauta, title: e.target.value})} /><input placeholder="Duração" className="p-2 border rounded text-xs" value={newPauta.duration} onChange={e => setNewPauta({...newPauta, duration: e.target.value})} /><button onClick={() => {setMeeting({...meeting, pautas: [...meeting.pautas, {...newPauta, responsible: 'Ricardo'}]}); setNewPauta({title:'', duration:'', responsible:''});}} className="bg-blue-600 text-white rounded text-xs font-bold">Add</button></div>
                </div>
              )}

              {tab === 'materiais' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100">
                  <div className="flex justify-between mb-6"><h3 className="font-bold text-xs">Materiais</h3><button onClick={() => fileRef.current?.click()} className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold"><Upload size={14} className="inline mr-2"/>Subir Arquivo</button><input type="file" ref={fileRef} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) setMeeting({...meeting, materiais: [...meeting.materiais, {id: Date.now(), name: f.name, size: 'MB', uploadedBy: 'Ricardo', date: 'Hoje'}]}); }} /></div>
                  <div className="grid grid-cols-2 gap-4">{meeting.materiais.map(m => (<div key={m.id} className="p-3 bg-slate-50 rounded-xl flex items-center gap-3 border"><FileText size={18} className="text-blue-500"/><div className="flex-1 text-xs font-bold truncate">{m.name}<p className="text-[9px] text-slate-400 uppercase">{m.uploadedBy} • {m.date}</p></div><button onClick={() => setMeeting({...meeting, materiais: meeting.materiais.filter(x => x.id !== m.id)})}><Trash2 size={14}/></button></div>))}</div>
                </div>
              )}

              {tab === 'delib' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4">
                    <input placeholder="Título da Deliberação" className="w-full p-3 border rounded-xl text-xs font-bold" value={newDelib.title} onChange={e => setNewDelib({...newDelib, title: e.target.value})} />
                    <div className="flex gap-2">{meeting.participants.map((p, i) => <button key={i} onClick={() => setNewDelib({...newDelib, voters: newDelib.voters.includes(p.name) ? newDelib.voters.filter(v => v !== p.name) : [...newDelib.voters, p.name]})} className={`px-2 py-1 text-[10px] border rounded ${newDelib.voters.includes(p.name) ? 'bg-blue-600 text-white' : ''}`}>{p.name}</button>)}</div>
                    <button onClick={() => { if(newDelib.title) {setMeeting({...meeting, deliberacoes: [...meeting.deliberacoes, {id: Date.now(), title: newDelib.title, votes: newDelib.voters.map(n => ({name: n, status: 'Pendente', just: '', saved: false}))}]}); setNewDelib({title:'', description:'', materials:[], voters:[]}); } }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase">Habilitar Votação</button>
                  </div>
                  {meeting.deliberacoes.map(d => (
                    <div key={d.id} className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                      <div className="p-5 bg-slate-50 border-b font-black text-slate-700 italic">{d.title}</div>
                      <div className="p-6 grid grid-cols-2 gap-4">
                        {d.votes.map((v:any, idx:number) => (
                          <div key={idx} className={`p-4 rounded-xl border-2 ${v.saved ? 'bg-slate-50 opacity-70' : 'bg-white shadow-sm'}`}>
                            <div className="flex justify-between items-center mb-3 font-bold text-xs"><span>{v.name}</span>{v.saved && <Lock size={12}/>}</div>
                            <div className="grid grid-cols-2 gap-1 mb-3">
                              {['Aprovado', 'Reprovado', 'Apr. Ressalva', 'Repr. Ressalva'].map(st => (
                                <button key={st} disabled={v.saved} onClick={() => { const up = meeting.deliberacoes.map(x => x.id === d.id ? {...x, votes: x.votes.map((v2:any) => v2.name === v.name ? {...v2, status: st} : v2)} : x); setMeeting({...meeting, deliberacoes: up}); }} className={`py-1.5 rounded text-[8px] font-black uppercase transition-all ${v.status === st ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>{st}</button>
                              ))}
                            </div>
                            {v.status.includes('Ressalva') && <textarea disabled={v.saved} className="w-full p-2 bg-blue-50 border-none rounded text-[10px] mb-2" placeholder="Justificativa..." value={v.just} onChange={e => { const up = meeting.deliberacoes.map(x => x.id === d.id ? {...x, votes: x.votes.map((v2:any) => v2.name === v.name ? {...v2, just: e.target.value} : v2)} : x); setMeeting({...meeting, deliberacoes: up}); }} />}
                            {!v.saved && v.status !== 'Pendente' && <button onClick={() => { const up = meeting.deliberacoes.map(x => x.id === d.id ? {...x, votes: x.votes.map((v2:any) => v2.name === v.name ? {...v2, saved: true} : v2)} : x); setMeeting({...meeting, deliberacoes: up}); }} className="w-full py-1.5 bg-slate-800 text-white rounded text-[9px] font-black uppercase">Gravar Voto</button>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'acoes' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4">
                    <h3 className="text-slate-800 font-bold text-xs uppercase flex items-center gap-2"><Target size={18} className="text-blue-600" /> Plano de Ação</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <input placeholder="O que fazer?" className="p-2 text-xs border rounded-lg" value={newAcao.title} onChange={e => setNewAcao({...newAcao, title: e.target.value})} />
                      <select className="p-2 text-xs border rounded-lg" value={newAcao.responsible} onChange={e => setNewAcao({...newAcao, responsible: e.target.value})}><option value="">Dono</option>{meeting.participants.map((p,i) => <option key={i} value={p.name}>{p.name}</option>)}</select>
                      <input type="date" className="p-2 text-xs border rounded-lg" value={newAcao.deadline} onChange={e => setNewAcao({...newAcao, deadline: e.target.value})} />
                    </div>
                    <button onClick={() => {setMeeting({...meeting, acoes: [...meeting.acoes, {...newAcao, id: Date.now()}]}); setNewAcao({title:'', responsible:'', deadline:'', status:'Pendente'}); }} className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase">Registrar Ação</button>
                  </div>
                  <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 font-bold uppercase text-slate-400"><tr><th className="p-4">Ação</th><th className="p-4">Dono</th><th className="p-4">Prazo</th><th className="p-4">Status</th></tr></thead>
                      <tbody>{meeting.acoes.map(a => (<tr key={a.id} className="border-t">
                        <td className="p-4 font-bold">{a.title}</td><td className="p-4 italic">{a.responsible}</td><td className="p-4">{a.deadline}</td>
                        <td className="p-4"><select value={a.status} onChange={e => setMeeting({...meeting, acoes: meeting.acoes.map(x => x.id === a.id ? {...x, status: e.target.value} : x)})} className="p-1 border rounded font-bold uppercase text-[9px]">{['Pendente', 'Andamento', 'Concluído'].map(s => <option key={s} value={s}>{s}</option>)}</select></td>
                      </tr>))}</tbody>
                    </table>
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
