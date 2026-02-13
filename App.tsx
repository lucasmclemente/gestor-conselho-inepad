import React, { useState } from 'react';
import { 
  LayoutDashboard, Calendar, Settings, LogOut, Search, Bell, 
  Plus, ChevronRight, Mail, UserPlus, Clock, MapPin, 
  CheckCircle2, AlertCircle, FileText, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const App = () => {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [view, setView] = useState('list'); // 'list' ou 'details'
  const [activeMeetingTab, setActiveMeetingTab] = useState('info');

  // Dados fictícios para os gráficos do Dashboard
  const barData = [
    { name: '2024-05-15', pauta: 3, acoes: 2 },
    { name: '2024-06-10', pauta: 1, acoes: 0 },
    { name: '2026-02-13', pauta: 0, acoes: 0 },
  ];

  const pieData = [
    { name: 'Concluídas', value: 1, color: '#10b981' },
    { name: 'Pendentes', value: 1, color: '#f59e0b' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900">
      {/* Sidebar Lateral */}
      <aside className="w-64 bg-[#1e1b4b] text-slate-300 flex flex-col shadow-2xl">
        <div className="p-6 flex items-center gap-3 mb-4">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-lg">
            <CheckCircle2 className="text-white" size={24} />
          </div>
          <span className="font-bold text-white text-xl tracking-tight">GovCorp</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => {setActiveMenu('dashboard'); setView('list');}}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-indigo-900/50 hover:text-white'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          
          <button 
            onClick={() => setActiveMenu('reunioes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'reunioes' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-indigo-900/50 hover:text-white'}`}
          >
            <Calendar size={20} /> Reuniões
          </button>
          
          <button 
            onClick={() => setActiveMenu('configuracoes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeMenu === 'configuracoes' ? 'bg-indigo-900/50 text-slate-400' : 'hover:bg-indigo-900/50 hover:text-white'}`}
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

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Superior */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar reuniões, atas ou decisões..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div className="flex items-center gap-6">
            <button className="relative p-2 text-slate-400 hover:text-indigo-600 transition-colors">
              <Bell size={22} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
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

        {/* Área de Scroll do Conteúdo */}
        <div className="flex-1 overflow-y-auto p-10 bg-white/50">
          
          {/* VISÃO: DASHBOARD */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in duration-500">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <LayoutDashboard className="text-indigo-600" size={28} /> Dashboard de Governança
              </h1>
              
              {/* Cards de Métricas */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Ações Concluídas', value: '1/2', icon: <CheckCircle2 size={22}/>, color: 'indigo' },
                  { label: 'Deliberações Aprovadas', value: '2/2', icon: <Clock size={22}/>, color: 'amber' },
                  { label: 'ATAs Registradas', value: '1', icon: <FileText size={22}/>, color: 'emerald' },
                  { label: 'Ações Atrasadas', value: '0', icon: <AlertCircle size={22}/>, color: 'red' },
                ].map((card, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className={`p-3 rounded-xl bg-${card.color}-50 text-${card.color}-600`}>{card.icon}</div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</p>
                      <p className="text-2xl font-black text-slate-800">{card.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-2 uppercase text-xs tracking-widest">Status das Ações do Conselho</h3>
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
                  <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-2 uppercase text-xs tracking-widest">Decisões por Reunião</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
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

          {/* VISÃO: REUNIÕES */}
          {activeMenu === 'reunioes' && view === 'list' && (
            <div className="space-y-8 animate-in slide-in-from-right duration-500">
              <div className="flex justify
