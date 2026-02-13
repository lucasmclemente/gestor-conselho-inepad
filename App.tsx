import React, { useState } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, 
  Plus, ChevronRight, Mail, UserPlus, Clock, MapPin, 
  CheckCircle2, AlertCircle, FileText, BarChart3, PieChart as PieChartIcon,
  Upload, Download, Save, Layers
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const App = () => {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [view, setView] = useState('list'); 
  const [activeMeetingTab, setActiveMeetingTab] = useState('info');

  // Dados para os gráficos do Dashboard
  const barData = [
    { name: 'Jan/26', pauta: 4, acoes: 3 },
    { name: 'Fev/26', pauta: 2, acoes: 1 },
  ];

  const pieData = [
    { name: 'Concluídas', value: 3, color: '#10b981' },
    { name: 'Em Andamento', value: 2, color: '#6366f1' },
    { name: 'Atrasadas', value: 0, color: '#ef4444' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900">
      {/* Sidebar Lateral - Identidade INEPAD */}
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 mb-4">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
            <CheckCircle2 className="text-white" size={24} />
          </div>
          <span className="font-bold text-white text-xl tracking-tight">GovCorp</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => {setActiveMenu('dashboard'); setView('list');}}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          
          <button 
            onClick={() => {setActiveMenu('reunioes'); setView('list');}}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Calendar size={20} /> Reuniões
          </button>
          
          <button 
            onClick={() => setActiveMenu('configuracoes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'configuracoes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Settings size={20} /> Configurações
          </button>
        </nav>

        <div className="p-6 mt-auto border-t border-slate-800">
          <button className="flex items-center gap-3 text-sm font-semibold text-slate-500 hover:text-white transition-colors">
            <LogOut size={20} /> Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Superior */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">INEPAD Conselhos</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200 text-right leading-tight">
              <div>
                <p className="font-bold text-slate-800 text-sm">Consultor Inepad</p>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider text-center">Secretário Geral</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-blue-600">
                CI
              </div>
            </div>
          </div>
        </header>

        {/* Área de Conteúdo */}
        <div className="flex-1 overflow-y-auto p-10">
          
          {/* TELA: DASHBOARD */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Painel de Controle</h1>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Total de Reuniões', value: '12', icon: <Calendar size={20}/>, color: 'blue' },
                  { label: 'Deliberações', value: '28', icon: <CheckCircle2 size={20}/>, color: 'green' },
                  { label: 'Ações Pendentes', value: '5', icon: <Clock size={20}/>, color: 'amber' },
                  { label: 'Atas Registradas', value: '11', icon: <FileText size={20}/>, color: 'blue' },
                ].map((card, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className={`w-10 h-10 rounded-xl bg-${card.color}-50 text-${card.color}-600 flex items-center justify-center mb-4`}>
                      {card.icon}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</p>
                    <p className="text-2xl font-black text-slate-800">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-8 uppercase text-xs tracking-widest">Status das Ações</h3>
                  <div className="h-64">
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

                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-8 uppercase text-xs tracking-widest">Atividade Recente</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                        <Tooltip cursor={{fill: '#f8fafc'}} />
                        <Bar dataKey="pauta" name="Itens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="acoes" name="Ações" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TELA: LISTA DE REUNIÕES */}
          {activeMenu === 'reunioes' && view === 'list' && (
            <div className="space-y-8 animate-in slide-in-from-right duration-500">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">Histórico de Reuniões</h1>
                  <p className="text-slate-500 text-sm">Gerencie o calendário e documentos do conselho.</p>
                </div>
                <button 
                  onClick={() => setView('details')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
                >
                  <Plus size={18} /> Nova Reunião
                </button>
              </div>

              <div className="space-y-4">
                {[
                  { title: 'Reunião Estratégica Mensal', date: '15/02/2026', time: '14:00', status: 'AGENDADA', color: 'blue' },
                  { title: 'Conselho de Administração - Q4', date: '20/01/2026', time: '09:00', status: 'CONCLUÍDA', color: 'green' },
                ].map((item, i) => (
                  <div key={i} onClick={() => setView('details')} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="p-4 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Calendar size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{item.title}</h3>
                        <div className="flex gap-4 text-xs text-slate-400 font-medium mt-1">
                          <span className="flex items-center gap-1"><Clock size={14}/> {item.date} às {item.time}</span>
                          <span className={`font-bold text-${item.color}-600 uppercase`}>{item.status}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="text-slate-300" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TELA: DETALHES DA REUNIÃO */}
          {activeMenu === 'reunioes' && view === 'details' && (
            <div className="animate-in slide-in-from-bottom duration-500">
              <button onClick={() => setView('list')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-sm font-bold mb-6 transition-colors">
                <ChevronRight className="rotate-180" size={18} /> Voltar para a lista
              </button>
              
              <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Configurar Nova Reunião</h1>
              </div>

              {/* Navegação das Abas Internas */}
              <div className="border-b border-slate-200 flex gap-8 mb-10 overflow-x-auto scrollbar-hide">
                {[
                  { id: 'info', label: 'Informações e Convites' },
                  { id: 'pauta', label: 'Ordem do Dia' },
                  { id: 'materiais', label: 'Materiais' },
                  { id: 'delib', label: 'Deliberações' },
                  { id: 'acoes', label: 'Planos de Ação' },
                  { id: 'atas', label: 'Atas' },
                ].map((tab) => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveMeetingTab(tab.id)}
                    className={`pb-4 text-sm font-bold transition-all relative whitespace-nowrap ${activeMeetingTab === tab.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {tab.label}
                    {activeMeetingTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full"></div>}
                  </button>
                ))}
              </div>

              {/* Conteúdo das Abas Internas */}
              <div className="max-w-4xl">
                {activeMeetingTab === 'info' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                      <h3 className="font-bold text-slate-800 uppercase text-[10px] tracking-widest mb-4">Dados Básicos</h3>
                      <input type="text" placeholder="Título da Reunião" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                      <input type="datetime-local" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                      <input type="text" placeholder="Local ou Link" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                      <h3 className="font-bold text-slate-800 uppercase text-[10px] tracking-widest mb-6">Participantes</h3>
                      <button className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-slate-300 font-bold text-[10px] uppercase tracking-widest hover:border-blue-200 hover:text-blue-400 transition-all">
                        + Adicionar Participante
                      </button>
                    </div>
                  </div>
                )}
                
                {activeMeetingTab === 'pauta' && (
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 uppercase text-[10px] tracking-widest tracking-widest">Tópicos da Reunião</h3>
                    <textarea 
                      placeholder="Liste as pautas na ordem de discussão..." 
                      className="w-full h-64 p-6 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm leading-relaxed"
                    />
                  </div>
                )}

                {['materiais', 'delib', 'acoes', 'atas'].includes(activeMeetingTab) && (
                  <div className="bg-white p-20 rounded-3xl border border-slate-100 shadow-sm text-center">
                    <Upload className="mx-auto mb-4 text-slate-200" size={48} />
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Repositório de Documentos</p>
                    <p className="text-slate-300 text-xs mt-2">Clique para anexar arquivos relevantes a esta reunião.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TELA: CONFIGURAÇÕES */}
          {activeMenu === 'configuracoes' && (
            <div className="animate-in fade-in duration-500 text-center py-20">
              <Settings className="mx-auto text-slate-200 mb-4" size={64} />
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Configurações do Sistema</h1>
              <p className="text-slate-400 mt-2">Gerencie usuários, permissões e logotipos da INEPAD.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
