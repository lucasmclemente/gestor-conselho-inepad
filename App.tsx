import React, { useState } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, 
  Plus, ChevronRight, Mail, UserPlus, Clock, MapPin, 
  CheckCircle2, AlertCircle, FileText, Send, Award, X, Trash2,
  Link as LinkIcon, Map, Globe
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const App = () => {
  // Navegação
  const [activeMenu, setActiveMenu] = useState('reunioes');
  const [meetingView, setMeetingView] = useState('details');
  const [activeMeetingTab, setActiveMeetingTab] = useState('info');

  // Estado da Reunião (Logística Completa)
  const [meeting, setMeeting] = useState({
    title: 'Nova Reunião Estratégica',
    status: 'AGENDADA',
    date: '2026-02-13',
    time: '10:00',
    type: 'Online', // Online, Presencial, Híbrida
    location: 'Google Meet',
    address: '',
    link: 'https://meet.google.com/abc-defg-hij',
    participants: [
      { name: 'Ricardo Oliveira', email: 'ricardo.oliveira@inepad.com.br' },
      { name: 'Consultor Inepad', email: 'contato@inepad.com.br' }
    ]
  });

  const [newParticipant, setNewParticipant] = useState({ name: '', email: '' });

  // Funções
  const handleAddParticipant = () => {
    if (newParticipant.name && newParticipant.email) {
      setMeeting({ ...meeting, participants: [...meeting.participants, newParticipant] });
      setNewParticipant({ name: '', email: '' });
    }
  };

  const removeParticipant = (index: number) => {
    setMeeting({ ...meeting, participants: meeting.participants.filter((_, i) => i !== index) });
  };

  // Dados Dashboard
  const barData = [{ name: 'Jan/26', pauta: 4, acoes: 3 }, { name: 'Fev/26', pauta: 2, acoes: 1 }];
  const pieData = [{ name: 'Concluídas', value: 3, color: '#10b981' }, { name: 'Em Andamento', value: 2, color: '#6366f1' }];

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
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest italic">Portal de Governança INEPAD</span>
          <div className="flex items-center gap-6">
            <div className="text-right leading-tight">
              <p className="font-bold text-slate-800 text-sm">Ricardo Oliveira</p>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Secretário Geral</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-600 text-xs">RO</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
          
          {/* DASHBOARD */}
          {activeMenu === 'dashboard' && (
            <div className="animate-in fade-in duration-500 space-y-8">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Painel de Controle</h1>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 {[
                  { label: 'Ações Concluídas', value: '3/5', icon: <CheckCircle2 size={20}/>, color: 'blue' },
                  { label: 'Deliberações', value: '28', icon: <FileText size={20}/>, color: 'green' },
                  { label: 'Ações Pendentes', value: '2', icon: <Clock size={20}/>, color: 'amber' },
                  { label: 'Atas Registradas', value: '11', icon: <FileText size={20}/>, color: 'blue' },
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

          {/* LISTA DE REUNIÕES */}
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
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-blue-600">{meeting.status} • {meeting.date}</p>
                  </div>
                </div>
                <ChevronRight className="text-slate-300" />
              </div>
            </div>
          )}

          {/* DETALHES DA REUNIÃO */}
          {activeMenu === 'reunioes' && meetingView === 'details' && (
            <div className="animate-in slide-in-from-bottom duration-500 pb-20">
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

              {/* ABA INFORMAÇÕES E CONVITES */}
              {activeMeetingTab === 'info' && (
                <div className="space-y-8 max-w-6xl">
                  {/* Card Convocação */}
                  <div className="bg-[#eff2ff] p-8 rounded-3xl border border-blue-100">
                    <h3 className="text-indigo-900 font-bold text-sm flex items-center gap-2 mb-2"><Send size={16} /> Convocação e Invites</h3>
                    <p className="text-indigo-800/70 text-xs mb-6 max-w-2xl font-medium">Envie a convocação formal. O link da reunião e os materiais da pauta serão anexados automaticamente.</p>
                    <button className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all">
                       Disparar Convites por E-mail
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Lista Participantes */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full">
                      <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest mb-6 flex items-center gap-2"><UserPlus size={16} className="text-slate-400" /> Participantes</h3>
                      <div className="space-y-3 mb-8 flex-1">
                        {meeting.participants.map((p, i) => (
                          <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-700 text-sm">{p.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{p.email}</span>
                            </div>
                            <button onClick={() => removeParticipant(i)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-3 p-5 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <input type="text" placeholder="Nome" className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none" value={newParticipant.name} onChange={(e) => setNewParticipant({...newParticipant, name: e.target.value})} />
                        <input type="email" placeholder="Email" className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none" value={newParticipant.email} onChange={(e) => setNewParticipant({...newParticipant, email: e.target.value})} />
                        <button onClick={handleAddParticipant} disabled={!newParticipant.name || !newParticipant.email} className="w-full py-3 bg-blue-600 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50">
                          Adicionar à Lista
                        </button>
                      </div>
                    </div>

                    {/* Logística Inteligente */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full">
                      <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest mb-8 flex items-center gap-2"><Clock size={16} className="text-slate-400" /> Logística da Reunião</h3>
                      <div className="space-y-6 flex-1">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</label>
                            <input type="date" value={meeting.date} onChange={e => setMeeting({...meeting, date: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horário</label>
                            <input type="time" value={meeting.time} onChange={e => setMeeting({...meeting, time: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de Reunião</label>
                          <div className="flex gap-2">
                            {['Presencial', 'Online', 'Híbrida'].map(type => (
                              <button key={type} onClick={() => setMeeting({...meeting, type})} className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all ${meeting.type === type ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-100 hover:border-blue-200'}`}>
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>

                        {(meeting.type === 'Online' || meeting.type === 'Híbrida') && (
                          <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1"><LinkIcon size={12}/> Link da Reunião</label>
                            <input type="url" placeholder="https://zoom.us/j/..." value={meeting.link} onChange={e => setMeeting({...meeting, link: e.target.value})} className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs font-medium text-blue-900 outline-none focus:ring-1 focus:ring-blue-400" />
                          </div>
                        )}

                        {(meeting.type === 'Presencial' || meeting.type === 'Híbrida') && (
                          <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Map size={12}/> Endereço / Sala</label>
                            <input type="text" placeholder="Ex: Av. Paulista, 1000 - Sala 12" value={meeting.address} onChange={e => setMeeting({...meeting, address: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none" />
                          </div>
                        )}

                        <div className="pt-4">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Status do Evento</label>
                          <select value={meeting.status} onChange={e => setMeeting({...meeting, status: e.target.value})} className="w-full p-3 bg-slate-100 border-none rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer">
                            <option value="AGENDADA">Agendada</option>
                            <option value="EM ANDAMENTO">Em Andamento</option>
                            <option value="CONCLUÍDA">Concluída</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeMeetingTab !== 'info' && (
                <div className="bg-white p-20 rounded-3xl border border-slate-100 shadow-sm text-center">
                  <AlertCircle className="mx-auto mb-4 text-slate-100" size={64} />
                  <p className="text-slate-300 font-bold uppercase tracking-widest text-sm italic">Módulo em construção...</p>
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
