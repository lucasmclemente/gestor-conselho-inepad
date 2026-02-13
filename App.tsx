import React, { useState } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, 
  Plus, ChevronRight, Mail, UserPlus, Clock, MapPin, 
  CheckCircle2, AlertCircle, FileText, Send, Award, X, Trash2,
  Link as LinkIcon, Map, GripVertical, User
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const App = () => {
  // Navegação
  const [activeMenu, setActiveMenu] = useState('reunioes');
  const [meetingView, setMeetingView] = useState('details');
  const [activeMeetingTab, setActiveMeetingTab] = useState('pauta');

  // Estado da Reunião
  const [meeting, setMeeting] = useState({
    title: 'Nova Reunião Estratégica',
    status: 'AGENDADA',
    date: '2026-02-13',
    time: '10:00',
    type: 'Online',
    location: 'Google Meet',
    address: '',
    link: 'https://meet.google.com/abc-defg-hij',
    participants: [
      { name: 'Ricardo Oliveira', email: 'ricardo.oliveira@inepad.com.br' },
      { name: 'Consultor Inepad', email: 'contato@inepad.com.br' }
    ],
    pautas: [
      { title: 'Apresentação dos Resultados Q4', responsible: 'Ricardo Oliveira', duration: '30' },
      { title: 'Aprovação do Orçamento 2026', responsible: 'Consultor Inepad', duration: '45' }
    ]
  });

  // Estados para novos itens
  const [newParticipant, setNewParticipant] = useState({ name: '', email: '' });
  const [newPauta, setNewPauta] = useState({ title: '', responsible: '', duration: '' });

  // Funções Participantes
  const handleAddParticipant = () => {
    if (newParticipant.name && newParticipant.email) {
      setMeeting({ ...meeting, participants: [...meeting.participants, newParticipant] });
      setNewParticipant({ name: '', email: '' });
    }
  };

  // Funções Ordem do Dia
  const handleAddPauta = () => {
    if (newPauta.title && newPauta.responsible) {
      setMeeting({ ...meeting, pautas: [...meeting.pautas, newPauta] });
      setNewPauta({ title: '', responsible: '', duration: '' });
    }
  };

  const removePauta = (index: number) => {
    setMeeting({ ...meeting, pautas: meeting.pautas.filter((_, i) => i !== index) });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900">
      {/* Sidebar Lateral */}
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 mb-4">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
            <CheckCircle2 className="text-white" size={24} />
          </div>
          <span className="font-bold text-white text-xl tracking-tight uppercase">GovCorp</span>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <button onClick={() => {setActiveMenu('dashboard'); setMeetingView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button onClick={() => {setActiveMenu('reunioes'); setMeetingView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
            <Calendar size={20} /> Reuniões
          </button>
          <button onClick={() => setActiveMenu('configuracoes')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'configuracoes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
            <Settings size={20} /> Configurações
          </button>
        </nav>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest italic tracking-widest">Portal de Governança INEPAD</span>
          <div className="flex items-center gap-6">
            <div className="text-right leading-tight">
              <p className="font-bold text-slate-800 text-sm">Ricardo Oliveira</p>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Secretário Geral</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-600 text-xs">RO</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
          
          {/* VISÃO DETALHES REUNIÃO */}
          {activeMenu === 'reunioes' && meetingView === 'details' && (
            <div className="animate-in fade-in duration-500 pb-20">
              <button onClick={() => setMeetingView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-sm font-bold mb-6">
                <ChevronRight className="rotate-180" size={18} /> Voltar para a lista
              </button>
              
              <div className="flex items-center gap-3 mb-8">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">{meeting.title}</h1>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded uppercase tracking-wider">{meeting.status}</span>
              </div>

              {/* TABS */}
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

              {/* CONTEÚDO DA ABA SELECIONADA */}
              <div className="max-w-6xl">
                
                {/* ABA INFORMAÇÕES E CONVITES (Resumo) */}
                {activeMeetingTab === 'info' && (
                   <div className="space-y-8 animate-in slide-in-from-bottom-2">
                     <div className="bg-[#eff2ff] p-8 rounded-3xl border border-blue-100">
                        <h3 className="text-indigo-900 font-bold text-sm flex items-center gap-2 mb-2"><Send size={16} /> Convocação e Invites</h3>
                        <p className="text-indigo-800/70 text-xs mb-6 max-w-2xl font-medium">Envie a convocação formal. O link e as pautas abaixo serão anexados automaticamente.</p>
                        <button className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all">Disparar Convites</button>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Renderizar cartões de participantes e logística aqui (igual anterior) */}
                     </div>
                   </div>
                )}

                {/* ABA ORDEM DO DIA (Funcional) */}
                {activeMeetingTab === 'pauta' && (
                  <div className="space-y-6 animate-in slide-in-from-bottom-2">
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="flex justify-between items-center mb-8">
                        <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                          <ClipboardList size={18} className="text-slate-400" /> Cronograma da Reunião
                        </h3>
                        <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                          Tempo Total Previsto: <span className="text-blue-600">{meeting.pautas.reduce((acc, p) => acc + Number(p.duration || 0), 0)} min</span>
                        </div>
                      </div>

                      {/* Lista de Pautas */}
                      <div className="space-y-3 mb-8">
                        {meeting.pautas.length > 0 ? meeting.pautas.map((p, i) => (
                          <div key={i} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 transition-all group shadow-sm">
                            <GripVertical size={18} className="text-slate-200 cursor-grab" />
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Assunto</p>
                                <p className="text-sm font-bold text-slate-700">{p.title}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Responsável</p>
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                  <User size={14} className="text-slate-400" /> {p.responsible}
                                </div>
                              </div>
                              <div className="text-right md:text-left">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tempo</p>
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                  <Clock size={14} className="text-slate-400" /> {p.duration} min
                                </div>
                              </div>
                            </div>
                            <button onClick={() => removePauta(i)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )) : (
                          <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                             <AlertCircle className="mx-auto mb-2 text-slate-200" size={32} />
                             <p className="text-slate-400 text-xs font-medium uppercase">Nenhuma pauta adicionada</p>
                          </div>
                        )}
                      </div>

                      {/* Formulário para Nova Pauta */}
                      <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-2">
                             <input type="text" placeholder="Título da Pauta / Assunto" className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none" value={newPauta.title} onChange={e => setNewPauta({...newPauta, title: e.target.value})} />
                          </div>
                          <div>
                            <select className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none font-medium text-slate-600" value={newPauta.responsible} onChange={e => setNewPauta({...newPauta, responsible: e.target.value})}>
                              <option value="">Responsável</option>
                              {meeting.participants.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
                            </select>
                          </div>
                          <div>
                             <input type="number" placeholder="Minutos" className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none" value={newPauta.duration} onChange={e => setNewPauta({...newPauta, duration: e.target.value})} />
                          </div>
                        </div>
                        <button onClick={handleAddPauta} disabled={!newPauta.title || !newPauta.responsible} className="mt-4 w-full py-3 bg-blue-600 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50">
                          + Adicionar Pauta à Ordem do Dia
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* PLACEHOLDERS PARA OUTRAS ABAS */}
                {!['info', 'pauta'].includes(activeMeetingTab) && (
                  <div className="bg-white p-20 rounded-3xl border border-slate-100 shadow-sm text-center">
                    <AlertCircle className="mx-auto mb-4 text-slate-100" size={64} />
                    <p className="text-slate-300 font-bold uppercase tracking-widest text-sm italic tracking-widest">Módulo {activeMeetingTab.toUpperCase()} em construção...</p>
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
