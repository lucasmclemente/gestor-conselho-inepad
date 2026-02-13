import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generativeai';
import { FileText, Send, Loader2, Award } from 'lucide-react';

const App = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  // Pega a chave que configuramos na Vercel
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

  const gerarAta = async () => {
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `
        Você é um Consultor Sênior de Governança da empresa INEPAD. 
        Sua tarefa é transformar notas brutas de uma reunião de conselho em uma ATA DE REUNIÃO DE CONSELHO CONSULTIVO profissional.

        Use exatamente a estrutura abaixo, baseada no padrão INEPAD/Agrária:
        
        1. CABEÇALHO: Título em destaque, Data, Horário e Local.
        2. PARTICIPANTES: Liste os nomes presentes e seus cargos.
        3. PAUTAS: Liste os tópicos principais discutidos.
        4. DELIBERAÇÕES E DECISÕES: Crie uma tabela ou lista detalhada com:
           - Pauta: Nome do assunto.
           - Descrição: Resumo profissional do que foi discutido (use termos como "DRE", "Ebitda", "Eficiência Operacional" se fizer sentido).
           - Decisão: O que foi deliberado pelo conselho.
        5. PENDÊNCIAS E RESPONSÁVEIS: Uma seção clara com:
           - Atividade / Responsável / Prazo.
        6. ENCERRAMENTO: Texto formal de encerramento.

        NOTAS BRUTAS DA REUNIÃO:
        ${input}

        Mantenha um tom sóbrio, executivo e focado em resultados.
      `;

      const result = await model.generateContent(prompt);
      setOutput(result.response.text());
    } catch (error) {
      console.error("Erro ao gerar ata:", error);
      setOutput("Erro ao conectar com a inteligência artificial. Verifique sua chave de API.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header INEPAD */}
        <div className="flex items-center gap-3 mb-8 border-b pb-4">
          <Award className="text-blue-900" size={32} />
          <h1 className="text-2xl font-bold text-blue-900 uppercase tracking-tight">
            GovCorp - Portal de Governança INEPAD
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Input Area */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText size={20} className="text-blue-600" />
              Notas Brutas da Reunião
            </h2>
            <textarea 
              className="w-full h-48 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
              placeholder="Ex: Reunião iniciou 14h. Lucas apresentou os resultados. Tivemos lucro mas a margem caiu. Decidimos iniciar matriz de riscos em fev..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button 
              onClick={gerarAta}
              disabled={loading || !input}
              className="mt-4 bg-blue-900 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-800 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
              Gerar Ata Profissional
            </button>
          </div>

          {/* Output Area */}
          {output && (
            <div className="bg-white p-8 rounded-xl shadow-md border-t-4 border-blue-900 animate-in fade-in slide-in-from-bottom-4">
              <div className="prose max-w-none text-slate-800 whitespace-pre-wrap">
                {output}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
