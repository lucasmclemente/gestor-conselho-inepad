import React, { useState } from 'react';
import { 
  LayoutDashboard, FileText, CheckCircle, Clock, AlertCircle, 
  Calendar, Users, ClipboardList, Plus, Save, Award, User, Layers
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Interface para o Dashboard e Abas
  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans">
      {/* Sidebar Lateral */}
      <aside className="w-72 bg-[#0f172a] text-slate-300 flex flex-col shadow-xl">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800">
          <Award className="text-blue-400" size={28} />
          <span className="font-bold text-white text-lg tracking-tight">GovCorp INEPAD</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          
          <div className="pt-4 pb-2 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gestão de Reuniões</div>
          
          <button onClick={() => setActiveTab('convocacao')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'convocacao' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
            <Calendar size={18} /> Convocação e Pautas
          </button>
          
          <button onClick={() => setActiveTab('reuniao')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'reuniao' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
            <Layers size={18} /> Aba da Reunião
          </button>
          
          <button onClick={() => setActiveTab('acoes')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'acoes' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
            <ClipboardList size={18} /> Ações e Atas
          </button>
        </nav>

        <div className="p-6 border-t border-slate-800 bg-[#0a0f1d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-900/50 flex items-center justify-center border border-blue-500/30">
              <User size={20} className="text-blue-400" />
            </div>
            <div className="text-xs">
              <p className="font-bold text-white">Ricardo Oliveira</p>
              <p className="text-slate-500">Secretário Geral</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 italic uppercase">
            {activeTab === 'dashboard' && 'Dashboard de Governança'}
            {activeTab === 'convocacao' && 'Convocação de Reunião'}
            {activeTab === 'reuniao' && 'Painel de Deliberações'}
            {activeTab === 'acoes' && 'Planos de Ação e Atas'}
          </h2>
          <div className="flex gap-4 text-xs font-medium text-slate-500">
            <span>INEPAD Conselhos</span>
            <span>•</span>
            <span>{new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </header>

        <div className="p-10 max-w-6xl mx-auto">
          
          {/* ABA 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-4">
                    <div className="p-3 bg-green-50 rounded-xl text-green-600"><CheckCircle size={24}/></div>
                    <span className="text-3xl font-black text-slate-800">2/2</span>
                  </div>
                  <p className="text-sm font-bold text-slate-500 uppercase">Deliberações Aprovadas</p>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-4">
                    <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><FileText size={24}/></div>
                    <span className="text-3xl font-
