import React, { useState } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, 
  Plus, ChevronRight, Mail, UserPlus, Clock, MapPin, 
  CheckCircle2, AlertCircle, FileText, BarChart3, PieChart as PieChartIcon,
  Send, Award, X
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const App = () => {
  const [activeMenu, setActiveMenu] = useState('reunioes');
  const [view, setView] = useState('details'); 
  const [activeMeetingTab, setActiveMeetingTab] = useState('info');

  // Estado para os dados da reunião
  const [meeting, setMeeting] = useState({
    title: 'Nova Reunião Estratégica',
    status: 'Agendada',
    date: '2026-02-13T10:00',
    location: 'Sala Virtual / Presencial',
    participants: [] as string[]
  });

  const addParticipant = () => {
    const name = prompt("Nome do participante:");
    if (name) setMeeting({ ...meeting, participants: [...meeting.participants, name] });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900">
      {/* Sidebar Lateral */}
      <aside className="w-64 bg-[#1e1b4b] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-6 flex items-center gap-3 mb-4">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-lg">
            <CheckCircle2 className="text-white" size={24} />
          </div>
          <span className="font-bold text-white text-xl tracking-tight">GovCorp</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <button onClick={() => {setActiveMenu('dashboard'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-900/50'}`}>
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'reunioes' ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-900/50'}`}>
            <Calendar size={20} /> Reuniões
          </button>
          <button onClick={() => setActiveMenu('configuracoes')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'configuracoes' ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-900/50'}`}>
            <Settings size={20} /> Configurações
          </button>
        </nav>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right leading-tight">
              <p className="font-bold text-slate-800 text-sm">Ricardo Oliveira</p>
              <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Secretário Geral</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
          {activeMenu === 'reunioes' && view === 'details' && (
            <div className="animate-in fade-in duration-500">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setView('list')} className="text-slate-400 hover:text-indigo-600 mr-2"><ChevronRight className="rotate-180" size={24} /></button>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">{meeting.title}</h1>
                <span className="px-3 py-1 bg-blue-100 text-blue-600 text-[10px] font-black rounded uppercase tracking-wider">{meeting.status}</span>
              </div>
              <p className="text-slate-400 text-xs font-medium mb-8 ml-8 flex items-center gap-2">
                <Calendar size={14} /> {meeting.date.replace('T', ' às ')} <MapPin size={14} /> {meeting.location}
              </p>

              {/* Tabs Internas */}
              <div className="border-b border-slate-200 flex gap-8 mb-8 overflow-x-auto">
                {['Informações e Convites', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'ATAs'].map((tab, i) => {
                  const id = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i];
                  return (
                    <button key={id} onClick={() => setActiveMeetingTab(id)} className={`pb-4 text-xs font-bold transition-all relative whitespace-nowrap ${activeMeetingTab === id ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {tab}
                      {activeMeetingTab === id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600"></div>}
                    </button>
                  );
                })}
              </div>

              {/* Conteúdo Aba Informações e Convites */}
              {activeMeetingTab === 'info' && (
                <div className="space-y-6 max-w-6xl">
                  {/* Seção Convocação e Invites */}
                  <div className="bg-[#eff2ff] p-6 rounded-xl border border-blue-100">
                    <h3 className="text-indigo-900 font-bold text-sm flex items-center gap-2 mb-2">
                      <Send size={16} /> Convocação e Invites
                    </h3>
                    <p className="text-indigo-800/70 text-xs mb-4">
                      Envie a convocação formal para todos os conselheiros e diretores. O link da reunião e os materiais da pauta serão anexados automaticamente.
                    </p>
                    <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold text-xs hover:bg-indigo-700 transition-all shadow-md">
                      Enviar Convocações por E-mail
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Lista de Participantes */}
                    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                      <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Users size={16} className="text-slate-400" /> Lista de Participantes
                      </h3>
                      <div className="space-y-2 mb-4">
                        {meeting.participants.map((p, i) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg text-sm border border-slate-100">
                            <span className="font-medium text-slate-700">{p}</span>
                            <button onClick={() => setMeeting({...meeting, participants: meeting.participants.filter((_, idx) => idx !== i)})} className="text-slate-300 hover:text-red-500"><X size={14}/></button>
                          </div>
                        ))}
                      </div>
                      <button onClick={addParticipant} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center justify-center gap-2">
                        <Plus size={14} /> Adicionar Convidado
                      </button>
                    </div>

                    {/* Detalhes Logísticos */}
                    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-6">
                      <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                        <Clock size={16} className="text-slate-400" /> Detalhes Logísticos
                      </h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-bold">DATA E HORA:</span>
                          <input type="datetime-local" value={meeting.date} onChange={(e) => setMeeting({...meeting, date: e.target.value})} className="font-bold text-slate-700 bg-transparent outline-none text-right cursor-pointer hover:text-indigo-600" />
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-bold">LOCALIZAÇÃO:</span>
                          <input type="text" value={meeting.location} onChange={(e) => setMeeting({...meeting, location: e.target.value})} className="font-bold text-slate-700 bg-transparent outline-none text-right hover:text-indigo-600 w-1/2" />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-50">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Alterar Status</label>
                        <select 
                          value={meeting.status} 
                          onChange={(e) => setMeeting({...meeting, status: e.target.value})}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="Agendada">Agendada</option>
                          <option value="Em Andamento">Em Andamento</option>
                          <option value="Concluída">Concluída</option>
                          <option value="Cancelada">Cancelada</option>
                        </select>
                      </div>
                    </div>
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

// Ícone Users que faltou importar corretamente
const Users = ({ size, className }: { size: number, className: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);

export default App;
