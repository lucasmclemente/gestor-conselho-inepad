import React, { useState, useRef } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, 
  Plus, ChevronRight, Mail, UserPlus, Clock, MapPin, 
  CheckCircle2, AlertCircle, FileText, Send, Award, X, Trash2,
  Link as LinkIcon, Map, GripVertical, ClipboardList, User, Upload, File,
  Check, ShieldAlert, Info, Users, MessageSquare
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const App = () => {
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
      { name: 'Consultor Inepad', email: 'consultoria@inepad.com.br' },
      { name: 'Convidado Especial', email: 'convidado@empresa.com.br' }
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
    selectedVoters: [] as string[] // Novos votantes selecionados
  });

  // --- FUNÇÕES ---
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
          justification: '' // Campo para a ressalva
        }))
      };
      setMeeting({ ...meeting, deliberacoes: [...meeting.deliberacoes, delib] });
      setNewDelib({ title: '', description: '', selectedMaterials: [], selectedVoters: [] });
    }
  };

  const handleVote = (delibId: number, name: string, status: string, justification?: string) => {
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

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 leading-tight">
      {/* Sidebar */}
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
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest italic">INEPAD Governança</span>
          <div className="flex items-center gap-6">
            <div className="text-right leading-tight"><p className="font-bold text-slate-800 text-sm italic">Ricardo Oliveira</p><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Secretário Geral</p></div>
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-600 text-xs">RO</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
          {activeMenu === 'reunioes' && meetingView === 'details' && (
            <div className="animate-in fade-in duration-500 pb-20">
              <button onClick={() => setMeetingView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-sm font-bold mb-6 transition-all"><ChevronRight className="rotate-180" size={18} /> Voltar</button>
              
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-black text-slate-800 tracking-tight">{meeting.title}</h1>
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

              {/* ABA DELIBERAÇÕES ATUALIZADA */}
              {activeMeetingTab === 'delib' && (
                <div className="space-y-8 animate-in fade-in max-w-6xl">
                  {/* Card: Criar Deliberação */}
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest flex items-center gap-2"><Plus size={18} className="text-blue-600" /> Configurar Deliberação</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <input type="text" placeholder="Assunto da Decisão" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none" value={newDelib.title} onChange={e => setNewDelib({...newDelib, title: e.target.value})} />
                        <textarea placeholder="Contexto ou justificativa para a votação..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm min-h-[100px] outline-none" value={newDelib.description} onChange={e => setNewDelib({...newDelib, description: e.target.value})} />
                      </div>
                      
                      <div className="space-y-6">
                        {/* Seleção de Votantes */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Quem deve votar nesta pauta?</label>
                          <div className="flex flex-wrap gap-2">
                            {meeting.participants.map((p, idx) => (
                              <button key={idx} onClick={() => setNewDelib({...newDelib, selectedVoters: newDelib.selectedVoters.includes(p.name) ? newDelib.selectedVoters.filter(v => v !== p.name) : [...newDelib.selectedVoters, p.name]})} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${newDelib.selectedVoters.includes(p.name) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-100'}`}>
                                {p.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Materiais Vinculados */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3 italic">Materiais Vinculados</label>
                          <div className="flex flex-wrap gap-2">
                            {meeting.materiais.map(m => (
                              <button key={m.id} onClick={() => setNewDelib({...newDelib, selectedMaterials: newDelib.selectedMaterials.includes(m.name) ? newDelib.selectedMaterials.filter(x => x !== m.name) : [...newDelib.selectedMaterials, m.name]})} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border ${newDelib.selectedMaterials.includes(m.name) ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-300 border-slate-50'}`}>
                                {m.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button onClick={handleAddDeliberation} disabled={!newDelib.title || newDelib.selectedVoters.length === 0} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50">Habilitar Votação</button>
                  </div>

                  {/* Lista de Deliberações */}
                  <div className="space-y-8">
                    {meeting.deliberacoes.map(delib => (
                      <div key={delib.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-start">
                          <div><h4 className="text-lg font-black text-slate-800">{delib.title}</h4><p className="text-sm text-slate-500 mt-1 italic leading-relaxed">{delib.description}</p></div>
                          <div className="flex gap-2">{delib.linkedMaterials.map((m: any, i: number) => <span key={i} className="text-[10px] font-bold text-blue-400 bg-blue-50 px-2 py-1 rounded-md"># {m}</span>)}</div>
                        </div>
                        
                        <div className="bg-slate-50/50 p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                          {delib.votes.map((v: any, idx: number) => (
                            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center font-bold text-[10px] text-blue-600 uppercase italic">{v.name.substring(0,2)}</div>
                                <span className="font-bold text-slate-700 text-sm italic">{v.name}</span>
                              </div>
                              <div className="flex gap-2">
                                {['Aprovado', 'Reprovado', 'Com Ressalvas'].map(st => (
                                  <button key={st} onClick={() => handleVote(delib.id, v.name, st)} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${v.status === st ? (st === 'Aprovado' ? 'bg-green-600 text-white' : st === 'Reprovado' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white') : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{st.split(' ')[0]}</button>
                                ))}
                              </div>
                              {/* Campo de Justificativa para Ressalvas */}
                              {v.status === 'Com Ressalvas' && (
                                <div className="animate-in slide-in-from-top-2 duration-300">
                                  <label className="text-[9px] font-bold text-amber-600 uppercase tracking-widest block mb-2 flex items-center gap-1"><MessageSquare size={12}/> Justificativa da Ressalva</label>
                                  <textarea className="w-full p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs font-medium text-amber-900 outline-none" placeholder="Descreva aqui os pontos de atenção..." value={v.justification} onChange={e => handleVote(delib.id, v.name, v.status, e.target.value)} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* PLACEHOLDERS PARA MANTER AS OUTRAS ABAS VIVAS */}
              {activeMeetingTab === 'info' && <div className="p-20 text-center bg-white rounded-3xl border border-slate-100 italic text-slate-400">Aba Informações integrada.</div>}
              {activeMeetingTab === 'pauta' && <div className="p-20 text-center bg-white rounded-3xl border border-slate-100 italic text-slate-400">Aba Ordem do Dia integrada.</div>}
              {activeMeetingTab === 'materiais' && <div className="p-20 text-center bg-white rounded-3xl border border-slate-100 italic text-slate-400">Aba Materiais integrada.</div>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
