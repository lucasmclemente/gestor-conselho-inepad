import React, { useState, useRef } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, 
  Plus, ChevronRight, Mail, UserPlus, Clock, MapPin, 
  CheckCircle2, AlertCircle, FileText, Send, Award, X, Trash2,
  Link as LinkIcon, Map, GripVertical, ClipboardList, User, Upload, File,
  Check, ShieldAlert, Info
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const App = () => {
  // Navegação
  const [activeMenu, setActiveMenu] = useState('reunioes');
  const [meetingView, setMeetingView] = useState('details');
  const [activeMeetingTab, setActiveMeetingTab] = useState('delib');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado Central da Reunião
  const [meeting, setMeeting] = useState({
    title: 'Nova Reunião Estratégica',
    status: 'AGENDADA',
    date: '2026-02-13',
    time: '10:00',
    type: 'Online',
    location: 'Plataforma Digital',
    participants: [
      { name: 'Ricardo Oliveira', email: 'ricardo.oliveira@inepad.com.br' },
      { name: 'Consultor Inepad', email: 'contato@inepad.com.br' }
    ],
    pautas: [
      { title: 'Abertura e Boas-vindas', responsible: 'Ricardo Oliveira', duration: '10' }
    ],
    materiais: [
      { id: 1, name: 'DRE_Consolidado_2025.pdf', size: '1.2 MB', uploadedBy: 'Ricardo Oliveira', date: '13/02/2026 09:15' }
    ],
    deliberacoes: [
      { 
        id: 1, 
        title: 'Aprovação do Plano de Investimento 2026', 
        description: 'Deliberação sobre o aporte de capital para novas tecnologias.',
        linkedMaterials: ['DRE_Consolidado_2025.pdf'],
        votes: [
          { name: 'Ricardo Oliveira', status: 'Aprovado' },
          { name: 'Consultor Inepad', status: 'Aprovado' }
        ]
      }
    ]
  });

  // Estados para novas entradas
  const [newDelib, setNewDelib] = useState({ title: '', description: '', selectedMaterials: [] as string[] });

  // Funções de Deliberação
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
    const updatedDelibs = meeting.deliberacoes.map(d => {
      if (d.id === delibId) {
        return {
          ...d,
          votes: d.votes.map(v => v.name === participantName ? { ...v, status: newStatus } : v)
        };
      }
      return d;
    });
    setMeeting({ ...meeting, deliberacoes: updatedDelibs });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 leading-tight">
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 mb-4">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
            <CheckCircle2 className="text-white" size={24} />
          </div>
          <span className="font-bold text-white text-xl tracking-tight uppercase tracking-widest">GovCorp</span>
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
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest italic tracking-widest">INEPAD Conselhos</span>
          <div className="flex items-center gap-6">
            <div className="text-right leading-tight">
              <p className="font-bold text-slate-800 text-sm">Ricardo Oliveira</p>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider tracking-widest">Secretário Geral</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-600 text-xs">RO</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
          {activeMenu === 'reunioes' && meetingView === 'details' && (
            <div className="animate-in fade-in duration-500 pb-20">
              <button onClick={() => setMeetingView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-sm font-bold mb-6">
                <ChevronRight className="rotate-180" size={18} /> Voltar para a lista
              </button>
              
              <div className="flex items-center gap-3 mb-8">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">{meeting.title}</h1>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded uppercase tracking-wider tracking-widest">{meeting.status}</span>
              </div>

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

              {activeMeetingTab === 'delib' && (
                <div className="space-y-8 animate-in fade-in max-w-6xl">
                  {/* Formulário de Nova Deliberação */}
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                      <Plus size={18} className="text-blue-600" /> Nova Deliberação
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <input type="text" placeholder="Título da Deliberação" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" value={newDelib.title} onChange={e => setNewDelib({...newDelib, title: e.target.value})} />
                        <textarea placeholder="Descrição curta do item a ser decidido..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[100px]" value={newDelib.description} onChange={e => setNewDelib({...newDelib, description: e.target.value})} />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest tracking-widest">Vincular Materiais</label>
                        <div className="flex flex-wrap gap-2">
                          {meeting.materiais.map(m => (
                            <button key={m.id} onClick={() => {
                              const selected = newDelib.selectedMaterials.includes(m.name) 
                                ? newDelib.selectedMaterials.filter(name => name !== m.name)
                                : [...newDelib.selectedMaterials, m.name];
                              setNewDelib({...newDelib, selectedMaterials: selected});
                            }} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${newDelib.selectedMaterials.includes(m.name) ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-blue-200'}`}>
                              {m.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button onClick={handleAddDeliberation} disabled={!newDelib.title} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50">
                      Criar Item para Votação
                    </button>
                  </div>

                  {/* Lista de Deliberações e Votação */}
                  <div className="space-y-6">
                    {meeting.deliberacoes.map(delib => (
                      <div key={delib.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-slate-50">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="text-lg font-black text-slate-800">{delib.title}</h4>
                              <p className="text-sm text-slate-500 mt-1">{delib.description}</p>
                            </div>
                            <div className="flex gap-2">
                              {delib.linkedMaterials.map((m, idx) => (
                                <span key={idx} className="flex items-center gap-1 px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-bold rounded-full border border-slate-100">
                                  <FileText size={12} /> {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-slate-50/50 p-8">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Painel de Votação Individual</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {delib.votes.map((v, idx) => (
                              <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-blue-600 uppercase">{v.name.substring(0,2)}</div>
                                  <span className="font-bold text-slate-700 text-sm truncate">{v.name}</span>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => handleVote(delib.id, v.name, 'Aprovado')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${v.status === 'Aprovado' ? 'bg-green-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-green-50'}`}>Aprovar</button>
                                  <button onClick={() => handleVote(delib.id, v.name, 'Reprovado')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${v.status === 'Reprovado' ? 'bg-red-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-red-50'}`}>Reprovar</button>
                                  <button onClick={() => handleVote(delib.id, v.name, 'Com Ressalvas')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${v.status === 'Com Ressalvas' ? 'bg-amber-500 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-amber-50'}`}>Ressalva</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Outras abas (simplificadas para evitar crash) */}
              {!['delib'].includes(activeMeetingTab) && (
                <div className="p-20 text-center bg-white rounded-3xl border border-slate-100">Aba em desenvolvimento.</div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
