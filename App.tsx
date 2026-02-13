import React, { useState } from 'react';
import { 
  LayoutDashboard, FileText, CheckCircle, Clock, AlertCircle, 
  Calendar, Users, ClipboardList, Plus, Save, Award, User, Layers, Search
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans">
      {/* Sidebar Lateral - Estilo Corporativo */}
      <aside className="w-72 bg-[#0f172a] text-slate-300 flex flex-col shadow-xl">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800">
          <Award className="text-blue-400" size={28} />
          <span className="font-bold text-white text-lg tracking-tight">GovCorp INEPAD</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          
          <div className="pt-6 pb-2 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gestão de Reuniões</div>
          
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
            <div className="w-10 h-10 rounded-full bg-blue-900/50 flex items-center justify-center border border-blue-500/30 text-blue-400 font-bold">
              RO
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
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shadow-sm sticky top-0 z-10">
          <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tight">
            {activeTab === 'dashboard' && 'Dashboard de Governança'}
            {activeTab === 'convocacao' && 'Convocação e Ordem do Dia'}
            {activeTab === 'reuniao' && 'Painel de Deliberações'}
            {activeTab === 'acoes' && 'Gestão de Planos de Ação e Atas'}
          </h2>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50 px-4 py-2 rounded-full border border-slate-200">
            <span className="text-blue-600 font-bold">INEPAD Conselhos</span>
            <span className="text-slate-300">|</span>
            <span>{new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </header>

        <div className="p-10 max-w-6xl mx-auto">
          
          {/* ABA 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div className="p-3 bg-green-50 rounded-xl text-green-600"><CheckCircle size={24}/></div>
                    <span className="text-3xl font-black text-slate-800">2/2</span>
                  </div>
                  <p className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Deliberações Aprovadas</p>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><FileText size={24}/></div>
                    <span className="text-3xl font-black text-slate-800">1</span>
                  </div>
                  <p className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Atas Registradas</p>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
                  <div className="flex justify-between items-center mb-4 text-center">
                    <div className="p-3 bg-red-50 rounded-xl text-red-600"><Clock size={24}/></div>
                    <span className="text-3xl font-black text-slate-800">0</span>
                  </div>
                  <p className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Ações Atrasadas</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                <Search className="mx-auto mb-4 text-slate-200" size={48} />
                <h3 className="text-slate-800 font-bold mb-1">Acompanhamento de Decisões</h3>
                <p className="text-slate-400 text-sm">Não há decisões pendentes de acompanhamento no momento.</p>
              </div>
            </div>
          )}

          {/* ABA 2: CONVOCAÇÃO */}
          {activeTab === 'convocacao' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Data da Reunião</label>
                  <input type="date" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Local ou Link Digital</label>
                  <input type="text" placeholder="Ex: Matriz Agrária ou Google Meet" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Lista de Participantes (Conselheiros e Convidados)</label>
                <textarea rows={3} placeholder="Nomes e Cargos..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Ordem do Dia (Pautas Sugeridas)</label>
                <textarea rows={5} placeholder="1. Apresentação dos Resultados&#10;2. Planejamento Orçamentário" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
              </div>
              <button className="bg-blue-900 text-white px-8 py-4 rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg shadow-blue-900/20">
                <Save size={16} /> Salvar e Enviar Convocação
              </button>
            </div>
          )}

          {/* ABA 3: REUNIÃO / DELIBERAÇÕES */}
          {activeTab === 'reuniao' && (
            <div className="space-y-8">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-50">
                  <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Painel de Aprovações e Materiais</h3>
                  <button className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-[10px] font-bold flex items-center gap-2 hover:bg-slate-200">
                    <Plus size={14}/> Anexar Política/Orçamento
                  </button>
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="pb-4">Item para Deliberação</th>
                      <th className="pb-4 text-center">Categoria</th>
                      <th className="pb-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr className="border-b border-slate-50">
                      <td className="py-6 font-bold text-slate-700">Orçamento Agrária 2026</td>
                      <td className="py-6 text-center text-slate-500">Financeiro</td>
                      <td className="py-6 text-right">
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-bold">EM ANÁLISE</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-6 font-bold text-slate-700">Política de Sucessão Familiar</td>
                      <td className="py-6 text-center text-slate-500">Governança</td>
                      <td className="py-6 text-right">
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">APROVADO</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA 4: AÇÕES E ATAS */}
          {activeTab === 'acoes' && (
            <div className="space-y-8">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest mb-6 border-b border-slate-50 pb-4">Plano de Ação (Acompanhamento)</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-700 text-sm">Ajustar Balanço Patrimonial conforme reunião Jan/26</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Inepad | Prazo: 28/02/2026</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-bold text-yellow-600">EM ANDAMENTO</span>
                      <input type="checkbox" className="w-5 h-5 accent-blue-600 rounded" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 p-10 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                <FileText className="mx-auto mb-4 text-slate-300" size={40} />
                <h3 className="font-bold text-slate-800 text-sm mb-2">Repositório Oficial de Atas</h3>
                <p className="text-xs text-slate-400 mb-6 font-medium">Histórico de atas registradas e assinadas pelo Conselho.</p>
                <div className="inline-flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <div className="p-2 bg-red-50 text-red-500 rounded-lg"><FileText size={16}/></div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-slate-700">ATA_AGRARIA_21.01.26.pdf</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Registrada em 22/01</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default App;
