
import React, { useState } from 'react';
import { 
  Meeting, 
  MeetingStatus 
} from './types';
import { 
  INITIAL_MEETINGS 
} from './constants';
import Dashboard from './components/Dashboard';
import MeetingDetail from './components/MeetingDetail';
import { 
  LayoutDashboard, 
  Calendar, 
  Settings, 
  LogOut, 
  Search, 
  Plus, 
  ShieldCheck,
  ChevronRight,
  Bell
} from 'lucide-react';

const App: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>(INITIAL_MEETINGS);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'meetings'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);

  const handleUpdateMeeting = (updated: Meeting) => {
    setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  const handleCreateMeeting = () => {
    const newMeeting: Meeting = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'Nova Reunião Estratégica',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      location: 'Sala Virtual / Presencial',
      status: MeetingStatus.SCHEDULED,
      agenda: [],
      materials: [],
      participants: [],
      deliberations: [],
      actions: [],
    };
    setMeetings([newMeeting, ...meetings]);
    setSelectedMeetingId(newMeeting.id);
    setActiveMenu('meetings');
  };

  const filteredMeetings = meetings.filter(m => 
    m.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#f8fafc]">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">GovCorp</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => { setActiveMenu('dashboard'); setSelectedMeetingId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
              ${activeMenu === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Dashboard</span>
          </button>
          <button 
            onClick={() => { setActiveMenu('meetings'); setSelectedMeetingId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
              ${activeMenu === 'meetings' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Calendar className="w-5 h-5" />
            <span className="font-medium">Reuniões</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 hover:text-white transition-all opacity-60">
            <Settings className="w-5 h-5" />
            <span className="font-medium">Configurações</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 hover:text-white transition-all">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header Bar */}
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm">
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar reuniões, atas ou decisões..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg border border-slate-200">
              <Bell className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800 leading-none mb-1">Ricardo Oliveira</p>
                <p className="text-xs text-slate-500 leading-none">Secretário Geral</p>
              </div>
              <img src="https://picsum.photos/seed/governance/32/32" className="w-8 h-8 rounded-full border border-slate-200" alt="Profile" />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8 max-w-7xl mx-auto">
          {activeMenu === 'dashboard' ? (
            <Dashboard meetings={meetings} />
          ) : (
            <>
              {selectedMeetingId ? (
                selectedMeeting ? (
                  <MeetingDetail 
                    meeting={selectedMeeting} 
                    onBack={() => setSelectedMeetingId(null)}
                    onUpdate={handleUpdateMeeting}
                  />
                ) : (
                  <p>Reunião não encontrada.</p>
                )
              ) : (
                <div className="space-y-6">
                  <header className="flex justify-between items-center">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-800">Gerenciamento de Reuniões</h2>
                      <p className="text-slate-500 mt-1">Controle convocações, pautas e registros oficiais.</p>
                    </div>
                    <button 
                      onClick={handleCreateMeeting}
                      className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-100 flex items-center gap-2 hover:bg-indigo-700 transition-all active:scale-95"
                    >
                      <Plus className="w-5 h-5" /> Nova Reunião
                    </button>
                  </header>

                  <div className="grid grid-cols-1 gap-4">
                    {filteredMeetings.length > 0 ? filteredMeetings.map((meeting) => (
                      <div 
                        key={meeting.id}
                        onClick={() => setSelectedMeetingId(meeting.id)}
                        className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer group flex items-center justify-between"
                      >
                        <div className="flex gap-6 items-center">
                          <div className="bg-indigo-50 p-4 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Calendar className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{meeting.title}</h3>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                                ${meeting.status === MeetingStatus.CONCLUDED ? 'bg-emerald-100 text-emerald-700' : 
                                  meeting.status === MeetingStatus.SCHEDULED ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                {meeting.status}
                              </span>
                            </div>
                            <p className="text-slate-500 text-sm flex items-center gap-4">
                              <span>📅 {meeting.date}</span>
                              <span>⏰ {meeting.time}</span>
                              <span>📍 {meeting.location}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-slate-800">{meeting.participants.length}</p>
                            <p className="text-xs text-slate-400">Participantes</p>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-slate-800">{meeting.actions.length}</p>
                            <p className="text-xs text-slate-400">Ações</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                        </div>
                      </div>
                    )) : (
                      <div className="bg-white rounded-xl border border-dashed border-slate-200 p-20 text-center">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-800 mb-1">Nenhuma reunião encontrada</h3>
                        <p className="text-slate-500">Ajuste seus filtros ou crie uma nova reunião para começar.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
