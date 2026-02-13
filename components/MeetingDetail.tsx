
import React, { useState } from 'react';
import { 
  Meeting, 
  DeliberationStatus, 
  ActionStatus, 
  Deliberation, 
  ActionPlan,
  MeetingStatus
} from '../types';
import { 
  Calendar, MapPin, Users, FileText, ListChecks, 
  ArrowLeft, Download, Plus, Trash2, CheckCircle, 
  Send, Sparkles, Loader2
} from 'lucide-react';
import { analyzeMinutes } from '../services/geminiService';

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
  onUpdate: (updatedMeeting: Meeting) => void;
}

const MeetingDetail: React.FC<MeetingDetailProps> = ({ meeting, onBack, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'agenda' | 'materials' | 'deliberations' | 'actions' | 'minutes'>('info');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [minutesText, setMinutesText] = useState(meeting.minutes || '');

  const handleStatusChange = (status: MeetingStatus) => {
    onUpdate({ ...meeting, status });
  };

  const handleActionStatusChange = (actionId: string, newStatus: ActionStatus) => {
    const newActions = meeting.actions.map(a => 
      a.id === actionId ? { ...a, status: newStatus } : a
    );
    onUpdate({ ...meeting, actions: newActions });
  };

  const handleAddAction = () => {
    const newAction: ActionPlan = {
      id: Math.random().toString(36).substr(2, 9),
      description: 'Nova Ação',
      responsible: 'A definir',
      deadline: new Date().toISOString().split('T')[0],
      status: ActionStatus.PENDING
    };
    onUpdate({ ...meeting, actions: [...meeting.actions, newAction] });
  };

  const handleAddDeliberation = () => {
    const newDel: Deliberation = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'Nova Deliberação',
      description: 'Descrição da proposta para aprovação.',
      status: DeliberationStatus.UNDER_REVIEW
    };
    onUpdate({ ...meeting, deliberations: [...meeting.deliberations, newDel] });
  };

  const handleAiAnalyze = async () => {
    if (!minutesText) return;
    setIsAnalyzing(true);
    const result = await analyzeMinutes(minutesText);
    if (result) {
      const confirmed = window.confirm("A IA detectou " + result.extractedActions.length + " ações e sugere um resumo. Deseja aplicar os novos itens ao Plano de Ação?");
      if (confirmed) {
        const aiActions: ActionPlan[] = result.extractedActions.map((a: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          description: a.description,
          responsible: a.responsible,
          deadline: a.deadline,
          status: ActionStatus.PENDING
        }));
        onUpdate({ 
          ...meeting, 
          actions: [...meeting.actions, ...aiActions],
          minutes: minutesText
        });
      }
    }
    setIsAnalyzing(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'info':
        return (
          <div className="space-y-6">
            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl">
              <h3 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Convocação e Invites
              </h3>
              <p className="text-indigo-800 text-sm mb-4">
                Envie a convocação formal para todos os conselheiros e diretores. O link da reunião e os materiais da pauta serão anexados automaticamente.
              </p>
              <button 
                onClick={() => alert('Convites enviados para ' + meeting.participants.length + ' participantes.')}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                Enviar Convocações por E-mail
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-100">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-400" />
                  Lista de Participantes
                </h3>
                <ul className="space-y-3">
                  {meeting.participants.map(p => (
                    <li key={p.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                      <div>
                        <p className="font-medium text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.role}</p>
                      </div>
                      <span className="text-xs text-slate-400">{p.email}</span>
                    </li>
                  ))}
                </ul>
                <button className="mt-4 w-full py-2 border-2 border-dashed border-slate-200 text-slate-400 rounded-lg text-sm font-medium hover:border-slate-300 hover:text-slate-500 transition-all flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Adicionar Convidado
                </button>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-100">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  Detalhes Logísticos
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Data e Hora:</span>
                    <span className="font-medium text-slate-800">{meeting.date} às {meeting.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Localização:</span>
                    <span className="font-medium text-slate-800">{meeting.location}</span>
                  </div>
                  <div className="pt-4 border-t border-slate-50">
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase">Alterar Status</label>
                    <select 
                      value={meeting.status}
                      onChange={(e) => handleStatusChange(e.target.value as MeetingStatus)}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      {Object.values(MeetingStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'agenda':
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-6">Ordem do Dia</h3>
            <div className="space-y-4">
              {meeting.agenda.map((item, idx) => (
                <div key={item.id} className="flex gap-4 p-4 rounded-xl border border-slate-100 hover:border-indigo-100 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm font-bold text-slate-500 flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-slate-800">{item.title}</h4>
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{item.duration} min</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{item.description}</p>
                  </div>
                </div>
              ))}
              <button className="w-full py-4 border-2 border-dashed border-slate-100 text-slate-400 rounded-xl text-sm font-medium hover:border-indigo-200 hover:text-indigo-400 transition-all flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" /> Adicionar Item de Pauta
              </button>
            </div>
          </div>
        );
      case 'materials':
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-slate-800">Materiais de Apoio</h3>
              <input type="file" id="file-upload" className="hidden" />
              <label htmlFor="file-upload" className="cursor-pointer bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" /> Subir Material
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {meeting.materials.length > 0 ? meeting.materials.map(file => (
                <div key={file.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex items-center gap-3">
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate text-sm">{file.name}</p>
                    <p className="text-xs text-slate-400 uppercase">{file.uploadDate}</p>
                  </div>
                  <button className="text-slate-400 hover:text-indigo-600 transition-colors">
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              )) : (
                <div className="col-span-full py-12 text-center text-slate-400">
                  Nenhum material anexado a esta reunião.
                </div>
              )}
            </div>
          </div>
        );
      case 'deliberations':
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-slate-800">Propostas e Deliberações</h3>
              <button 
                onClick={handleAddDeliberation}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nova Proposta
              </button>
            </div>
            <div className="space-y-4">
              {meeting.deliberations.length > 0 ? meeting.deliberations.map(del => (
                <div key={del.id} className="p-5 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-800">{del.title}</h4>
                    <select 
                      value={del.status}
                      onChange={(e) => {
                        const newDels = meeting.deliberations.map(d => d.id === del.id ? {...d, status: e.target.value as DeliberationStatus} : d);
                        onUpdate({...meeting, deliberations: newDels});
                      }}
                      className={`text-xs font-bold px-3 py-1 rounded-full border-none focus:ring-0 cursor-pointer
                        ${del.status === DeliberationStatus.APPROVED ? 'bg-emerald-100 text-emerald-700' : 
                          del.status === DeliberationStatus.REJECTED ? 'bg-rose-100 text-rose-700' : 
                          del.status === DeliberationStatus.POSTPONED ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {Object.values(DeliberationStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">{del.description}</p>
                  <div className="flex gap-2">
                    <button className="text-xs font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
                      <FileText className="w-3 h-3" /> Ver Material Vinculado
                    </button>
                    <button className="text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ml-auto">
                      <Trash2 className="w-3 h-3" /> Excluir
                    </button>
                  </div>
                </div>
              )) : (
                <div className="py-12 text-center text-slate-400">
                  Nenhuma deliberação registrada nesta reunião.
                </div>
              )}
            </div>
          </div>
        );
      case 'actions':
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-slate-800">Plano de Ação (Follow-up)</h3>
              <button 
                onClick={handleAddAction}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nova Ação
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-slate-400 font-semibold uppercase border-b border-slate-50">
                  <tr>
                    <th className="pb-3 px-2">Ação</th>
                    <th className="pb-3 px-2">Responsável</th>
                    <th className="pb-3 px-2">Prazo</th>
                    <th className="pb-3 px-2">Status</th>
                    <th className="pb-3 px-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {meeting.actions.map(action => (
                    <tr key={action.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-2">
                        <input 
                          value={action.description} 
                          onChange={(e) => {
                            const updated = meeting.actions.map(a => a.id === action.id ? {...a, description: e.target.value} : a);
                            onUpdate({...meeting, actions: updated});
                          }}
                          className="bg-transparent border-none focus:ring-0 w-full text-slate-800 text-sm font-medium"
                        />
                      </td>
                      <td className="py-4 px-2">
                        <input 
                          value={action.responsible} 
                          onChange={(e) => {
                            const updated = meeting.actions.map(a => a.id === action.id ? {...a, responsible: e.target.value} : a);
                            onUpdate({...meeting, actions: updated});
                          }}
                          className="bg-transparent border-none focus:ring-0 text-slate-600 text-sm"
                        />
                      </td>
                      <td className="py-4 px-2">
                        <input 
                          type="date"
                          value={action.deadline} 
                          onChange={(e) => {
                            const updated = meeting.actions.map(a => a.id === action.id ? {...a, deadline: e.target.value} : a);
                            onUpdate({...meeting, actions: updated});
                          }}
                          className="bg-transparent border-none focus:ring-0 text-slate-600 text-sm"
                        />
                      </td>
                      <td className="py-4 px-2">
                        <select 
                          value={action.status}
                          onChange={(e) => handleActionStatusChange(action.id, e.target.value as ActionStatus)}
                          className={`text-xs font-bold rounded-lg border border-slate-200 p-1
                            ${action.status === ActionStatus.COMPLETED ? 'text-emerald-600' : 'text-slate-600'}`}
                        >
                          {Object.values(ActionStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="py-4 px-2 text-right">
                        <button className="text-slate-300 hover:text-rose-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {meeting.actions.length === 0 && (
                <div className="py-12 text-center text-slate-400">
                  Nenhuma ação derivada desta reunião.
                </div>
              )}
            </div>
          </div>
        );
      case 'minutes':
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-100 flex flex-col h-[600px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-800">Registro da Ata</h3>
              <div className="flex gap-2">
                <button 
                  onClick={handleAiAnalyze}
                  disabled={isAnalyzing || !minutesText}
                  className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Análise de Ata com IA
                </button>
                <button 
                  onClick={() => onUpdate({...meeting, minutes: minutesText})}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Salvar Registro
                </button>
              </div>
            </div>
            <textarea 
              value={minutesText}
              onChange={(e) => setMinutesText(e.target.value)}
              placeholder="Digite aqui o registro detalhado da reunião..."
              className="flex-1 w-full p-4 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 leading-relaxed font-serif"
            ></textarea>
            <div className="mt-4 flex justify-between items-center text-xs text-slate-400">
              <p>Última alteração: {new Date().toLocaleString('pt-BR')}</p>
              <button className="flex items-center gap-1 hover:text-slate-600">
                <Download className="w-3 h-3" /> Gerar Versão em PDF para Assinatura
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-slate-800">{meeting.title}</h2>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
              ${meeting.status === MeetingStatus.CONCLUDED ? 'bg-emerald-100 text-emerald-700' : 
                meeting.status === MeetingStatus.SCHEDULED ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
              {meeting.status}
            </span>
          </div>
          <p className="text-slate-500 text-sm flex items-center gap-3">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {meeting.date} às {meeting.time}</span>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {meeting.location}</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-hide">
        <button 
          onClick={() => setActiveTab('info')}
          className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap
          ${activeTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Informações e Convites
        </button>
        <button 
          onClick={() => setActiveTab('agenda')}
          className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap
          ${activeTab === 'agenda' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Ordem do Dia
        </button>
        <button 
          onClick={() => setActiveTab('materials')}
          className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap
          ${activeTab === 'materials' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Materiais
        </button>
        <button 
          onClick={() => setActiveTab('deliberations')}
          className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap
          ${activeTab === 'deliberations' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Deliberações
        </button>
        <button 
          onClick={() => setActiveTab('actions')}
          className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap
          ${activeTab === 'actions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Planos de Ação
        </button>
        <button 
          onClick={() => setActiveTab('minutes')}
          className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap
          ${activeTab === 'minutes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          ATAs
        </button>
      </div>

      <div className="pt-2">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default MeetingDetail;
