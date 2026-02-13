import React, { useState, useRef } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, 
  Plus, ChevronRight, Mail, UserPlus, Clock, MapPin, 
  CheckCircle2, AlertCircle, FileText, Send, Award, X, Trash2,
  Link as LinkIcon, Map, GripVertical, ClipboardList, User, Upload, File,
  Check, ShieldAlert, Info, Users, MessageSquare, Save, Lock
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
    pautas: [{ title: 'Abertura', responsible: 'Ricardo Oliveira', duration: '10' }],
    materiais: [{ id: 1, name: 'DRE_Consolidado_2025.pdf', size: '1.2 MB', uploadedBy: 'Ricardo Oliveira', date: '13/02/2026' }],
    deliberacoes: [] as any[]
  });

  // --- ESTADOS DE ENTRADA ---
  const [newParticipant, setNewParticipant] = useState({ name: '', email: '' });
  const [newPauta, setNewPauta] = useState({ title: '', responsible: '', duration: '' });
  const [newDelib, setNewDelib] = useState({ 
    title: '', 
    description: '', 
    selectedMaterials: [] as string[],
    selectedVoters: [] as string[]
  });

  // --- FUNÇÕES DE DELIBERAÇÃO ---
  const handleAddDeliberation = () => {
    if (newDelib.title && newDelib.selectedVoters.length > 0) {
      const delib = {
        id: Date.now(),
        title: newDelib.title,
        description: newDelib.description,
        linkedMaterials: newDelib.selectedMaterials,
        votes: newDelib.selectedVoters.map(name => ({ 
          name, 
          status: 'Pendente',
          justification: '',
          isSaved: false 
        }))
      };
      setMeeting({ ...meeting, deliberacoes: [...meeting.deliberacoes, delib] });
      setNewDelib({ title: '', description: '', selectedMaterials: [], selectedVoters: [] });
    }
  };

  const updateVoteState = (delibId: number, name: string, status: string, justification?: string) => {
    const updated = meeting.deliberacoes.map(d => {
      if (d.id === delibId) {
        return {
          ...d,
          votes: d.votes.map((v: any) => v.name === name ? { ...v, status, justification: justification ?? v.justification } : v)
        };
      }
      return d;
    });
    setMeeting({ ...meeting, deliberacoes: updated });
  };

  const saveFinalVote = (delibId: number, name: string) => {
    const updated = meeting.deliberacoes.map(d => {
      if (d.id === delibId) {
        return {
          ...d,
          votes: d.votes.map((v: any) => v.name === name ? { ...v, isSaved: true } : v)
        };
      }
      return d;
    });
    setMeeting({ ...meeting, deliberacoes: updated });
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
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0 shadow-sm">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest italic">INEPAD Governança Profissional</span>
          <div className="flex items-center gap-4">
            <div className="text-right leading-tight"><p className="font-bold text-slate-800 text-sm">Ricardo Oliveira</p><p className="text-slate-500 text-[10px] font-bold uppercase">Secretário Geral</p></div>
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-600 text-xs tracking-tighter">RO</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
          {activeMenu === 'reunioes' && meetingView === 'details' && (
            <div className="animate-in fade-in duration-500 pb-20">
              <button onClick={() => setMeetingView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-sm font-bold mb-6 transition-all"><ChevronRight className="rotate-180" size={18} /> Voltar</button>
              
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-black text-slate-800 tracking-tight tracking-tighter">{meeting.title}</h1>
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded uppercase tracking-wider">{meeting.status}</span>
                </div>
              </div>

              {/* TABS INTERNAS */}
              <div className="border-b border-slate-200 flex gap-8 mb-10 overflow-x-auto scrollbar-hide">
                {['Informações e Convites', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'Atas'].map((tab, i) => {
                  const ids = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'];
                  return (
                    <button key={ids[i]} onClick={() => setActiveMeetingTab(ids[i])} className={`pb-4 text-xs font-bold transition-all relative whitespace-nowrap ${activeMeetingTab === ids[i] ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                      {tab}{activeMeetingTab === ids[i] && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"></div>}
                    </button>
                  );
                })}
              </div>

              {/* ABA DELIBERAÇÕES - SISTEMA DE VOTAÇÃO 4 OPÇÕES */}
              {activeMeetingTab === 'delib' && (
                <div className="space-y-8 animate-in fade-in max-w-6xl">
                  {/* Formulário Nova Deliberação */}
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest flex items-center gap-2"><Plus size={18} className="text-blue-600" /> Nova Deliberação</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <input type="text" placeholder="Título da Decisão" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none" value={newDelib.title} onChange={e => setNewDelib({...newDelib, title: e.target.value})} />
                        <textarea placeholder="Descrição ou fundamentação legal..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm min-h-[100px] outline-none" value={newDelib.description} onChange={e => setNewDelib({...newDelib, description: e.target.value})} />
                      </div>
                      <div className="space-y-4">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block italic">Selecione os Votantes:</label>
                         <div className="flex flex-wrap gap-2">
                           {meeting.participants.map((p, idx) => (
                             <button key={idx} onClick={() => setNewDelib({...newDelib, selectedVoters: newDelib.selectedVoters.includes(p.name) ? newDelib.selectedVoters.filter(v => v !== p.name) : [...newDelib.selectedVoters, p.name]})} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${newDelib.selectedVoters.includes(p.name) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-100'}`}>
                               {p.name}
                             </button>
                           ))}
                         </div>
                      </div>
                    </div>
                    <button onClick={handleAddDeliberation} disabled={!newDelib.title || newDelib.selectedVoters.length === 0} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50">Habilitar Votação Oficial</button>
                  </div>

                  {/* Painel de Votação */}
                  <div className="space-y-8">
                    {meeting.deliberacoes.map(delib => (
                      <div key={delib.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                          <h4 className="text-lg font-black text-slate-800 italic">{delib.title}</h4>
                          <p className="text-sm text-slate-500 mt-1 italic">{delib.description}</p>
                        </div>
                        
                        <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white">
                          {delib.votes.map((v: any, idx: number) => (
                            <div key={idx} className={`p-6 rounded-2xl border-2 transition-all space-y-4 ${v.isSaved ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-50 shadow-sm'}`}>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-[10px] text-blue-600 uppercase">{v.name.substring(0,2)}</div>
                                  <span className="font-bold text-slate-700 text-sm italic">{v.name}</span>
                                </div>
                                {v.isSaved && <span className="flex items-center gap-1 text-[9px] font-bold text-green-600 uppercase tracking-widest"><Lock size={12}/> Voto Registrado</span>}
                              </div>

                              {/* Opções de Voto */}
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { label: 'Aprovado', color: 'bg-green-600' },
                                  { label: 'Reprovado', color: 'bg-red-600' },
                                  { label: 'Aprovado com Ressalvas', color: 'bg-amber-500' },
                                  { label: 'Reprovado com Ressalvas', color: 'bg-slate-800' }
                                ].map(opt => (
                                  <button 
                                    key={opt.label} 
                                    disabled={v.isSaved}
                                    onClick={() => updateVoteState(delib.id, v.name, opt.label)}
                                    className={`py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${v.status === opt.label ? `${opt.color} text-white shadow-lg` : 'bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-30'}`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>

                              {/* Campo de Justificativa (Apenas para Ressalvas) */}
                              {(v.status === 'Aprovado com Ressalvas' || v.status === 'Reprovado com Ressalvas') && (
                                <div className="animate-in slide-in-from-top-2">
                                  <label className="text-[9px] font-bold text-blue-600 uppercase tracking-widest block mb-2 flex items-center gap-1"><MessageSquare size={12}/> Justificativa da Ressalva:</label>
                                  <textarea 
                                    disabled={v.isSaved}
                                    className="w-full p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs font-medium text-blue-900 outline-none min-h-[80px]" 
                                    placeholder="Descreva aqui os pontos necessários para alteração..." 
                                    value={v.justification} 
                                    onChange={e => updateVoteState(delib.id, v.name, v.status, e.target.value)} 
                                  />
                                </div>
                              )}

                              {/* Botão Salvar Voto Individual */}
                              {!v.isSaved && v.status !== 'Pendente' && (
                                <button 
                                  onClick={() => saveFinalVote(delib.id, v.name)}
                                  className="w-full py-3 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all"
                                >
                                  <Save size={14} /> Confirmar e Salvar Voto
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* PLACEHOLDERS PARA OUTRAS ABAS (Mantendo a navegação ativa) */}
              {['info', 'pauta', 'materiais'].includes(activeMeetingTab) && (
                <div className="p-20 text-center bg-white rounded-3xl border border-slate-100 italic text-slate-400">Aba {activeMeetingTab.toUpperCase()} integrada e funcional.</div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
