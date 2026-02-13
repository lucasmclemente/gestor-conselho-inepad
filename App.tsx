import React, { useState } from 'react';
import { 
  LayoutDashboard, FileText, CheckCircle, Clock, AlertCircle, 
  Calendar, Users, ClipboardList, Plus, Save, Award, User, Layers, Search, Upload
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans">
      {/* Sidebar - Identidade Visual INEPAD */}
      <aside className="w-72 bg-[#0f172a] text-slate-300 flex flex-col shadow-xl">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800">
          <Award className="text-blue-400" size={28} />
          <span className="font-bold text-white text-lg tracking-tight">GovCorp INEPAD</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          
          <div className="pt-6 pb-2 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Secretaria de Conselho</div>
          
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
              LC
            </div>
            <div className="text-xs">
              <p className="font-bold text-white">Consultor Inepad</p>
              <p className="text-slate-500">Gestão de Governança</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shadow-sm sticky top-0 z-10">
          <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tight">
            {activeTab === 'dashboard' && 'Acompanhamento de Decisões'}
            {activeTab === 'convocacao' && 'Preparação de Reunião'}
            {activeTab === 'reuniao' && 'Painel Deliberativo'}
            {activeTab === 'acoes' && 'Planos de Ação e Repositório'}
          </h2>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <span className="text-blue-600 font-bold tracking-widest uppercase">INEPAD Conselhos</span>
            <span className="text-slate-300">|</span>
            <span>{new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </header>

        <div className="p-10 max-w-6xl mx-auto">
          
          {/* DASHBOARD: Acompanhamento de Decisões */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div className="p-3 bg-green-50 rounded-xl text-green-600"><CheckCircle size={24}/></div>
                    <span className="text-3xl font-black text-slate-800">0</span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Deliberações Pendentes</p>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><FileText size={24}/></div>
                    <span className="text-3xl font-black text-slate-800">0</span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Atas Pendentes</p>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div className="p-3 bg-red-50 rounded-xl text-red-600"><Clock size={24}/></div>
                    <span className="text-3xl font-black text-slate-800">0</span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ações Atrasadas</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
                <Search className="mx-auto mb-4 text-slate-200" size={48} />
                <h3 className="text-slate-800 font-bold mb-1 uppercase text-sm">Status das Decisões</h3>
                <p className="text-slate-400 text-xs">Utilize os filtros para acompanhar o status das deliberações do conselho.</p>
              </div>
            </div>
          )}

          {/* CONVOCAÇÃO: Organização das Pautas e Participantes */}
          {activeTab === 'convocacao' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data e Horário</label>
                  <input type="datetime-local" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all text-sm" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Agenda / Localização</label>
                  <input type="text" placeholder="Link da reunião ou Sala de reunião" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm" />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Participantes Convidados</label>
                <textarea rows={2} placeholder="Nomes e respectivos cargos..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ordem do Dia / Pautas da Reunião</label>
                <textarea rows={6} placeholder="Descreva os tópicos na ordem em que serão discutidos..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" />
              </div>
              <button className="bg-blue-900 text-white px-8 py-4 rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg shadow-blue-900/20">
                <Save size={16} /> Salvar e Enviar Convocação
              </button>
            </div>
          )}

          {/* ABA REUNIÃO: Deliberações e Materiais */}
          {activeTab === 'reuniao' && (
            <div className="space-y-8">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-50">
                  <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Materiais e Deliberações</h3>
                  <button className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-[10px] font-bold flex items-center gap-2 hover:bg-blue-100">
                    <Plus size={14}/> Adicionar Item (Políticas, Orçamentos, etc)
                  </button>
                </div>
                <div className="p-20 text-center border-2 border-dashed border-slate-100 rounded-xl">
                  <Layers className="mx-auto mb-4 text-slate-200" size={40} />
                  <p className="text-slate-400 text-xs font-medium">Anexe documentos para aprovação durante a reunião.</p>
                </div>
              </div>
            </div>
          )}

          {/* AÇÕES E ATAS: Planos de Ação e Inclusão de Documentos */}
          {activeTab === 'acoes' && (
            <div className="space-y-8">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest mb-6 border-b border-slate-50 pb-4">Planos de Ação e Seguimento</h3>
                <div className="text-center py-8">
                  <ClipboardList className="mx-auto mb-3 text-slate-200" size={32} />
                  <p className="text-slate-400 text-xs uppercase tracking-widest">Nenhuma ação pendente</p>
                </div>
              </div>
              
              <div className="bg-slate-50 p-10 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                <Upload className="mx-auto mb-4 text-slate-300" size={40} />
                <h3 className="font-bold text-slate-800 text-sm mb-1 uppercase">Repositório de Atas</h3>
                <p className="text-xs text-slate-400 mb-6 font-medium tracking-tight">Arquive aqui as atas assinadas e registradas do Conselho.</p>
                <button className="bg-white text-slate-600 border border-slate-200 px-6 py-2 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-all">
                  Selecionar Arquivo PDF
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default App;
