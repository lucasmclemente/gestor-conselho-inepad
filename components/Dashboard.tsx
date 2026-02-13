
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Meeting, ActionStatus, DeliberationStatus } from '../types';
import { LayoutDashboard, CheckCircle2, AlertCircle, Clock, FileText } from 'lucide-react';

interface DashboardProps {
  meetings: Meeting[];
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

const Dashboard: React.FC<DashboardProps> = ({ meetings }) => {
  // Aggregate data
  const totalActions = meetings.reduce((acc, m) => acc + m.actions.length, 0);
  const completedActions = meetings.reduce((acc, m) => acc + m.actions.filter(a => a.status === ActionStatus.COMPLETED).length, 0);
  const pendingActions = totalActions - completedActions;

  const totalDeliberations = meetings.reduce((acc, m) => acc + m.deliberations.length, 0);
  const approvedDeliberations = meetings.reduce((acc, m) => acc + m.deliberations.filter(d => d.status === DeliberationStatus.APPROVED).length, 0);

  const actionData = [
    { name: 'Concluídas', value: completedActions },
    { name: 'Pendentes', value: pendingActions },
  ];

  const deliberationStats = meetings.flatMap(m => m.deliberations).reduce((acc: any, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});

  const deliberationData = Object.keys(deliberationStats).map(status => ({
    name: status,
    value: deliberationStats[status]
  }));

  const meetingFrequencyData = meetings.map(m => ({
    name: m.date,
    items: m.agenda.length,
    actions: m.actions.length
  })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-indigo-600" />
          Dashboard de Governança
        </h2>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Ações Concluídas</p>
            <p className="text-2xl font-bold text-slate-800">{completedActions}/{totalActions}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Deliberações Aprovadas</p>
            <p className="text-2xl font-bold text-slate-800">{approvedDeliberations}/{totalDeliberations}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">ATAs Registradas</p>
            <p className="text-2xl font-bold text-slate-800">{meetings.filter(m => !!m.minutes).length}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-rose-50 rounded-lg text-rose-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Ações Atrasadas</p>
            <p className="text-2xl font-bold text-slate-800">{meetings.flatMap(m => m.actions).filter(a => a.status === ActionStatus.OVERDUE).length}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold mb-6 text-slate-800">Status das Ações do Conselho</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={actionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {actionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold mb-6 text-slate-800">Decisões por Reunião</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={meetingFrequencyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="items" name="Itens de Pauta" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actions" name="Planos de Ação" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Actions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-800">Monitoramento de Decisões</h3>
          <button className="text-sm text-indigo-600 font-medium hover:underline">Ver todas</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-4">Decisão / Deliberação</th>
                <th className="px-6 py-4">Reunião</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {meetings.flatMap(m => 
                m.actions.map(a => ({ ...a, meetingTitle: m.title }))
              ).slice(0, 5).map((action) => (
                <tr key={action.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-800">{action.description}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{action.meetingTitle}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium 
                      ${action.status === ActionStatus.COMPLETED ? 'bg-emerald-100 text-emerald-700' : 
                        action.status === ActionStatus.PENDING ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                      {action.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{action.responsible}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
