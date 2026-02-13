import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai'; // Ajustado com o hífen
import { FileText, Send, Loader2, Award } from 'lucide-react';

const App = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  // IMPORTANTE: Nome da variável deve ser VITE_GEMINI_API_KEY na Vercel
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

  const gerarAta = async () => {
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `
        Você é um Consultor Sênior de Governança da empresa INEPAD. 
        Sua tarefa é transformar notas brutas de uma reunião de conselho em uma ATA DE REUNIÃO DE CONSELHO CONSULTIVO profissional.

        Use a estrutura baseada no padrão INEPAD/Agrária:
        1. CABEÇALHO: Título, Data, Horário e Local.
        2. PARTICIPANTES: Nomes e cargos.
        3. PAUTAS: Tópicos discutidos.
        4. DELIBERAÇÕES E DECISÕES: Tabela detalhada.
        5. PENDÊNCIAS E RESPONSÁVEIS: Atividade, Responsável e Prazo.
        6. ENCERRAMENTO: Texto formal.

        NOTAS BRUTAS:
        ${input}
      `;

      const result = await model.generateContent(prompt);
      setOutput(result.response.text());
    } catch (error) {
      console.error("Erro:", error);
      setOutput("Erro ao gerar ata. Verifique se a chave VITE_GEMINI_API_KEY está correta na Vercel.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8 border-b pb-4">
          <Award className="text-blue-900" size={32} />
          <h1 className="text-2xl font-bold text-blue-900 uppercase">GovCorp - INEPAD</h1>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border mb-6">
          <textarea 
            className="w-full h-48 p-4 border rounded-lg outline-none"
            placeholder="Cole aqui as notas da reunião..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button 
            onClick={gerarAta}
            disabled={loading || !input}
            className="mt-4 bg-blue-900 text-white px-6 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
            Gerar Ata Profissional
          </button>
        </div>
        {output && (
          <div className="bg-white p-8 rounded-xl shadow-md border-t-4 border-blue-900 whitespace-pre-wrap">
            {output}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
