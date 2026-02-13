import React, { useState, useRef } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, 
  Plus, ChevronRight, Mail, UserPlus, Clock, MapPin, 
  CheckCircle2, AlertCircle, FileText, Send, Award, X, Trash2,
  Link as LinkIcon, Map, GripVertical, ClipboardList, User, Upload, File,
  Check, ShieldAlert, Info, Users, BarChart3
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const App = () => {
  // Navegação Principal
  const [activeMenu, setActiveMenu] = useState('reunioes');
  const [meetingView, setMeetingView] = useState('list');
  const [activeMeetingTab, setActiveMeetingTab] = useState('info');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ESTADO CENTRAL DA REUNIÃO ---
  const [meeting, setMeeting] = useState({
    title: 'Nova Reunião Estratégica',
    status: 'AGENDADA',
    date: '2026-02-13',
    time: '10:00',
    type: 'Online',
    location: 'Plataforma Digital',
    address: '',
    link: 'https://meet.google.com/inepad-reuniao',
    participants: [
      { name: 'Ricardo Oliveira', email: 'ricardo.oliveira@inepad.com.br' },
      { name: 'Consultor Inepad', email: 'consultoria@inepad.com.br' }
    ],
    pautas: [
      { title: 'Apresentação dos Resultados Q4', responsible: 'Ricardo Oliveira', duration: '30' }
    ],
    materiais: [
      { id: 1, name: 'DRE_Consolidado_2025.pdf', size: '1.2 MB', uploadedBy: 'Ricardo Oliveira', date: '13/02/2026 09:15' }
    ],
    deliberacoes: [] as any[]
  });

  // --- ESTADOS DE ENTRADA (FORMULÁRIOS) ---
  const [newParticipant, setNewParticipant] = useState({ name: '', email: '' });
  const [newPauta, setNewPauta] = useState({ title: '', responsible: '', duration: '' });
  const [newDelib, setNewDelib] = useState({ title: '', description: '', selectedMaterials: [] as string[] });

  // --- FUNÇÕES DE GESTÃO ---
  const handleAddParticipant = () => {
    if (newParticipant.name && newParticipant.email) {
      setMeeting({ ...meeting, participants: [...meeting.participants, newParticipant] });
      setNewParticipant({ name: '', email: '' });
    }
  };

  const handleAddPauta = () => {
    if (newPauta.title && newPauta.responsible) {
      setMeeting({ ...meeting, pautas: [...meeting.pautas, newPauta] });
      setNewPauta({ title: '', responsible: '', duration: '' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newFile = {
        id: Date.now(),
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        uploadedBy: 'Ricardo Oliveira',
        date: new Date().toLocaleString('pt-BR')
      };
      setMeeting({ ...meeting, materiais: [...meeting.materiais, newFile] });
    }
  };

  const handleAddDeliberation = () => {
    if (newDelib.title) {
      const delib = {
        id: Date.now(),
        title: newDelib.title,
        description: newDelib.description,
        linkedMaterials: newDelib.selectedMaterials,
        votes: meeting.participants.map(p => ({ name: p.name, status: 'Pendente' }))
      };
      setMeeting({ ...meeting, deliberacoes: [...meeting.deliberacoes, delib] });
      setNewDelib({ title: '', description: '', selectedMaterials: [] });
    }
  };

  const handleVote = (delibId: number, participantName: string, newStatus: string) => {
    const updated = meeting.deliberacoes.map(d => {
      if (d.id === delibId) {
        return { ...d, votes: d.votes.map((v: any) => v.name === participantName ? { ...v, status: newStatus } : v) };
      }
      return d;
    });
    setMeeting({ ...meeting, deliberacoes: updated });
  };

  // --- DADOS DASHBOARD ---
  const barData = [{ name: 'Jan/26', pauta: 4, acoes: 3 }, { name: 'Fev/26', pauta: 2, acoes: 1 }];
  const pieData = [{ name: 'Concluídas', value: 3, color: '#10b981' }, { name: 'Pendentes', value: 2, color: '#6366f1' }];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 leading-tight">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 mb-4">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg"><CheckCircle2 className="text-white" size={24} /></div>
          <span className="font-bold text-white text-xl uppercase tracking-widest">GovCorp</span>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <button onClick={() => {setActiveMenu('dashboard'); setMeetingView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button onClick={() => {setActiveMenu('reunioes'); setMeetingView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
            <Calendar size={20} /> Reuniões
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* HEADER */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest italic">INEPAD Governança</span>
          <div className="flex items-center gap-6">
            <div className="text-right leading-tight">
              <p className="font-bold text-slate-800 text-sm">Ricardo Oliveira</p>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Secretário Geral</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-600 text-xs">RO</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
          
          {/* TELA: DASHBOARD */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Painel de Controle</h1>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Decisões', value: '28', icon: <FileText size={20}/>, color: 'blue' },
                  { label: 'Ações Pendentes', value: '5', icon: <Clock size={20}/>, color: 'amber' },
                  { label: 'Atas Registradas', value: '11', icon: <FileText size={20}/>, color: 'green' },
                  { label: 'Participantes', value: '8', icon: <Users size={20}/>, color: 'indigo' },
                ].map((card, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-blue-600 mb-4">{card.icon}</div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</p>
                    <p className="text-2xl font-black text-slate-800">{card.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TELA: LISTA DE REUNIÕES */}
          {activeMenu === 'reunioes' && meetingView === 'list' && (
            <div className="space-y-8 animate-in slide-in-from-right duration-500">
              <div className="flex justify-between items-end">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Histórico de Reuniões</h1>
                <button onClick={() => setMeetingView('details')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg hover:bg-blue-700">
                  <Plus size={18} /> Nova Reunião
                </button>
              </div>
              <div onClick={() => setMeetingView('details')} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md cursor-pointer flex items-center justify-between group">
                <div className="flex items-center gap-6">
                  <div className="p-4 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Calendar size={24} /></div>
                  <div>
                    <h3 className="font-bold text-slate-800">{meeting.title}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-blue-600">{meeting.status} • 13/02/2026</p>
                  </div>
                </div>
                <ChevronRight className="text-slate-300" />
              </div>
            </div>
          )}

          {/* TELA: DETALHES DA REUNIÃO (INTEGRADA) */}
          {activeMenu === 'reunioes' && meetingView === 'details' && (
            <div className="animate-in slide-in-from-bottom duration-500 pb-20">
              <button onClick={() => setMeetingView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-sm font-bold mb-6">
                <ChevronRight className="rotate-180" size={18} /> Voltar para a lista
              </button>
              
              <div className="flex items-center gap-3 mb-8">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">{meeting.title}</h1>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded uppercase tracking-wider">{meeting.status}</span>
              </div>

              {/* ABAS */}
              <div className="border-b border-slate-200 flex gap-8 mb-10 overflow-x-auto scrollbar-hide">
                {['Informações e Convites', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'Atas'].map((tab, i) => {
                  const ids = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'];
                  return (
                    <button key={ids[i]} onClick={() => setActiveMeetingTab(ids[i])} className={`pb-4 text-sm font-bold transition-all relative whitespace-nowrap ${activeMeetingTab === ids[i] ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                      {tab}
                      {activeMeetingTab === ids[i] && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"></div>}
                    </button>
                  );
                })}
              </div>

              <div className="max-w-6xl">
                {/* ABA INFO */}
                {activeMeetingTab === 'info' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in">
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm h-full">
                      <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest mb-6 flex items-center gap-2"><UserPlus size={16} /> Participantes</h3>
                      <div className="space-y-3 mb-8">
                        {meeting.participants.map((p, i) => (
                          <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex flex-col"><span className="font-bold text-slate-700 text-sm">{p.name}</span><span className="text-[10px] text-slate-400">{p.email}</span></div>
                            <button onClick={() => setMeeting({...meeting, participants: meeting.participants.filter((_, idx) => idx !== i)})} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <input type="text" placeholder="Nome" className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none" value={newParticipant.name} onChange={(e) => setNewParticipant({...newParticipant, name: e.target.value})} />
                        <input type="email" placeholder="Email" className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none" value={newParticipant.email} onChange={(e) => setNewParticipant({...newParticipant, email: e.target.value})} />
                        <button onClick={handleAddParticipant} className="w-full py-3 bg-blue-600 text-white font-bold text-[10px] uppercase rounded-xl">Adicionar</button>
                      </div>
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm h-full">
                      <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest mb-8 flex items-center gap-2"><Clock size={16} /> Logística</h3>
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <input type="date" value={meeting.date} onChange={e => setMeeting({...meeting, date: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                          <input type="time" value={meeting.time} onChange={e => setMeeting({...meeting, time: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                        </div>
                        <div className="flex gap-2">
                           {['Online', 'Presencial', 'Híbrida'].map(t => (
                             <button key={t} onClick={() => setMeeting({...meeting, type: t})} className={`flex-1 py-2 rounded-lg text-[10px] font-bold border ${meeting.type === t ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}>{t}</button>
                           ))}
                        </div>
                        {meeting.type !== 'Presencial' && <input type="text" placeholder="Link da Reunião" value={meeting.link} onChange={e => setMeeting({...meeting, link: e.target.value})} className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900" />}
                      </div>
                    </div>
                  </div>
                )}

                {/* ABA PAUTA */}
                {activeMeetingTab === 'pauta' && (
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest">Ordem do Dia</h3>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Tempo Total: <span className="text-blue-600">{meeting.pautas.reduce((acc, p) => acc + Number(p.duration || 0), 0)} min</span></span>
                    </div>
                    <div className="space-y-3 mb-8">
                      {meeting.pautas.map((p, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                          <GripVertical size={18} className="text-slate-200" />
                          <div className="flex-1 grid grid-cols-3 gap-4">
                            <div><p className="text-[9px] font-bold text-slate-400 uppercase">Assunto</p><p className="text-sm font-bold text-slate-700">{p.title}</p></div>
                            <div><p className="text-[9px] font-bold text-slate-400 uppercase">Responsável</p><p className="text-xs text-slate-600">{p.responsible}</p></div>
                            <div><p className="text-[9px] font-bold text-slate-400 uppercase">Duração</p><p className="text-xs text-slate-600">{p.duration} min</p></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 grid grid-cols-4 gap-4">
                      <input type="text" placeholder="Assunto" className="col-span-2 p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none" value={newPauta.title} onChange={e => setNewPauta({...newPauta, title: e.target.value})} />
                      <input type="text" placeholder="Responsável" className="p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none" value={newPauta.responsible} onChange={e => setNewPauta({...newPauta, responsible: e.target.value})} />
                      <input type="number" placeholder="Min" className="p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none" value={newPauta.duration} onChange={e => setNewPauta({...newPauta, duration: e.target.value})} />
                      <button onClick={handleAddPauta} className="col-span-4 py-3 bg-blue-600 text-white font-bold text-[10px] uppercase rounded-xl">Adicionar à Pauta</button>
                    </div>
                  </div>
                )}

                {/* ABA MATERIAIS */}
                {activeMeetingTab === 'materiais' && (
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in">
                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-50">
                      <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest flex items-center gap-2"><File size={18} /> Repositório</h3>
                      <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-[10px] uppercase shadow-lg shadow-blue-600/20"><Upload size={14} className="inline mr-2" /> Subir Material</button>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {meeting.materiais.map(file => (
                        <div key={file.id} className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4 group">
                          <FileText size={24} className="text-blue-600" />
                          <div className="flex-1"><p className="text-sm font-bold text-slate-700">{file.name}</p><p className="text-[9px] text-slate-400 font-bold uppercase">{file.uploadedBy} • {file.date}</p></div>
                          <button onClick={() => setMeeting({...meeting, materiais: meeting.materiais.filter(m => m.id !== file.id)})} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ABA DELIBERAÇÕES */}
                {activeMeetingTab === 'delib' && (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                      <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest">Nova Deliberação</h3>
                      <input type="text" placeholder="Título" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={newDelib.title} onChange={e => setNewDelib({...newDelib, title: e.target.value})} />
                      <div className="flex flex-wrap gap-2">
                        {meeting.materiais.map(m => (
                          <button key={m.id} onClick={() => setNewDelib({...newDelib, selectedMaterials: newDelib.selectedMaterials.includes(m.name) ? newDelib.selectedMaterials.filter(x => x !== m.name) : [...newDelib.selectedMaterials, m.name]})} className={`px-4 py-2 rounded-xl text-[10px] font-bold border ${newDelib.selectedMaterials.includes(m.name) ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}>{m.name}</button>
                        ))}
                      </div>
                      <button onClick={handleAddDeliberation} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-[10px] uppercase shadow-lg shadow-blue-600/20">Criar Item de Votação</button>
                    </div>
                    {meeting.deliberacoes.map(d => (
                      <div key={d.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-slate-50"><h4 className="text-lg font-black text-slate-800">{d.title}</h4></div>
                        <div className="bg-slate-50/50 p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {d.votes.map((v: any, idx: number) => (
                            <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col gap-4">
                              <span className="font-bold text-slate-700 text-sm italic">{v.name}</span>
                              <div className="flex gap-2">
                                {['Aprovado', 'Reprovado', 'Com Ressalvas'].map(st => (
                                  <button key={st} onClick={() => handleVote(d.id, v.name, st)} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest ${v.status === st ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>{st.split(' ')[0]}</button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* PLACEHOLDERS PARA ABAS RESTANTES */}
                {!['info', 'pauta', 'materiais', 'delib'].includes(activeMeetingTab) && (
                  <div className="bg-white p-20 rounded-3xl border border-slate-100 shadow-sm text-center italic">
                    <AlertCircle className="mx-auto mb-4 text-slate-100" size={64} />
                    <p className="text-slate-300 font-bold uppercase tracking-widest text-sm">Módulo {activeMeetingTab.toUpperCase()} em desenvolvimento...</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
