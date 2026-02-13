import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  LayoutDashboard, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Send,
  Loader2,
  Award,
  User
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

  const gerarAta = async () => {
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Você é um Consultor de Governança da INEPAD. Transforme as notas em uma Ata profissional padrão Agrária: ${input}`;
      const result = await model.generateContent(prompt);
      setOutput(result.response.text());
    } catch (error) {
      setOutput("Erro ao gerar. Verifique sua chave VITE_GEMINI_API_KEY.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar Lateral */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <Award className="text-blue-900" size={24} />
          <span className="font-bold text-blue-900 text-sm uppercase tracking-tighter">GovCorp - INEPAD</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-900' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('ata')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'ata' ? 'bg-blue-50 text-blue-900' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <FileText size={18} /> Gerador de Atas
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
              <User size={16} className="text-slate-500" />
            </div>
            <div className="text-xs">
              <p className="font-semibold text-slate-700">Ricardo Oliveira</p>
              <p className="text-slate-400">Secretário Geral</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <h2 className="font-semibold text-slate-700">
            {activeTab === 'dashboard' ? 'Visão Geral do Conselho' : 'Novo Documento'}
          </h2>
        </header>

        <div className="p-8">
          {activeTab === 'dashboard' ? (
            <div className="space-y-8">
              {/* Cards de Métricas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-green-50 rounded-lg"><CheckCircle className="text-green-600" size={20}/></div>
                    <span className="text-2xl font-bold text-slate-800">2/2</span>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Deliberações Aprovadas</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-blue-50 rounded-lg"><FileText className="text-blue-600" size={20}/></div>
                    <span className="text-2xl font-bold text-slate-800">1</span>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Atas Registradas</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-red-50 rounded-lg"><Clock className="text-red-600" size={20}/></div>
                    <span className="text-2xl font-bold text-slate-800">0</span>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Ações Atrasadas</p>
                </div>
              </div>

              {/* Tabela de Status (Placeholder) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-800">Status das Ações do Conselho</h3>
                </div>
                <div className="p-12 text-center text-slate-400">
                  <AlertCircle className="mx-auto mb-2 opacity-20" size={48} />
                  <p>Nenhuma ação pendente no momento.</p>
                </div>
              </div>
            </div>
          ) : (
            /* Conteúdo do Gerador de Atas */
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-semibold mb-4 text-slate-800">Criar Ata Profissional</h3>
                <textarea 
                  className="w-full h-64 p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-sm"
                  placeholder="Cole aqui as notas brutas da reunião (ex: pautas discutidas, decisões e prazos)..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button 
                  onClick={gerarAta}
                  disabled={loading || !input}
                  className="mt-4 bg-blue-900 text-white px-8 py-3 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-800 transition-all disabled:opacity-50 shadow-lg shadow-blue-900/20"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  Processar com IA
                </button>
              </div>

              {output && (
                <div className="bg-white p-8 rounded-xl shadow-md border-l-4 border-blue-900 animate-in fade-in slide-in-from-bottom-4">
                  <div className="prose max-w-none text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                    {output}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
