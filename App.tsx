import React, { useState } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, 
  Plus, ChevronRight, Mail, UserPlus, Clock, MapPin, 
  CheckCircle2, AlertCircle, FileText, Send, Award, X
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const App = () => {
  // Estados de Navegação
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [meetingView, setMeetingView] = useState('list');
  const [activeMeetingTab, setActiveMeetingTab] = useState('info');

  // Estado da Reunião (Funcional para a aba Info)
  const [meeting, setMeeting] = useState({
    title: 'Nova Reunião Estratégica',
    status: 'AGENDADA',
    date: '2026-02-13',
    time: '10:00',
    location: 'Sala Virtual / Presencial',
    participants: ['Ricardo Oliveira', 'Consultor Inepad']
  });

  // Dados do Dashboard
  const barData = [
    { name: 'Jan/26', pauta: 4, acoes: 3 },
    { name: 'Fev/26', pauta: 2, acoes: 1 },
  ];

  const pieData = [
    { name: 'Concluídas', value: 3, color: '#10b981' },
    { name: 'Em Andamento', value: 2, color: '#6366f1' },
  ];

  const addParticipant = () => {
    const name = prompt("Nome do participante:");
    if (name) setMeeting({ ...meeting, participants: [...meeting.participants, name] });
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
          <button onClick={() => {setActiveMenu('dashboard'); setMeetingView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}`}>
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button onClick={() => {setActiveMenu('reunioes'); setMeetingView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Calendar size={20} /> Reuniões
          </button>
          <button onClick={() => setActiveMenu('configuracoes')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'configuracoes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Settings size={20} /> Configurações
          </button>
        </nav>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">INEPAD Conselhos</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right leading-tight">
              <p className="font-bold text-slate-800 text-sm">Ricardo Oliveira</p>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider text-center">Secretário Geral</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-blue-600 text-xs">RO</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
          
          {/* TELA 1: DASHBOARD */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in duration-500">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm h-80">
                  <h3 className="font-bold text-slate-800 mb-8 uppercase text-xs tracking-widest">Status das Ações</h3>
                  <div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm h-80">
                  <h3 className="font-bold text-slate-800 mb-8 uppercase text-xs tracking-widest">Atividade Recente</h3>
                  <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={barData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="pauta" fill="#3b82f6" radius={[4, 4, 0, 0]} /><Bar dataKey="acoes" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </div>
              </div>
            </div>
          )}

          {/* TELA 2: LISTA DE REUNIÕES */}
          {activeMenu === 'reunioes' && meetingView === 'list' && (
            <div className="space-y-8 animate-in slide-in-from-right duration-500">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">Histórico de Reuniões</h1>
                  <p className="text-slate-500 text-sm">Gerencie o calendário e documentos do conselho.</p>
                </div>
                <button onClick={() => setMeetingView('details')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all">
                  <Plus size={18} /> Nova Reunião
                </button>
              </div>
              <div className="space-y-4">
                {[{ title: meeting.title, date: '13/02/2026', status: 'AGENDADA', color: 'blue' }].map((item, i) => (
                  <div key={i} onClick={() => setMeetingView('details')} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between group">
                    <div className="flex items-center gap-6">
                      <div className="p-4 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Calendar size={24} /></div>
                      <div>
                        <h3 className="font-bold text-slate-800">{item.title}</h3>
                        <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-widest font-bold text-blue-600">{item.status} • {item.date}</p>
                      </div>
                    </div>
                    <ChevronRight className="text-slate-300" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TELA 3: DETALHES DA REUNIÃO */}
          {activeMenu === 'reunioes' && meetingView === 'details' && (
            <div className="animate-in slide-in-from-bottom duration-500">
              <button onClick={() => setMeetingView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-sm font-bold mb-6 transition-colors">
                <ChevronRight className="rotate-180" size={18} /> Voltar para a lista
              </button>
              
              <div className="flex items-center gap-3 mb-8">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">{meeting.title}</h1>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded uppercase tracking-wider">{meeting.status}</span>
              </div>

              {/* Abas Internas */}
              <div className="border-b border-slate-200 flex gap-8 mb-10 overflow-x-auto scrollbar-hide">
                {['Informações e Convites', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'Atas'].map((tab, i) => {
                  const id = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i];
                  return (
                    <button key={id} onClick={() => setActiveMeetingTab(id)} className={`pb-4 text-sm font-bold transition-all relative whitespace-nowrap ${activeMeetingTab === id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                      {tab}
                      {activeMeetingTab === id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"></div>}
                    </button>
                  );
                })}
              </div>

              {/* Conteúdo Aba Info */}
              {activeMeetingTab === 'info' && (
                <div className="space-y-8 max-w-5xl pb-10">
                  <div className="bg-[#eff2ff] p-8 rounded-3xl border border-blue-100">
                    <h3 className="text-indigo-900 font-bold text-sm flex items-center gap-2 mb-2"><Send size={16} /> Convocação e Invites</h3>
                    <p className="text-indigo-800/70 text-xs mb-6 max-w-2xl">Envie a convocação formal para todos os conselheiros e diretores. O link da reunião e os materiais da pauta serão anexados automaticamente.</p>
                    <button className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700">Enviar Convocações por E-mail</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
                      <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest mb-6 flex items-center gap-2"><UserPlus size={16} className="text-slate-400" /> Lista de Participantes</h3>
                      <div className="space-y-3 mb-6 flex-1">
                        {meeting.participants.map((p, i) => (
                          <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl text-sm font-medium text-slate-700 border border-slate-100">
                            {p} <X size={14} className="text-slate-300 cursor-pointer hover:text-red-500" onClick={() => setMeeting({...meeting, participants: meeting.participants.filter((_, idx) => idx !== i)})} />
                          </div>
                        ))}
                      </div>
                      <button onClick={addParticipant} className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-slate-300 font-bold text-[10px] uppercase tracking-widest hover:border-blue-200 hover:text-blue-400 transition-all">+ Adicionar Convidado</button>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                      <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest mb-8 flex items-center gap-2"><Clock size={16} className="text-slate-400" /> Detalhes Logísticos</h3>
                      <div className="space-y-6">
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Data e Hora:</span>
                          <div className="flex gap-2">
                            <input type="date" value={meeting.date} onChange={e => setMeeting({...meeting, date: e.target.value})} className="font-bold text-slate-700 text-xs bg-transparent outline-none text-right" />
                            <input type="time" value={meeting.time} onChange={e => setMeeting({...meeting, time: e.target.value})} className="font-bold text-slate-700 text-xs bg-transparent outline-none text-right" />
                          </div>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Localização:</span>
                          <input type="text" value={meeting.location} onChange={e => setMeeting({...meeting, location: e.target.value})} className="font-bold text-slate-700 text-xs bg-transparent outline-none text-right w-1/2" />
                        </div>
                        <div className="pt-6">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Alterar Status</label>
                          <select value={meeting.status} onChange={e => setMeeting({...meeting, status: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none">
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
                  <p className="text-slate-300 font-bold uppercase tracking-widest text-sm">Aba em Desenvolvimento</p>
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
