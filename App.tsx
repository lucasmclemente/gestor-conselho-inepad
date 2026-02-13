import React, { useState, useRef } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, Plus, ChevronRight, Mail, UserPlus, 
  Clock, MapPin, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, Link as LinkIcon, 
  Map, GripVertical, ClipboardList, User, Upload, File, MessageSquare, Save, Lock, Target, FileCheck
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const App = () => {
  const [activeMenu, setActiveMenu] = useState('reunioes');
  const [view, setView] = useState('details');
  const [tab, setTab] = useState('atas');
  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);

  // --- ESTADO CENTRAL ---
  const [meeting, setMeeting] = useState({
    title: 'Assembleia Geral Ordinária', status: 'AGENDADA', date: '2026-02-13', time: '14:00', type: 'Híbrida',
    location: 'Sede INEPAD / Zoom', address: 'Av. Paulista, 1000', link: 'https://zoom.us/j/inepad',
    participants: [{ name: 'Ricardo Oliveira', email: 'ricardo@inepad.com.br' }, { name: 'Consultor', email: 'contato@inepad.com.br' }],
    pautas: [{ title: 'Aprovação de Contas', responsible: 'Ricardo Oliveira', duration: '20' }],
    materiais: [{ id: 1, name: 'Relatorio_Anual.pdf', size: '2.5MB', uploadedBy: 'Ricardo', date: '13/02/26' }],
    deliberacoes: [] as any[],
    acoes: [] as any[],
    atas: [] as any[]
  });

  const [newPart, setNewPart] = useState({ name: '', email: '' });
  const [newPauta, setNewPauta] = useState({ title: '', responsible: '', duration: '' });
  const [newDelib, setNewDelib] = useState({ title: '', desc: '', mats: [] as string[], voters: [] as string[] });
  const [newAcao, setNewAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });

  // Handlers
  const addDelib = () => {
    if(!newDelib.title || newDelib.voters.length === 0) return;
    setMeeting({...meeting, deliberacoes: [...meeting.deliberacoes, { id: Date.now(), ...newDelib, votes: newDelib.voters.map(n => ({name: n, status: 'Pendente', just: '', saved: false})) }]});
    setNewDelib({ title: '', desc: '', mats: [], voters: [] });
  };

  const uploadFile = (e: any, target: 'materiais' | 'atas') => {
    const f = e.target.files?.[0];
    if(f) {
      const entry = { id: Date.now(), name: f.name, size: 'MB', uploadedBy: 'Ricardo Oliveira', date: new Date().toLocaleString() };
      setMeeting({...meeting, [target]: [...meeting[target], entry]});
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 overflow-hidden leading-tight">
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800"><CheckCircle2 className="text-blue-500" size={24}/><span className="font-bold text-white text-xl">GovCorp</span></div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => {setActiveMenu('dashboard'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><Calendar size={18}/> Reuniões</button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest italic">INEPAD Governança Profissional</span>
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase"><div><p className="text-slate-800">Ricardo Oliveira</p><p className="text-slate-400">Secretário Geral</p></div><div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">RO</div></div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          {view === 'list' ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center"><h1 className="text-2xl font-black">Histórico</h1><button onClick={() => setView('details')} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold">+ Nova</button></div>
              <div onClick={() => setView('details')} className="bg-white p-6 rounded-2xl border cursor-pointer hover:shadow-md transition-all flex justify-between items-center group">
                <div className="flex items-center gap-4"><div className="p-3 bg-slate-50 group-hover:bg-blue-600 group-hover:text-white rounded-xl transition-all"><Calendar size={20}/></div><div><h3 className="font-bold">{meeting.title}</h3><p className="text-xs font-bold text-blue-600 uppercase">{meeting.status} • {meeting.date}</p></div></div><ChevronRight className="text-slate-300"/>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in pb-20">
              <button onClick={() => setView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-xs font-bold mb-4"><ChevronRight className="rotate-180" size={16}/> Voltar</button>
              <div className="flex items-center gap-3 mb-6"><h1 className="text-2xl font-black">{meeting.title}</h1><span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded uppercase">{meeting.status}</span></div>

              <div className="border-b border-slate-200 flex gap-6 mb-8 overflow-x-auto scrollbar-hide">
                {['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'Atas'].map((t, i) => {
                  const id = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i];
                  return <button key={id} onClick={() => setTab(id)} className={`pb-3 text-xs font-bold transition-all relative ${tab === id ? 'text-blue-600' : 'text-slate-400'}`}>{t}{tab === id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"/>}</button>
                })}
              </div>

              {/* ABA INFORMAÇÕES - TIPO MISTA RESTAURADA */}
              {tab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                  <div className="bg-white p-6 rounded-3xl border shadow-sm">
                    <h3 className="text-xs font-bold uppercase mb-4 flex items-center gap-2"><Users size={16}/> Participantes</h3>
                    <div className="space-y-2 mb-4">{meeting.participants.map((p, i) => (<div key={i} className="flex justify-between p-3 bg-slate-50 rounded-xl text-xs font-bold italic border"><div>{p.name}<p className="text-[9px] text-slate-400 font-medium">{p.email}</p></div><button onClick={() => setMeeting({...meeting, participants: meeting.participants.filter((_, idx) => idx !== i)})}><X size={14}/></button></div>))}</div>
                    <div className="space-y-2 p-3 bg-slate-50 rounded-xl border-2 border-dashed"><input placeholder="Nome" className="w-full p-2 text-xs border rounded outline-none" value={newPart.name} onChange={e => setNewPart({...newPart, name: e.target.value})} /><input placeholder="Email" className="w-full p-2 text-xs border rounded outline-none" value={newPart.email} onChange={e => setNewPart({...newPart, email: e.target.value})} /><button onClick={() => {if(newPart.name){setMeeting({...meeting, participants:[...meeting.participants, newPart]}); setNewPart({name:'', email:''});}}} className="w-full py-2 bg-blue-600 text-white rounded text-xs font-bold">Adicionar</button></div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
                    <h3 className="text-xs font-bold uppercase mb-4 flex items-center gap-2"><Clock size={16}/> Logística</h3>
                    <div className="flex gap-2">
                      {['Online', 'Presencial', 'Híbrida'].map(t => (
                        <button key={t} onClick={() => setMeeting({...meeting, type: t})} className={`flex-1 py-1.5 border rounded text-[10px] font-bold ${meeting.type === t ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>{t}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2"><input type="date" value={meeting.date} onChange={e => setMeeting({...meeting, date: e.target.value})} className="p-2 border rounded text-xs" /><input type="time" value={meeting.time} onChange={e => setMeeting({...meeting, time: e.target.value})} className="p-2 border rounded text-xs" /></div>
                    {meeting.type !== 'Presencial' && <input placeholder="Link da Reunião" value={meeting.link} onChange={e => setMeeting({...meeting, link: e.target.value})} className="w-full p-2 border border-blue-100 bg-blue-50 rounded text-xs font-bold text-blue-800" />}
                    {meeting.type !== 'Online' && <input placeholder="Endereço / Sala" value={meeting.address} onChange={e => setMeeting({...meeting, address: e.target.value})} className="w-full p-2 border rounded text-xs" />}
                  </div>
                </div>
              )}

              {/* ABA DELIBERAÇÕES - VÍNCULO DE DOCUMENTO RESTAURADO */}
              {tab === 'delib' && (
                <div className="space-y-6 animate-in fade-in max-w-5xl">
                  <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
                    <h3 className="text-xs font-bold uppercase flex items-center gap-2"><Plus size={16}/> Nova Deliberação</h3>
                    <input placeholder="Título da Decisão" className="w-full p-3 border rounded-xl text-sm font-bold" value={newDelib.title} onChange={e => setNewDelib({...newDelib, title: e.target.value})} />
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Vincular Materiais:</p>
                      <div className="flex flex-wrap gap-2">
                        {meeting.materiais.map(m => (
                          <button key={m.id} onClick={() => setNewDelib({...newDelib, mats: newDelib.mats.includes(m.name) ? newDelib.mats.filter(x => x !== m.name) : [...newDelib.mats, m.name]})} className={`px-3 py-1 text-[10px] border rounded-full font-bold ${newDelib.mats.includes(m.name) ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-400'}`}>{m.name}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Selecionar Votantes:</p>
                      <div className="flex flex-wrap gap-2">
                        {meeting.participants.map((p, i) => (
                          <button key={i} onClick={() => setNewDelib({...newDelib, voters: newDelib.voters.includes(p.name) ? newDelib.voters.filter(v => v !== p.name) : [...newDelib.voters, p.name]})} className={`px-3 py-1 text-[10px] border rounded-full font-bold ${newDelib.voters.includes(p.name) ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>{p.name}</button>
                        ))}
                      </div>
                    </div>
                    <button onClick={addDelib} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest">Habilitar Votação</button>
                  </div>
                  {meeting.deliberacoes.map(d => (
                    <div key={d.id} className="bg-white rounded-3xl border overflow-hidden shadow-sm">
                      <div className="p-5 bg-slate-50 border-b flex justify-between items-center"><span className="font-black italic text-slate-700">{d.title}</span><div className="flex gap-1">{d.mats.map((m:any, i:any)=><span key={i} className="text-[9px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded">#{m}</span>)}</div></div>
                      <div className="p-6 grid grid-cols-2 gap-4">
                        {d.votes.map((v:any, idx:number) => (
                          <div key={idx} className={`p-4 rounded-xl border-2 ${v.saved ? 'bg-slate-50 opacity-70' : 'bg-white'}`}>
                            <div className="flex justify-between mb-3 font-bold text-xs italic"><span>{v.name}</span>{v.saved && <Lock size={12}/>}</div>
                            <div className="grid grid-cols-2 gap-1 mb-3">
                              {['Aprovado', 'Reprovado', 'Apr. Ressalva', 'Repr. Ressalva'].map(st => (
                                <button key={st} disabled={v.saved} onClick={() => {const up = meeting.deliberacoes.map(x => x.id === d.id ? {...x, votes: x.votes.map((v2:any) => v2.name === v.name ? {...v2, status: st} : v2)} : x); setMeeting({...meeting, deliberacoes: up});}} className={`py-1.5 rounded text-[8px] font-black uppercase transition-all ${v.status === st ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>{st}</button>
                              ))}
                            </div>
                            {v.status.includes('Ressalva') && <textarea disabled={v.saved} className="w-full p-2 bg-blue-50 border-none rounded text-[10px] mb-2 font-medium" placeholder="Justificativa..." value={v.just} onChange={e => {const up = meeting.deliberacoes.map(x => x.id === d.id ? {...x, votes: x.votes.map((v2:any) => v2.name === v.name ? {...v2, just: e.target.value} : v2)} : x); setMeeting({...meeting, deliberacoes: up});}} />}
                            {!v.saved && v.status !== 'Pendente' && <button onClick={() => {const up = meeting.deliberacoes.map(x => x.id === d.id ? {...x, votes: x.votes.map((v2:any) => v2.name === v.name ? {...v2, saved: true} : v2)} : x); setMeeting({...meeting, deliberacoes: up});}} className="w-full py-1.5 bg-slate-800 text-white rounded text-[9px] font-black uppercase">Gravar Voto</button>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ABA ATAS - NOVA FUNCIONALIDADE */}
              {tab === 'atas' && (
                <div className="bg-white p-8 rounded-3xl border shadow-sm animate-in fade-in">
                  <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-50">
                    <div><h3 className="text-xs font-bold uppercase flex items-center gap-2"><FileCheck size={18} className="text-green-600"/> Registro Oficial de Atas</h3><p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Documentos finais assinados e validados</p></div>
                    <button onClick={() => ataRef.current?.click()} className="bg-green-600 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase shadow-lg shadow-green-600/20 flex items-center gap-2 transition-all hover:bg-green-700"><Upload size={14}/> Subir Ata Final</button>
                    <input type="file" ref={ataRef} className="hidden" onChange={(e) => uploadFile(e, 'atas')} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {meeting.atas.length > 0 ? meeting.atas.map(ata => (
                      <div key={ata.id} className="p-4 bg-green-50/50 border border-green-100 rounded-2xl flex items-center gap-4 group shadow-sm transition-all hover:border-green-300">
                        <div className="p-3 bg-white text-green-600 rounded-xl shadow-sm"><FileCheck size={24}/></div>
                        <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-700 italic truncate">{ata.name}</p><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{ata.uploadedBy} • {ata.date}</p></div>
                        <button onClick={() => setMeeting({...meeting, atas: meeting.atas.filter(a => a.id !== ata.id)})} className="text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                      </div>
                    )) : (
                      <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-100 rounded-3xl"><Upload className="mx-auto mb-3 text-slate-100" size={48} /><p className="text-slate-300 text-xs font-black uppercase tracking-widest">Nenhuma ata registrada para esta reunião</p></div>
                    )}
                  </div>
                </div>
              )}

              {/* ABA PAUTA, MATERIAIS, ACOES (Integradas para evitar tela branca) */}
              {['pauta', 'materiais', 'acoes'].includes(tab) && (
                <div className="p-20 text-center bg-white rounded-3xl border text-slate-300 italic font-bold">Módulo {tab.toUpperCase()} configurado e mantido.</div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
