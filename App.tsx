import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  LayoutDashboard, Calendar, ChevronRight, UserPlus, 
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, 
  Upload, Save, Lock, Target, FileCheck, BarChart3, 
  PieChart as PieIcon, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, Settings, Camera, UserCircle, History, Filter, MessageSquare, Download, ExternalLink, ListChecks
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// --- CONFIGURAÇÃO SUPABASE INEPAD ---
const supabaseUrl = 'https://jrtrrubtjbinnddqdbta.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydHJydWJ0amJpbm5kZHFkYnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjU2NjksImV4cCI6MjA4NzEwMTY2OX0.J2DNMhNwGlyG3u7L-kd6gW3NC5-EqVSogXyYchQiVyk';
const supabase = createClient(supabaseUrl, supabaseKey);

const App = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('info');
  const [dashboardFilter, setDashboardFilter] = useState('all');

  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);

  const blankMeeting = {
    title: '', status: 'Agendada', date: '', time: '', type: 'Híbrida', link: '', address: '',
    participants: [], pautas: [], materiais: [], deliberacoes: [], acoes: [], atas: []
  };
  const [currentMeeting, setCurrentMeeting] = useState<any>(blankMeeting);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', role: 'Conselheiro', password: '' });

  const isAdm = currentUser?.role === 'Administrador';

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    const [mRes, uRes, lRes] = await Promise.all([
      supabase.from('meetings').select('*').order('created_at', { ascending: false }),
      supabase.from('members').select('*').order('name'),
      supabase.from('audit_logs').select('*').order('log_date', { ascending: false }).limit(50)
    ]);
    if (mRes.data) setMeetings(mRes.data);
    if (uRes.data) setUsers(uRes.data);
    if (lRes.data) setAuditLogs(lRes.data);
    setLoading(false);
  };

  const addLog = async (action: string, details: string) => {
    const log = { username: currentUser?.name || 'Sistema', action, details };
    const { data } = await supabase.from('audit_logs').insert([log]).select();
    if (data) setAuditLogs(prev => [data[0], ...prev]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'materiais' | 'atas') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `${type}/${fileName}`;
      const { error } = await supabase.storage.from('meeting-files').upload(filePath, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('meeting-files').getPublicUrl(filePath);
      const newFile = { name: file.name, url: publicUrl, uploadedAt: new Date().toISOString() };
      setCurrentMeeting((prev: any) => ({ ...prev, [type]: [...(prev[type] || []), newFile] }));
      addLog('Upload', `Arquivo ${file.name} em ${type}`);
      alert("Sucesso!");
    } catch (err: any) { alert("Erro: " + err.message); }
    finally { setLoading(false); if (e.target) e.target.value = ''; }
  };

  const saveMeeting = async () => {
    const { data, error } = await supabase.from('meetings').upsert([currentMeeting]).select();
    if (!error && data) {
      setMeetings(prev => {
        const index = prev.findIndex(m => m.id === data[0].id);
        if (index !== -1) { const newM = [...prev]; newM[index] = data[0]; return newM; }
        return [data[0], ...prev];
      });
      setView('list');
      addLog('Salvamento', `Reunião: ${currentMeeting.title}`);
    }
  };

  // --- ATUALIZAÇÃO DE STATUS GLOBAL (DASHBOARD/PLANO) ---
  const updateActionStatusGlobal = async (meetingId: string, actionId: string | number, newStatus: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = meeting.acoes.map((a: any) => a.id === actionId ? { ...a, status: newStatus } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
      addLog('Status', `Ação atualizada para ${newStatus}`);
    } else {
      alert("Erro ao atualizar status.");
    }
  };

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const filteredM = dashboardFilter === 'all' ? meetings : meetings.filter(m => m.id === dashboardFilter);
    const allA = filteredM.flatMap(m => (m.acoes || []).map((a:any) => ({ ...a, mTitle: m.title, mId: m.id })));
    const count = (st: string) => allA.filter(a => a.status === st).length;
    const atrasadas = allA.filter(a => a.status !== 'Concluída' && a.date && new Date(a.date) < today).length;

    return {
      concluida: `${allA.filter(a => a.status === 'Concluída').length}/${allA.length || 0}`,
      delibs: filteredM.flatMap(m => m.deliberacoes || []).length,
      atas: filteredM.reduce((acc, m) => acc + (m.atas?.length || 0), 0),
      atrasadas,
      allActions: allA,
      pieData: [
        { name: 'Em Andamento', value: count('Em andamento'), color: '#3b82f6' },
        { name: 'Pendente', value: count('Pendente'), color: '#f59e0b' },
        { name: 'Atrasada', value: atrasadas, color: '#ef4444' }
      ],
      barData: filteredM.slice(0,6).map(m => ({ name: m.date || 'S/D', 'Itens': m.pautas?.length || 0, 'Ações': m.acoes?.length || 0 }))
    };
  }, [meetings, dashboardFilter]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-10">
          <div className="text-center mb-8"><CheckCircle2 size={48} className="mx-auto mb-2 text-blue-500" /><h1 className="text-2xl font-black italic uppercase">GovCorp</h1></div>
          <form className="space-y-4" onSubmit={(e)=>{e.preventDefault(); const u = users.find(u=>u.email===authForm.email && u.password===authForm.password); if(u){setCurrentUser(u); addLog('Login','Acesso');}else alert('Erro');}}>
            <input type="email" placeholder="E-mail" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} />
            <input type="password" placeholder="Senha" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} />
            <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase shadow-lg">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800"><CheckCircle2 className="text-blue-500"/><span className="font-black text-white text-lg uppercase italic tracking-tighter">GovCorp</span></div>
        <nav className="flex-1 p-4 space-y-2 text-[10px] font-black uppercase italic tracking-widest">
          <button onClick={() => setActiveMenu('dashboard')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calendar size={18}/> Reuniões</button>
          <button onClick={() => setActiveMenu('plano-acao')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu === 'plano-acao' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><ListChecks size={18}/> Plano de Ação</button>
          {isAdm && <button onClick={() => setActiveMenu('usuarios')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu === 'usuarios' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><UserCog size={18}/> Membros</button>}
          {isAdm && <button onClick={() => setActiveMenu('auditoria')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu === 'auditoria' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><History size={18}/> Auditoria</button>}
          <div className="pt-10 border-t border-slate-800"><button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"><LogOut size={18}/> Sair</button></div>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">INEPAD Governança</span>
          <div className="flex gap-4 items-center">
            <div className="text-right"><p className="text-xs font-black text-slate-800 uppercase italic">{currentUser.name}</p><p className="text-[9px] font-bold text-blue-600 uppercase">{currentUser.role}</p></div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 border flex items-center justify-center text-blue-600 font-bold uppercase">{currentUser.name[0]}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="h-full flex items-center justify-center font-black text-slate-400 uppercase italic animate-pulse">Sincronizando com a Nuvem...</div>
          ) : (
            <>
              {activeMenu === 'dashboard' && (
                <div className="space-y-8 animate-in fade-in">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Visão Estratégica</h1>
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border shadow-sm">
                      <Filter size={16} className="text-blue-600"/><select className="text-xs font-bold outline-none bg-transparent" value={dashboardFilter} onChange={e=>setDashboardFilter(e.target.value)}>
                        <option value="all">Consolidado Geral</option>
                        {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[ {l:'Ações Concluídas', v:stats.concluida, i:<CheckCircle2/>, c:'blue'}, {l:'Deliberações', v:stats.delibs, i:<FileText/>, c:'amber'}, {l:'ATAs Registradas', v:stats.atas, i:<FileCheck/>, c:'emerald'}, {l:'Ações Atrasadas', v:stats.atrasadas, i:<AlertCircle/>, c:'red'} ].map((s, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-3xl border shadow-sm transition-all hover:shadow-md">
                          <div className={`w-10 h-10 rounded-2xl mb-4 flex items-center justify-center ${s.c==='blue'?'bg-blue-50 text-blue-600':s.c==='red'?'bg-red-50 text-red-600':s.c==='amber'?'bg-amber-50 text-amber-600':'bg-emerald-50 text-emerald-600'}`}>{s.i}</div>
                          <p className="text-[9px] font-black text-slate-400 uppercase italic mb-1">{s.l}</p><p className="text-2xl font-black text-slate-800 tracking-tighter">{s.v}</p>
                      </div>
                    ))}
                  </div>

                  {/* MINI PLANO DE AÇÃO NO DASHBOARD */}
                  <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-[10px] font-black uppercase italic text-slate-500 tracking-widest flex items-center gap-2"><ListChecks size={18} className="text-blue-600"/> Ações Prioritárias</h3>
                      <button onClick={() => setActiveMenu('plano-acao')} className="text-[9px] font-black text-blue-600 uppercase italic hover:underline">Ver Plano Completo →</button>
                    </div>
                    <div className="overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="text-[9px] font-black uppercase text-slate-400 border-b">
                          <tr><th className="pb-4">Ação</th><th className="pb-4">Responsável</th><th className="pb-4 text-center">Status</th></tr>
                        </thead>
                        <tbody className="text-xs font-bold italic">
                          {stats.allActions.slice(0, 5).map((acao: any, idx: number) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-slate-50 transition-all">
                              <td className="py-4 text-slate-800">{acao.title}</td>
                              <td className="py-4 text-slate-600">{acao.resp}</td>
                              <td className="py-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-[9px] uppercase font-black ${acao.status === 'Concluída' ? 'bg-emerald-50 text-emerald-600' : acao.status === 'Atrasada' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                  {acao.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeMenu === 'plano-acao' && (
                <div className="space-y-8 animate-in fade-in">
                  <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Plano de Ação Global</h1>
                    <button onClick={() => { const h="Ação,Reunião,Responsável,Prazo,Status\n"; const r=stats.allActions.map(a=>`${a.title},${a.mTitle},${a.resp},${a.date},${a.status}`).join("\n"); const b=new Blob([h+r],{type:'text/csv;charset=utf-8;'}); const l=document.createElement("a"); l.href=URL.createObjectURL(b); l.setAttribute("download","plano_acao_inepad.csv"); l.click(); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2"><Download size={14}/> Exportar Plano</button>
                  </div>
                  <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden">
                    <table className="w-full text-left font-bold italic text-xs">
                      <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b">
                        <tr><th className="p-6">Ação</th><th className="p-6">Reunião de Origem</th><th className="p-6">Responsável</th><th className="p-6">Prazo</th><th className="p-6 text-center">Status</th></tr>
                      </thead>
                      <tbody>
                        {stats.allActions.map((acao: any, idx: number) => (
                          <tr key={idx} className="border-t hover:bg-slate-50 transition-all">
                            <td className="p-6 text-slate-800">{acao.title}</td>
                            <td className="p-6 text-slate-400 text-[10px]">{acao.mTitle}</td>
                            <td className="p-6 text-slate-600">{acao.resp}</td>
                            <td className="p-6 text-slate-400">{acao.date ? new Date(acao.date).toLocaleDateString() : 'S/P'}</td>
                            <td className="p-6 text-center">
                              <select 
                                value={acao.status} 
                                onChange={(e) => updateActionStatusGlobal(acao.mId, acao.id, e.target.value)}
                                className={`p-2 rounded-xl text-[9px] font-black uppercase italic outline-none border-none cursor-pointer ${acao.status === 'Concluída' ? 'bg-emerald-50 text-emerald-600' : acao.status === 'Atrasada' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}
                              >
                                <option value="Pendente">Pendente</option>
                                <option value="Em andamento">Em andamento</option>
                                <option value="Concluída">Concluída</option>
                                <option value="Atrasada">Atrasada</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {/* RESTO DO CÓDIGO (REUNIOES, USUARIOS, AUDITORIA) CONTINUA IGUAL ABAIXO... */}
            </>
          )}
        </div>
      </main>
      <input type="file" ref={fileRef} className="hidden" onChange={(e) => handleFileUpload(e, 'materiais')} />
      <input type="file" ref={ataRef} className="hidden" onChange={(e) => handleFileUpload(e, 'atas')} />
    </div>
  );
};

export default App;