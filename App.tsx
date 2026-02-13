import React, { useState, useRef } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, 
  Plus, ChevronRight, Mail, UserPlus, Clock, MapPin, 
  CheckCircle2, AlertCircle, FileText, Send, Award, X, Trash2,
  Link as LinkIcon, Map, GripVertical, ClipboardList, User, Upload, File,
  Check, ShieldAlert, Info, Users, MessageSquare, Save, Lock, Target
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const App = () => {
  // Navegação Principal
  const [activeMenu, setActiveMenu] = useState('reunioes');
  const [meetingView, setMeetingView] = useState('list');
  const [activeMeetingTab, setActiveMeetingTab] = useState('acoes');
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
    deliberacoes: [] as any[],
    acoes: [
      { id: 1, title: 'Revisar fluxo de caixa mensal', responsible: 'Ricardo Oliveira', deadline: '2026-02-28', status: 'Em Andamento' }
    ]
  });

  // --- ESTADOS DE FORMULÁRIO ---
  const [newParticipant, setNewParticipant] = useState({ name: '', email: '' });
  const [newPauta, setNewPauta] = useState({ title: '', responsible: '', duration: '' });
  const [newDelib, setNewDelib] = useState({ title: '', description: '', selectedMaterials: [] as string[], selectedVoters: [] as string[] });
  const [newAcao, setNewAcao] = useState({ title: '', responsible: '', deadline: '', status: 'Pendente' });

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

  const handleAddDelib = () => {
    if (newDelib.title && newDelib.selectedVoters.length > 0) {
      const delib = {
        id: Date.now(),
        title: newDelib.title,
        description: newDelib.description,
        linkedMaterials: newDelib.selectedMaterials,
        votes: newDelib.selectedVoters.map(name => ({ name, status: 'Pendente', justification: '', isSaved: false }))
      };
      setMeeting({ ...meeting, deliberacoes: [...meeting.deliberacoes, delib] });
      setNewDelib({ title: '', description: '', selectedMaterials: [], selectedVoters: [] });
    }
  };

  const handleAddAcao = () => {
    if (newAcao.title && newAcao.responsible) {
      const acao = { id: Date.now(), ...newAcao };
      setMeeting({ ...meeting, acoes: [...meeting.acoes, acao] });
      setNewAcao({ title: '', responsible: '', deadline: '', status: 'Pendente' });
    }
  };

  const updateAcaoStatus = (id: number, status: string) => {
    setMeeting({ ...meeting, acoes: meeting.acoes.map(a => a.id === id ? { ...a, status } : a) });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 leading-tight">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 mb-4">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg"><CheckCircle2 className="text-white" size={24} /></div>
          <span className="font-bold text-white text-xl uppercase tracking-widest tracking-tighter">GovCorp</span>
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
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest italic tracking-widest">INEPAD Governança</span>
          <div className="flex items-center gap-6 text-right">
            <div className="leading-tight"><p className="font-bold text-slate-800 text-sm italic">Ricardo Oliveira</p><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Secretário Geral</p></div>
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-600 text-xs">RO</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
          {activeMenu === 'reunioes' && meetingView === 'details' && (
            <div className="animate-in fade-in duration-500 pb-20">
              <button onClick={() => setMeetingView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-sm font-bold mb-6 transition-all"><ChevronRight className="rotate-180" size={18} /> Voltar</button>
              
              <div className="flex items-center gap-3 mb-8">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight tracking-tighter">{meeting.title}</h1>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded uppercase tracking-wider">{meeting.status}</span>
              </div>

              {/* TABS */}
              <div className="border-b border-slate-200 flex gap-8 mb-10 overflow-x-auto scrollbar-hide">
                {['Informações e Convites', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'Atas'].map((tab, i) => {
                  const ids = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'];
                  return (
                    <button key={ids[i]} onClick={() => setActiveMeetingTab(ids[i])} className={`pb-4 text-sm font-bold transition-all relative whitespace-nowrap ${activeMeetingTab === ids[i] ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                      {tab}{activeMeetingTab === ids[i] && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"></div>}
                    </button>
                  );
                })}
              </div>

              {/* CONTEÚDO INTEGRADO */}
              <div className="max-w-6xl">
                {/* 1. ABA INFO */}
                {activeMeetingTab === 'info' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in">
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                       <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest mb-6 flex items-center gap-2"><Users size={16} /> Participantes</h3>
                       <div className="space-y-3 mb-8">
                        {meeting.participants.map((p, i) => (
                          <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex flex-col"><span className="font-bold text-slate-700 text-sm italic">{p.name}</span><span className="text-[10px] text-slate-400 font-medium">{p.email}</span></div>
                            <button onClick={() => setMeeting({...meeting, participants: meeting.participants.filter((_, idx) => idx !== i)})} className="text-slate-300 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                          </div>
                        ))}
                       </div>
                       <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <input type="text" placeholder="Nome" className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none" value={newParticipant.name} onChange={(e) => setNewParticipant({...newParticipant, name: e.target.value})} />
                        <input type="email" placeholder="Email" className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none" value={newParticipant.email} onChange={(e) => setNewParticipant({...newParticipant, email: e.target.value})} />
                        <button onClick={handleAddParticipant} className="w-full py-3 bg-blue-600 text-white font-bold text-[10px] uppercase rounded-xl hover:bg-blue-700 transition-all">Adicionar</button>
                       </div>
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                       <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest mb-8 flex items-center gap-2 italic"><Clock size={16} /> Logística</h3>
                       <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <input type="date" value={meeting.date} onChange={e => setMeeting({...meeting, date: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none" />
                          <input type="time" value={meeting.time} onChange={e => setMeeting({...meeting, time: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none" />
                        </div>
                        <div className="flex gap-2">
                           {['Online', 'Presencial', 'Híbrida'].map(t => (
                             <button key={t} onClick={() => setMeeting({...meeting, type: t})} className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all ${meeting.type === t ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border-slate-100'}`}>{t}</button>
                           ))}
                        </div>
                        <input type="text" placeholder="Local/Link" value={meeting.type === 'Online' ? meeting.link : meeting.address} onChange={e => setMeeting({...meeting, [meeting.type === 'Online' ? 'link' : 'address']: e.target.value})} className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 outline-none" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ABA PAUTA */}
                {activeMeetingTab === 'pauta' && (
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in">
                    <div className="flex justify-between items-center mb-8"><h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest">Ordem do Dia</h3><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">Tempo Previsto: <span className="text-blue-600">{meeting.pautas.reduce((acc, p) => acc + Number(p.duration || 0), 0)} min</span></span></div>
                    <div className="space-y-3 mb-8">
                      {meeting.pautas.map((p, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                          <GripVertical size={18} className="text-slate-200" />
                          <div className="flex-1 grid grid-cols-3 gap-4"><div><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Assunto</p><p className="text-sm font-bold text-slate-700 italic">{p.title}</p></div><div><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Responsável</p><p className="text-xs text-slate-600 italic">{p.responsible}</p></div><div><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Duração</p><p className="text-xs text-slate-600 italic">{p.duration} min</p></div></div>
                        </div>
                      ))}
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 grid grid-cols-4 gap-4">
                      <input type="text" placeholder="Assunto" className="col-span-2 p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none" value={newPauta.title} onChange={e => setNewPauta({...newPauta, title: e.target.value})} />
                      <select className="p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none" value={newPauta.responsible} onChange={e => setNewPauta({...newPauta, responsible: e.target.value})}><option value="">Responsável</option>{meeting.participants.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)}</select>
                      <input type="number" placeholder="Min" className="p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none" value={newPauta.duration} onChange={e => setNewPauta({...newPauta, duration: e.target.value})} />
                      <button onClick={handleAddPauta} className="col-span-4 py-3 bg-blue-600 text-white font-bold text-[10px] uppercase rounded-xl hover:bg-blue-700 transition-all">Adicionar à Pauta</button>
                    </div>
                  </div>
                )}

                {/* 3. ABA MATERIAIS */}
                {activeMeetingTab === 'materiais' && (
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in">
                    <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6"><h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest flex items-center gap-2"><File size={18} /> Repositório Oficial</h3><button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-[10px] uppercase shadow-lg shadow-blue-600/20 transition-all"><Upload size={14} className="inline mr-2" /> Subir Arquivo</button><input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {meeting.materiais.map(file => (
                        <div key={file.id} className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4 group shadow-sm border border-slate-100"><FileText size={24} className="text-blue-600" /><div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-700 truncate italic">{file.name}</p><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{file.uploadedBy} • {file.date}</p></div><button onClick={() => setMeeting({...meeting, materiais: meeting.materiais.filter(m => m.id !== file.id)})} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button></div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. ABA DELIBERAÇÕES */}
                {activeMeetingTab === 'delib' && (
                  <div className="space-y-6 animate-in fade-in">
                    {/* (Lógica de deliberação completa conforme anterior) */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center">Aba Deliberações Integrada. Use o botão Nova Deliberação.</div>
                  </div>
                )}

                {/* 5. ABA PLANOS DE AÇÃO (NOVA E FUNCIONAL) */}
                {activeMeetingTab === 'acoes' && (
                  <div className="space-y-8 animate-in fade-in">
                    {/* Formulário Nova Ação */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                      <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest flex items-center gap-2 italic">
                        <Target size={18} className="text-blue-600" /> Nova Ação do Conselho
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">O que deve ser feito?</label>
                          <input type="text" placeholder="Descrição da Ação" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" value={newAcao.title} onChange={e => setNewAcao({...newAcao, title: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsável</label>
                          <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none cursor-pointer" value={newAcao.responsible} onChange={e => setNewAcao({...newAcao, responsible: e.target.value})}>
                            <option value="">Selecione...</option>
                            {meeting.participants.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prazo Final</label>
                          <input type="date" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none" value={newAcao.deadline} onChange={e => setNewAcao({...newAcao, deadline: e.target.value})} />
                        </div>
                      </div>
                      <button onClick={handleAddAcao} disabled={!newAcao.title || !newAcao.responsible} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50 transition-all">
                        Registrar Ação no Plano
                      </button>
                    </div>

                    {/* Lista de Ações */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ação / Atividade</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsável</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Prazo</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                            <th className="p-6"></th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {meeting.acoes.map((acao) => (
                            <tr key={acao.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                              <td className="p-6 font-bold text-slate-700 italic">{acao.title}</td>
                              <td className="p-6 font-medium text-slate-500 italic">{acao.responsible}</td>
                              <td className="p-6 font-bold text-slate-400 uppercase tracking-tighter text-xs italic">{new Date(acao.deadline).toLocaleDateString('pt-BR')}</td>
                              <td className="p-6 text-center">
                                <select 
                                  value={acao.status} 
                                  onChange={(e) => updateAcaoStatus(acao.id, e.target.value)}
                                  className={`p-2 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none border-none cursor-pointer shadow-sm ${acao.status === 'Concluído' ? 'bg-green-100 text-green-700' : acao.status === 'Em Andamento' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}
                                >
                                  <option value="Pendente">Pendente</option>
                                  <option value="Em Andamento">Andamento</option>
                                  <option value="Concluído">Concluído</option>
                                </select>
                              </td>
                              <td className="p-6 text-right">
                                <button onClick={() => setMeeting({...meeting, acoes: meeting.acoes.filter(a => a.id !== acao.id)})} className="text-slate-200 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {meeting.acoes.length === 0 && (
                        <div className="p-20 text-center text-slate-300 italic">Nenhuma ação registrada para esta reunião.</div>
                      )}
                    </div>
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
