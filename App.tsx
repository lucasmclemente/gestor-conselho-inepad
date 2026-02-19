import React, { useState, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, Calendar, ChevronRight, UserPlus, 
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, 
  GripVertical, Upload, Save, Lock, Target, FileCheck, BarChart3, 
  PieChart as PieIcon, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, Settings, Camera, UserCircle, History
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const App = () => {
  // --- SISTEMA DE USUÁRIOS E AUTH ---
  const [users, setUsers] = useState([
    { id: 1, name: 'Administrador', email: 'admin@inepad.com.br', password: '@GovInepad2026!', role: 'Administrador', avatar: null },
    { id: 2, name: 'João Silva', email: 'secretario@inepad.com.br', password: 'Sec#Corp2026?', role: 'Secretário', avatar: null }
  ]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'Conselheiro' });

  // --- LOGS DE AUDITORIA ---
  const [auditLogs, setAuditLogs] = useState<any[]>([
    { id: 1, date: '19/02/2026 11:20', user: 'Sistema', action: 'Update', details: 'Sincronização de dashboard e correções de interface.' }
  ]);

  const addLog = (action: string, details: string) => {
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    setAuditLogs(prev => [{ id: Date.now(), date: formattedDate, user: currentUser?.name || 'Sistema', action, details }, ...prev]);
  };

  // --- NAVEGAÇÃO E ESTADOS ---
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('info');
  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);
  const profilePicRef = useRef<HTMLInputElement>(null);

  // --- DADOS ---
  const [meetings, setMeetings] = useState([
    { 
      id: 1, title: 'Conselho Admin - INEPAD Q1', status: 'AGENDADA', date: '2026-03-15', time: '14:00', type: 'Híbrida',
      participants: [{name: 'Membro Teste', email: 'teste@inepad.com.br'}],
      pautas: [{title: 'Aprovação Orçamentária', dur: '20', resp: 'Administrador'}],
      materiais: [], deliberacoes: [], 
      acoes: [{id: 201, title: 'Revisão de Metas', date: '2026-03-20', status: 'Pendente', resp: 'Administrador'}], 
      atas: []
    }
  ]);

  const [currentMeeting, setCurrentMeeting] = useState({
    id: 0, title: '', status: 'AGENDADA', date: '', time: '', type: 'Híbrida', location: '', address: '', link: '',
    participants: [] as any[], pautas: [] as any[], materiais: [] as any[], deliberacoes: [] as any[], acoes: [] as any[], atas: [] as any[]
  });

  const [tmpPart, setTmpPart] = useState({ name: '', email: '' });
  const [tmpPauta, setTmpPauta] = useState({ title: '', resp: '', dur: '' });
  const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '', newPass: '' });

  const isAdm = currentUser?.role === 'Administrador';

  // --- DASHBOARD LOGIC ---
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const allA = meetings.flatMap(m => (m.acoes || []).map(a => ({ ...a, mTitle: m.title })));
    const pendingList = allA.filter(a => a.status !== 'Concluído');
    
    const concluido = allA.filter(a => a.status === 'Concluído').length;
    const atrasado = pendingList.filter(a => a.date && new Date(a.date) < today).length;
    const pendente = pendingList.length - atrasado;

    return {
      act: `${concluido}/${allA.length}`,
      atas: meetings.reduce((acc, m) => acc + (m.atas?.length || 0), 0),
      pendingList,
      pieData: [
        { name: 'Concluídas', value: concluido, color: '#10b981' },
        { name: 'Pendentes', value: pendente, color: '#3b82f6' },
        { name: 'Atrasadas', value: atrasado, color: '#ef4444' }
      ],
      barData: meetings.map(m => ({
        name: m.title.substring(0, 10),
        'Pautas': m.pautas?.length || 0,
        'Ações': m.acoes?.length || 0
      }))
    };
  }, [meetings]);

  // --- LOGIN ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden">
          <div className="p-10 bg-slate-900 text-white text-center border-b-8 border-blue-600">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-blue-500" />
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">GovCorp</h1>
          </div>
          <div className="p-10">
            <form onSubmit={(e) => {
              e.preventDefault();
              const user = users.find(u => u.email === authForm.email && u.password === authForm.password);
              if (user) { setCurrentUser(user); setActiveMenu('dashboard'); }
              else alert("Acesso negado.");
            }} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input type="email" placeholder="E-mail" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-2xl text-sm font-bold outline-none" value={authForm.email} onChange={e=>setAuthForm({...authForm, email: e.target.value})} />
              </div>
              <div className="relative">
                <Key className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input type="password" placeholder="Senha" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-2xl text-sm font-bold outline-none" value={authForm.password} onChange={e=>setAuthForm({...authForm, password: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all">Entrar</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  let mainContent;
  if (activeMenu === 'dashboard') {
    mainContent = (
      <div className="space-y-8 animate-in fade-in">
        <div className="flex justify-between items-end"><h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Visão Estratégica</h1></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[ {l:'Ações OK', v:stats.act, i:<CheckCircle2/>, c:'blue'}, {l:'ATAs', v:stats.atas, i:<FileCheck/>, c:'green'}, {l:'Pendências', v:stats.pendingList.length, i:<AlertCircle/>, c:'red'} ].map((s, idx) => (
            <div key={idx} className="bg-white p-6 rounded-[32px] border shadow-sm">
                <div className={`w-10 h-10 rounded-2xl mb-4 flex items-center justify-center ${s.c==='blue'?'bg-blue-50 text-blue-600':s.c==='red'?'bg-red-50 text-red-600':'bg-green-50 text-green-600'}`}>{s.i}</div>
                <p className="text-[9px] font-black text-slate-400 uppercase italic mb-1">{s.l}</p><p className="text-2xl font-black text-slate-800 tracking-tighter">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border shadow-sm h-96">
            <h3 className="text-[10px] font-black uppercase mb-6 italic text-slate-500 flex items-center gap-2"><BarChart3 size={16}/> Decisões por Reunião</h3>
            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.barData}><CartesianGrid vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900}} /><YAxis hide /><Tooltip/><Legend iconType="circle" wrapperStyle={{fontSize:'10px', fontWeight:900}} /><Bar dataKey="Pautas" fill="#cbd5e1" radius={[6,6,0,0]} barSize={20}/><Bar dataKey="Ações" fill="#3b82f6" radius={[6,6,0,0]} barSize={20}/></BarChart></ResponsiveContainer></div>
          </div>
          <div className="bg-white p-8 rounded-[40px] border shadow-sm h-96 flex flex-col">
            <h3 className="text-[10px] font-black uppercase mb-6 italic text-slate-500 flex items-center gap-2"><PieIcon size={16}/> Status das Ações</h3>
            <div className="flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={8}>{stats.pieData.map((e,i)=>(<Cell key={i} fill={e.color}/>))}</Pie><Tooltip/><Legend iconType="circle" wrapperStyle={{fontSize:'9px', fontWeight:900}}/></PieChart></ResponsiveContainer></div>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[40px] border shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-6"><h3 className="text-[10px] font-black uppercase italic text-slate-500 flex items-center gap-2"><Target size={16}/> Plano de Ações</h3><button onClick={() => setActiveMenu('plano-geral')} className="text-blue-600 text-[10px] font-black uppercase hover:underline font-bold">Ver Todas</button></div>
          <table className="w-full text-left font-bold italic text-xs">
            <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="p-4">Tarefa</th><th className="p-4 text-center">Status</th></tr></thead>
            <tbody>{stats.pendingList.slice(0, 5).map((a, i) => (<tr key={i} className="border-t hover:bg-slate-50/50"><td className="p-4 text-slate-800 underline italic">{a.title}</td><td className="p-4 text-center"><span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${new Date(a.date) < new Date() ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>{new Date(a.date) < new Date() ? 'Atrasada' : a.status}</span></td></tr>))}</tbody>
          </table>
        </div>
      </div>
    );
  } else if (activeMenu === 'plano-geral') {
    mainContent = (
      <div className="space-y-6 animate-in fade-in">
        <button onClick={() => setActiveMenu('dashboard')} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-[10px] font-black uppercase italic transition-all"><ChevronRight className="rotate-180" size={16}/> Voltar</button>
        <div className="bg-white p-8 rounded-[40px] border shadow-lg overflow-hidden">
          <h2 className="text-xl font-black italic mb-6">Monitoramento Geral de Ações</h2>
          <table className="w-full text-left font-bold italic text-xs"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="p-6">Tarefa</th><th className="p-6">Prazo</th><th className="p-6">Status</th></tr></thead>
            <tbody>{stats.pendingList.map((a, i) => (<tr key={i} className="border-t hover:bg-slate-50/50"><td className="p-6 text-slate-800 font-black italic underline">{a.title}</td><td className="p-6 text-slate-500">{a.date}</td><td className="p-6"><span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase ${new Date(a.date) < new Date() ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>{new Date(a.date) < new Date() ? 'Atrasada' : a.status}</span></td></tr>))}</tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 overflow-hidden leading-tight animate-in fade-in duration-300">
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800"><CheckCircle2 className="text-blue-500" size={24}/><span className="font-bold text-white text-xl uppercase italic tracking-tighter leading-none">GovCorp</span></div>
        <nav className="flex-1 p-4 space-y-2 font-bold italic text-xs">
          <button onClick={() => setActiveMenu('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeMenu === 'dashboard' || activeMenu === 'plano-geral' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all mt-10"><LogOut size={18}/> Logout</button>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest italic tracking-widest">INEPAD Governança</span>
          <div className="flex gap-4 text-[10px] font-bold uppercase italic text-slate-400 items-center">
            <div className="text-right"><p className="text-slate-800 font-black tracking-tight">{currentUser.name}</p><p className="justify-end">{currentUser.role}</p></div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 border flex items-center justify-center text-blue-600 font-black shadow-sm overflow-hidden"><UserCheck size={16}/></div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">{mainContent}</div>
      </main>
    </div>
  );
};

export default App;
