import React, { useState } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, 
  Plus, ChevronRight, Mail, UserPlus, Clock, MapPin, 
  CheckCircle2, AlertCircle, FileText, Send, Award, X,
  BarChart3
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const App = () => {
  // Estados de Navegação
  const [activeMenu, setActiveMenu] = useState('dashboard'); // dashboard, reunioes, configuracoes
  const [meetingView, setMeetingView] = useState('list'); // list, details
  const [activeMeetingTab, setActiveMeetingTab] = useState('info');

  // Dados do Dashboard
  const barData = [
    { name: '2024-05-15', pauta: 3, acoes: 2 },
    { name: '2024-06-10', pauta: 1, acoes: 0 },
    { name: '2026-02-13', pauta: 0, acoes: 0 },
  ];

  const pieData = [
    { name: 'Concluídas', value: 1, color: '#10b981' },
    { name: 'Pendentes', value: 1, color: '#f59e0b' },
  ];

  // Dados da Reunião Atual
  const [meeting, setMeeting] = useState({
    title: 'Nova Reunião Estratégica',
    status: 'AGENDADA',
    date: '2026-02-13',
    time: '10:00',
    location: 'Sala Virtual / Presencial',
    participants: [] as string[]
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900">
      {/* SIDEBAR LATERAL */}
      <aside className="w-64 bg-[#1e1b4b] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-6 flex items-center gap-3 mb-4">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-lg">
            <CheckCircle2 className="text-white" size={24} />
          </div>
          <span className="font-bold text-white text-xl tracking-tight">GovCorp</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => setActiveMenu('dashboard')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-indigo-900/50'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button 
            onClick={() => { setActiveMenu('reunioes'); setMeetingView('list'); }} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'reunioes' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-indigo-900/50'}`}
          >
            <Calendar size={20} /> Reuniões
          </button>
          <button 
            onClick={() => setActiveMenu('configuracoes')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'configuracoes' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-indigo-900/50'}`}
          >
            <Settings size={20} /> Configurações
          </button>
        </nav>

        <div className="p-6 mt-auto">
          <button className="flex items-center gap-3 text-sm font-semibold hover:text-white transition-colors">
            <LogOut size={20} /> Sair
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* HEADER SUPERIOR */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Buscar reuniões, atas ou decisões..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
          </div>
          <div className="flex items-center gap-6">
            <Bell className="text-slate-400 cursor-pointer" size={22} />
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200 text-right leading-tight">
              <div>
                <p className="font-bold text-slate-800 text-sm">Ricardo Oliveira</p>
                <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Secretário Geral</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden">
                <img src="https://ui-avatars.com/api/?name=Ricardo+Oliveira&background=10b981&color=fff" alt="Perfil" />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
          
          {/* VISÃO 1: DASHBOARD */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <LayoutDashboard className="text-indigo-600" size={24} /> Dashboard de Governança
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Ações Concluídas', value: '1/2', icon: <CheckCircle2 size={20}/>, color: 'indigo' },
                  { label: 'Deliberações Aprovadas', value: '2/2', icon: <Clock size={20}/>, color: 'amber' },
                  { label: 'ATAs Registradas', value: '1', icon: <FileText size={20}/>, color: 'emerald' },
                  { label: 'Ações Atrasadas', value: '0', icon: <AlertCircle size={20}/>, color: 'red' },
                ].map((card, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className={`p-3 rounded-xl bg-${card.color}-50 text-${card.color}-600`}>{card.icon}</div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</p>
                      <p className="text-2xl font-black text-slate-800">{card.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm h-80 flex flex-col">
                  <h3 className="font-bold text-slate-800 mb-6 uppercase text-xs tracking-widest">Status das Ações do Conselho</h3>
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm h-80 flex flex-col">
                  <h3 className="font-bold text-slate-800 mb-6 uppercase text-xs tracking-widest">Decisões por Reunião</h3>
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                        <Tooltip cursor={{fill: '#f8fafc'}} />
                        <Legend />
                        <Bar dataKey="pauta" name="Itens de Pauta" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="acoes" name="Planos de Ação" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VISÃO 2: LISTAGEM DE REUNIÕES */}
          {activeMenu === 'reunioes' && meetingView === 'list' && (
            <div className="space-y-8 animate-in slide-in-from-right duration-500">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">Gerenciamento de Reuniões</h1>
                  <p className="text-slate-500 text-sm mt-1">Controle convocações, pautas e registros oficiais.</p>
                </div>
                <button 
                  onClick={() => setMeetingView('details')}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all"
                >
                  <Plus size={18} /> Nova Reunião
                </button>
              </div>

              <div className="space-y-4">
                {[
                  { title: 'Nova Reunião Estratégica', date: '2026-02-13', time: '10:00', loc: 'Sala Virtual / Presencial', status: 'AGENDADA', color: 'indigo', parts: 0, actions: 0 },
                  { title: 'Reunião Ordinária do Conselho - Q1', date: '2024-05-15', time: '09:00', loc: 'Sala de Conferências A / Zoom', status: 'CONCLUÍDA', color: 'emerald', parts: 4, actions: 2 },
                  { title: 'Comitê de Auditoria e Riscos', date: '2024-06-10', time: '14:30', loc: 'Híbrida', status: 'AGENDADA', color: 'indigo', parts: 2, actions: 0 },
                ].map((item, i) => (
                  <div key={i} onClick={() => setMeetingView('details')} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Calendar size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-bold text-slate-800">{item.title}</h3>
                          <span className={`px-2 py-0.5 bg-${item.color}-50 text-${item.color}-600 text-[9px] font-black rounded uppercase tracking-wider`}>{item.status}</span>
                        </div>
                        <div className="flex gap-4 text-[11px] text-slate-400 font-medium">
                          <span className="flex items-center gap-1"><Calendar size={13}/> {item.date}</span>
                          <span className="flex items-center gap-1"><Clock size={13}/> {item.time}</span>
                          <span className="flex items-center gap-1"><MapPin size={13}/> {item.loc}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-8 text-center px-10 border-l border-slate-50">
                      <div><p className="text-lg font-black text-slate-700 leading-none">{item.parts}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Participantes</p></div>
                      <div><p className="text-lg font-black text-slate-700 leading-none">{item.actions}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Ações</p></div>
                      <ChevronRight className="text-slate-300 ml-4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VISÃO 3: DETALHES DA REUNIÃO */}
          {activeMenu === 'reunioes' && meetingView === 'details' && (
            <div className="animate-in slide-in-from-bottom duration-500">
              <button onClick={() => setMeetingView('list')} className="text-slate-400 hover:text-indigo-600 flex items-center gap-1 text-sm font-bold mb-6 transition-colors">
                <ChevronRight className="rotate-180" size={20} /> Voltar para Reuniões
              </button>
              
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">{meeting.title}</h1>
                <span className="px-3 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded uppercase tracking-wider">{meeting.status}</span>
              </div>
              <div className="flex gap-4 text-[11px] text-slate-400 font-medium mb-8">
                <span className="flex items-center gap-1"><Calendar size={14}/> {meeting.date} às {meeting.time}</span>
                <span className="flex items-center gap-1"><MapPin size={14}/> {meeting.location}</span>
              </div>

              {/* TABS DE DETALHES */}
              <div className="border-b border-slate-200 flex gap-10 mb-8 overflow-x-auto scrollbar-hide">
                {['Informações e Convites', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Planos de Ação', 'ATAs'].map((tab, i) => {
                  const id = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i];
                  return (
                    <button key={id} onClick={() => setActiveMeetingTab(id)} className={`pb-4 text-xs font-bold transition-all relative whitespace-nowrap ${activeMeetingTab === id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                      {tab}
                      {activeMeetingTab === id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600"></div>}
                    </button>
                  );
                })}
              </div>

              {/* CONTEÚDO DA ABA SELECIONADA */}
              {activeMeetingTab === 'info' && (
                <div className="space-y-6 max-w-5xl">
                  {/* Card Convocação */}
                  <div className="bg-[#eff2ff] p-6 rounded-2xl border border-indigo-100">
                    <h3 className="text-indigo-900 font-bold text-sm flex items-center gap-2 mb-2">
                      <Send size={16} /> Convocação e Invites
                    </h3>
                    <p className="text-indigo-800/70 text-[11px] mb-5 max-w-2xl">
                      Envie a convocação formal para todos os conselheiros e diretores. O link da reunião e os materiais da pauta serão anexados automaticamente.
                    </p>
                    <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700">
                      Enviar Convocações por E-mail
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Lista Participantes */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-h-[250px] flex flex-col">
                      <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest mb-6 flex items-center gap-2 italic">
                        <UserPlus size={16} className="text-slate-400" /> Lista de Participantes
                      </h3>
                      <div className="space-y-3 mb-6 flex-1">
                        {meeting.participants.map((p, i) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-sm border border-slate-100">
                            <span className="font-semibold text-slate-700 italic">{p}</span>
                            <X size={14} className="text-slate-300 cursor-pointer hover:text-red-500" onClick={() => setMeeting({...meeting, participants: meeting.participants.filter((_, idx) => idx !== i)})} />
                          </div>
                        ))}
                      </div>
                      <button 
                        onClick={() => { const n = prompt('Nome:'); if(n) setMeeting({...meeting, participants: [...meeting.participants, n]}) }}
                        className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-slate-300 font-bold text-[10px] uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-400 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus size={14} /> Adicionar Convidado
                      </button>
                    </div>

                    {/* Detalhes Logísticos */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
                      <h3 className="text-slate-800 font-bold text-xs uppercase tracking-widest mb-8 flex items-center gap-2 italic">
                        <Clock size={16} className="text-slate-400" /> Detalhes Logísticos
                      </h3>
                      <div className="space-y-6 flex-1">
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
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 italic">Alterar Status</label>
                           <select 
                             value={meeting.status} 
                             onChange={e => setMeeting({...meeting, status: e.target.value})}
                             className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                           >
                             <option value="AGENDADA">Agendada</option>
                             <option value="EM ANDAMENTO">Em Andamento</option>
                             <option value="CONCLUÍDA">Concluída</option>
                             <option value="CANCELADA">Cancelada</option>
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
                   <h3 className="text-slate-300 font-bold uppercase tracking-widest text-sm">Aba em Desenvolvimento</h3>
                </div>
              )}
            </div>
          )}
        </div>
