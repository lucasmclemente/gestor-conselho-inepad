import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  LayoutDashboard, Calendar, ChevronRight, UserPlus, 
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, 
  Upload, Save, Lock, Target, FileCheck, BarChart3, 
  PieChart as PieIcon, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, Settings, Camera, UserCircle, History, Filter, MessageSquare, Download, ExternalLink, ListChecks, Plus, Edit2, Check
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// --- CONFIGURAÇÃO SUPABASE ---
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
  
  const [editingPart, setEditingPart] = useState<number | null>(null);
  const [tmpPart, setTmpPart] = useState({ name: '', email: '' });
  const [tmpPauta, setTmpPauta] = useState({ title: '', resp: '', dur: '' });
  const [tmpAcao, setTmpAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });
  const [tmpDelib, setTmpDelib] = useState({ title: '', voters: [] as string[] });
  const [newUserForm, setnewUserForm] = useState({ name: '', email: '', role: 'Conselheiro', password: '' });

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
      await supabase.storage.from('meeting-files').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('meeting-files').getPublicUrl(filePath);
      const newFile = { name: file.name, url: publicUrl, uploadedAt: new Date().toISOString() };
      setCurrentMeeting((prev: any) => ({ ...prev, [type]: [...(prev[type] || []), newFile] }));
      addLog('Upload', `Arquivo ${file.name} em ${type}`);
    } catch (err: any) { alert("Erro: " + err.message); }
    finally { setLoading(false); if (e.target) e.target.value = ''; }
  };

  // --- FUNÇÃO CORRIGIDA ---
  const saveMeeting = async () => {
    if (!currentMeeting.title) return alert("O título é obrigatório.");
    
    // Remove o ID se ele for nulo ou indefinido para garantir que o Supabase entenda como uma NOVA reunião
    const meetingData = { ...currentMeeting };
    if (!meetingData.id) {
      delete meetingData.id;
    }

    const { data, error } = await supabase
      .from('meetings')
      .upsert([meetingData])
      .select();

    if (error) {
      console.error(error);
      return alert("Erro ao salvar: " + error.message);
    }

    if (data) {
      setMeetings(prev => {
        const index = prev.findIndex(m => m.id === data[0].id);
        if (index !== -1) {
          const newM = [...prev];
          newM[index] = data[0];
          return newM;
        }
        return [data[0], ...prev];
      });
      setView('list');
      addLog('Salvamento', `Reunião: ${currentMeeting.title}`);
      alert("Sucesso na gravação!");
    }
  };

  const updateActionStatusGlobal = async (meetingId: string, actionId: string | number, newStatus: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = meeting.acoes.map((a: any) => a.id === actionId ? { ...a, status: newStatus } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
      addLog('Status', `Ação atualizada para ${newStatus}`);
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
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden text-slate-900">
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
            <div className="h-full flex items-center justify-center font-black text-slate-400 uppercase italic animate-pulse">Sincronizando...</div>
          ) : (
            <>
              {activeMenu === 'dashboard' && (
                <div className="space-y-8 animate-in fade-in">
                  <div className="flex justify-between items-center">
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
                      <div key={idx} className="bg-white p-6 rounded-3xl border shadow-sm">
                          <div className={`w-10 h-10 rounded-2xl mb-4 flex items-center justify-center ${s.c==='blue'?'bg-blue-50 text-blue-600':s.c==='red'?'bg-red-50 text-red-600':s.c==='amber'?'bg-amber-50 text-amber-600':'bg-emerald-50 text-emerald-600'}`}>{s.i}</div>
                          <p className="text-[9px] font-black text-slate-400 uppercase italic mb-1">{s.l}</p><p className="text-2xl font-black text-slate-800 tracking-tighter">{s.v}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[340px]">
                    <div className="bg-white p-8 rounded-[40px] border shadow-sm flex flex-col h-full"><h3 className="text-[10px] font-black uppercase mb-6 text-slate-500 italic">Status das Ações</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} innerRadius={50} outerRadius={70} dataKey="value" paddingAngle={5}>{stats.pieData.map((e,i)=>(<Cell key={i} fill={e.color}/>))}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div></div>
                    <div className="bg-white p-8 rounded-[40px] border shadow-sm flex flex-col h-full"><h3 className="text-[10px] font-black uppercase mb-6 text-slate-500 italic">Itens vs Ações</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.barData}><CartesianGrid vertical={false} stroke="#f1f5f9"/><XAxis dataKey="name" tick={{fontSize:9}}/><YAxis hide/><Tooltip/><Bar dataKey="Itens" fill="#4f46e5" radius={[4,4,0,0]} barSize={20}/><Bar dataKey="Ações" fill="#10b981" radius={[4,4,0,0]} barSize={20}/></BarChart></ResponsiveContainer></div></div>
                  </div>

                  <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-[10px] font-black uppercase italic text-slate-500 tracking-widest flex items-center gap-2"><ListChecks size={18} className="text-blue-600"/> Ações Prioritárias</h3>
                      <button onClick={() => setActiveMenu('plano-acao')} className="text-[9px] font-black text-blue-600 uppercase italic hover:underline">Ver Plano Completo →</button>
                    </div>
                    <div className="overflow-hidden"><table className="w-full text-left font-bold italic text-xs">
                        <thead className="text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="pb-4">Ação</th><th className="pb-4">Responsável</th><th className="pb-4 text-center">Status</th></tr></thead>
                        <tbody>{stats.allActions.slice(0, 5).map((acao: any, idx: number) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-slate-50 transition-all"><td className="py-4">{acao.title}</td><td className="py-4 text-slate-400">{acao.resp}</td><td className="py-4 text-center"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${acao.status === 'Concluída' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{acao.status}</span></td></tr>
                        ))}</tbody>
                    </table></div>
                  </div>
                </div>
              )}

              {activeMenu === 'reunioes' && (
                view === 'list' ? (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center"><h1 className="text-2xl font-black italic tracking-tighter text-slate-800">Histórico de Governança</h1><button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">+ Nova Reunião</button></div>
                    <div className="grid gap-3">{meetings.map((m:any, idx:number) => (<div key={idx} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-6 rounded-[32px] border flex justify-between items-center group cursor-pointer hover:border-blue-400 shadow-sm transition-all"><div className="flex items-center gap-4"><div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all"><Calendar size={20}/></div><div><h3 className="font-bold italic text-slate-800">{m.title}</h3><p className="text-[9px] font-black text-blue-600 uppercase italic tracking-widest">{m.status} • {m.date || 'S/D'}</p></div></div><div className="flex items-center gap-4 text-slate-300 group-hover:text-blue-600"><ChevronRight size={18}/></div></div>))}</div>
                  </div>
                ) : (
                  <div className="animate-in fade-in pb-20">
                    <div className="flex justify-between items-center mb-8"><button onClick={()=>setView('list')} className="text-slate-400 flex items-center gap-1 text-[10px] font-black uppercase italic"><ChevronRight className="rotate-180" size={16}/> Voltar</button><button onClick={saveMeeting} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center gap-2 hover:bg-black transition-all"><Save size={16}/> Salvar na Nuvem</button></div>
                    <input placeholder="Título da Reunião..." className="text-3xl font-black text-slate-800 bg-transparent outline-none w-full italic mb-8 border-b-2 border-slate-100 focus:border-blue-300 pb-2 shadow-none" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} />
                    
                    <div className="border-b flex gap-6 mb-8 overflow-x-auto font-black text-[9px] uppercase italic tracking-widest">
                      {['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Plano de Ação', 'Atas'].map((label, i) => {
                        const ids = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'];
                        return <button key={i} onClick={()=>setTab(ids[i])} className={`pb-3 transition-all relative whitespace-nowrap ${tab === ids[i] ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>{label}</button>
                      })}
                    </div>
                    
                    {tab === 'info' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                        <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
                          <div className="flex justify-between items-center border-b pb-4">
                            <h3 className="text-[10px] font-black uppercase italic text-slate-400 tracking-widest">Participantes Convidados</h3>
                            <button onClick={() => { addLog('Convocação', `Disparo para ${currentMeeting.participants.length} membros`); alert('E-mails de convocação enviados!'); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 hover:bg-black transition-all"><Send size={12}/> Convocar Todos</button>
                          </div>
                          <div className="space-y-2">
                            {(currentMeeting.participants || []).map((p:any, i:any) => (
                              <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl text-xs font-bold italic border border-slate-100">
                                {editingPart === i ? (
                                  <div className="flex gap-2 w-full">
                                    <input className="flex-1 p-1 border rounded" value={p.name} onChange={e => {
                                      const newP = [...currentMeeting.participants]; newP[i].name = e.target.value;
                                      setCurrentMeeting({...currentMeeting, participants: newP});
                                    }} />
                                    <input className="flex-1 p-1 border rounded" value={p.email} onChange={e => {
                                      const newP = [...currentMeeting.participants]; newP[i].email = e.target.value;
                                      setCurrentMeeting({...currentMeeting, participants: newP});
                                    }} />
                                    <button onClick={() => setEditingPart(null)} className="text-emerald-600"><Check size={16}/></button>
                                  </div>
                                ) : (
                                  <>
                                    <span>{p.name} <span className="text-slate-400 text-[10px] not-italic ml-2">({p.email})</span></span>
                                    <div className="flex gap-2">
                                      <button onClick={() => setEditingPart(i)} className="text-slate-400 hover:text-blue-600"><Edit2 size={14}/></button>
                                      <button onClick={()=>setCurrentMeeting({...currentMeeting, participants: currentMeeting.participants.filter((_:any, idx:any)=>idx!==i)})} className="text-red-300 hover:text-red-500"><X size={16}/></button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="p-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 space-y-3">
                            <input placeholder="Nome" className="w-full p-3 border rounded-xl text-xs font-bold" value={tmpPart.name} onChange={e=>setTmpPart({...tmpPart, name:e.target.value})} />
                            <input placeholder="E-mail" className="w-full p-3 border rounded-xl text-xs font-bold" value={tmpPart.email} onChange={e=>setTmpPart({...tmpPart, email:e.target.value})} />
                            <button onClick={()=>{if(tmpPart.name){setCurrentMeeting({...currentMeeting, participants:[...(currentMeeting.participants || []), tmpPart]}); setTmpPart({name:'', email:''});}}} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase">Adicionar</button>
                          </div>
                        </div>
                        <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6 h-fit">
                          <h3 className="text-[10px] font-black uppercase italic text-slate-400 tracking-widest">Logística</h3>
                          <div className="flex gap-2">{['Online', 'Presencial', 'Híbrida'].map(t => (<button key={t} onClick={()=>setCurrentMeeting({...currentMeeting, type: t})} className={`flex-1 py-4 border rounded-2xl text-[9px] font-black uppercase transition-all ${currentMeeting.type === t ? 'bg-blue-600 text-white shadow-xl' : 'bg-slate-50 text-slate-400'}`}>{t}</button>))}</div>
                          <div className="grid grid-cols-2 gap-4">
                            <input type="date" value={currentMeeting.date} className="p-4 border rounded-2xl text-xs font-bold bg-slate-50" onChange={e=>setCurrentMeeting({...currentMeeting, date:e.target.value})} />
                            <input type="time" value={currentMeeting.time} className="p-4 border rounded-2xl text-xs font-bold bg-slate-50" onChange={e=>setCurrentMeeting({...currentMeeting, time:e.target.value})} />
                          </div>
                        </div>
                      </div>
                    )}

                    {tab === 'pauta' && (
                      <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-6">
                        <div className="space-y-3">
                          {(currentMeeting.pautas || []).map((p:any, i:any) => (
                            <div key={i} className="flex justify-between items-center p-5 bg-slate-50 rounded-[24px] border-l-4 border-blue-600 font-bold italic text-xs">
                              <div className="flex items-center gap-4"><span>{p.title}</span><span className="text-slate-400 text-[10px] font-black uppercase ml-4">Resp: {p.resp} • {p.dur} MIN</span></div>
                              <button onClick={()=>setCurrentMeeting({...currentMeeting, pautas: currentMeeting.pautas.filter((_:any, idx:any)=>idx!==i)})}><Trash2 size={18} className="text-red-200"/></button>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                          <input placeholder="Assunto" className="md:col-span-1 p-3 border rounded-xl text-xs font-bold" value={tmpPauta.title} onChange={e=>setTmpPauta({...tmpPauta, title:e.target.value})} />
                          <select className="p-3 border rounded-xl text-xs font-bold bg-white" value={tmpPauta.resp} onChange={e=>setTmpPauta({...tmpPauta, resp:e.target.value})}>
                            <option value="">Responsável...</option>
                            {currentMeeting.participants.map((p:any, i:number) => <option key={i} value={p.name}>{p.name}</option>)}
                          </select>
                          <input placeholder="Tempo" className="p-3 border rounded-xl text-xs font-bold" type="number" value={tmpPauta.dur} onChange={e=>setTmpPauta({...tmpPauta, dur:e.target.value})} />
                          <button onClick={()=>{if(tmpPauta.title){setCurrentMeeting({...currentMeeting, pautas:[...(currentMeeting.pautas || []), tmpPauta]}); setTmpPauta({title:'', resp:'', dur:''});}}} className="bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase">Adicionar</button>
                        </div>
                      </div>
                    )}

                    {tab === 'materiais' && (
                      <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-8">
                        <div className="flex justify-between items-center border-b pb-4"><h3 className="font-black text-[10px] uppercase italic text-slate-500 tracking-widest">Materiais de Apoio</h3><button onClick={()=>fileRef.current?.click()} className="bg-blue-600 text-white px-6 py-2 rounded-2xl text-[9px] font-black uppercase shadow-xl hover:scale-105 transition-all"><Upload size={14} className="inline mr-2"/>Subir Arquivo</button></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(currentMeeting.materiais || []).map((m:any, i:any) => (
                            <div key={i} className="p-6 bg-white rounded-[32px] flex items-center gap-4 border shadow-sm group">
                              <FileText size={24} className="text-blue-600"/><div className="flex-1 text-xs font-bold truncate italic">{m.name}</div>
                              <a href={m.url} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-blue-600"><ExternalLink size={18}/></a>
                              <button onClick={()=>setCurrentMeeting({...currentMeeting, materiais: currentMeeting.materiais.filter((_:any, idx:any)=>idx!==i)})}><Trash2 size={18} className="text-red-200 hover:text-red-500"/></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {tab === 'delib' && (
                      <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-6">
                        <h3 className="text-[10px] font-black uppercase italic text-slate-400 tracking-widest text-amber-600">Registro de Votações</h3>
                        <div className="space-y-4">
                          {(currentMeeting.deliberacoes || []).map((d:any, i:any) => (
                            <div key={i} className="p-6 bg-amber-50 rounded-[32px] border border-amber-100 font-bold italic text-xs shadow-sm">
                              <div className="flex justify-between mb-3"><p className="text-slate-700 leading-relaxed">{d.title}</p><button onClick={()=>setCurrentMeeting({...currentMeeting, deliberacoes: currentMeeting.deliberacoes.filter((_:any, idx:any)=>idx!==i)})} className="text-amber-200 hover:text-amber-600"><X size={20}/></button></div>
                              <div className="flex flex-wrap gap-2"><span className="text-[9px] font-black uppercase text-amber-600">Votantes:</span> {d.voters.map((v:string, vi:number) => <span key={vi} className="bg-white px-2 py-0.5 rounded shadow-sm text-[8px] uppercase">{v}</span>)}</div>
                            </div>
                          ))}
                        </div>
                        <div className="p-8 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200 space-y-4">
                          <textarea placeholder="Texto da deliberação..." className="w-full p-5 border rounded-[24px] text-xs h-24 italic font-bold outline-none focus:border-amber-400 shadow-inner" value={tmpDelib.title} onChange={e=>setTmpDelib({...tmpDelib, title:e.target.value})} />
                          <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase text-slate-400">Votantes:</p>
                            <div className="flex flex-wrap gap-3 p-3 bg-white rounded-xl border">
                              {currentMeeting.participants.map((p:any, i:number) => (
                                <label key={i} className="flex items-center gap-2 text-[10px] cursor-pointer">
                                  <input type="checkbox" checked={tmpDelib.voters.includes(p.name)} onChange={(e) => {
                                    if(e.target.checked) setTmpDelib({...tmpDelib, voters: [...tmpDelib.voters, p.name]});
                                    else setTmpDelib({...tmpDelib, voters: tmpDelib.voters.filter(v => v !== p.name)});
                                  }} /> {p.name}
                                </label>
                              ))}
                            </div>
                          </div>
                          <button onClick={()=>{if(tmpDelib.title){setCurrentMeeting({...currentMeeting, deliberacoes:[...(currentMeeting.deliberacoes || []), tmpDelib]}); setTmpDelib({title:'', voters:[]});}}} className="w-full py-4 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-amber-600">Registrar Voto</button>
                        </div>
                      </div>
                    )}

                    {tab === 'acoes' && (
                      <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-6">
                        <h3 className="text-[10px] font-black uppercase italic text-slate-400 tracking-widest text-emerald-600">Plano de Ação</h3>
                        <div className="space-y-3">
                          {(currentMeeting.acoes || []).map((a:any, i:any) => (
                            <div key={i} className="p-5 bg-emerald-50 rounded-[28px] border border-emerald-100 flex justify-between items-center text-xs font-bold italic">
                              <div><span className="text-emerald-900">{a.title}</span><p className="text-[10px] text-slate-400 italic font-black uppercase mt-1">Quem: {a.resp} • Prazo: {a.date}</p></div>
                              <button onClick={()=>setCurrentMeeting({...currentMeeting, acoes: currentMeeting.acoes.filter((_:any, idx:any)=>idx!==i)})}><Trash2 size={18} className="text-red-200 hover:text-red-500"/></button>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-8 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                          <input placeholder="Ação" className="md:col-span-1 p-3 border rounded-xl text-xs font-bold italic" value={tmpAcao.title} onChange={e=>setTmpAcao({...tmpAcao, title:e.target.value})} />
                          <select className="p-3 border rounded-xl text-xs font-bold italic bg-white" value={tmpAcao.resp} onChange={e=>setTmpAcao({...tmpAcao, resp:e.target.value})}>
                            <option value="">Escolha o responsável...</option>
                            {currentMeeting.participants.map((p:any, i:number) => <option key={i} value={p.name}>{p.name}</option>)}
                          </select>
                          <input type="date" className="p-3 border rounded-xl text-xs font-bold italic" value={tmpAcao.date} onChange={e=>setTmpAcao({...tmpAcao, date:e.target.value})} />
                          <button onClick={()=>{if(tmpAcao.title){setCurrentMeeting({...currentMeeting, acoes:[...(currentMeeting.acoes || []), {...tmpAcao, id: Date.now()}]}); setTmpAcao({title:'', resp:'', date:'', status:'Pendente'});}}} className="bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg">Criar Ação</button>
                        </div>
                      </div>
                    )}

                    {tab === 'atas' && (
                      <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-8">
                        <div className="flex justify-between items-center border-b pb-4"><h3 className="text-[10px] font-black uppercase flex items-center gap-2 italic text-green-700 tracking-widest"><FileCheck size={18}/> Atas Finais</h3><button onClick={()=>ataRef.current?.click()} className="bg-green-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase shadow-xl hover:scale-105 transition-all"><Upload size={14} className="inline mr-2"/>Subir ATA</button></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(currentMeeting.atas || []).map((ata:any, i:any) => (
                            <div key={i} className="p-6 bg-green-50 border border-green-100 rounded-[32px] flex items-center gap-4 group shadow-md transition-all">
                              <FileCheck size={32} className="text-green-600"/><div className="flex-1 min-w-0 font-bold italic"><p className="text-sm text-slate-800 truncate">{ata.name}</p></div>
                              <a href={ata.url} target="_blank" rel="noreferrer" className="p-3 text-green-600"><ExternalLink size={20}/></a>
                              <button onClick={()=>setCurrentMeeting({...currentMeeting, atas: currentMeeting.atas.filter((_:any, idx:any) => idx !== i)})} className="text-red-200 hover:text-red-500"><Trash2 size={20}/></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}

              {activeMenu === 'plano-acao' && (
                <div className="space-y-8 animate-in fade-in">
                  <div className="flex justify-between items-center"><h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Plano de Ação Global</h1><button onClick={() => { const h="Ação,Reunião,Responsável,Status\n"; const r=stats.allActions.map(a=>`${a.title},${a.mTitle},${a.resp},${a.status}`).join("\n"); const b=new Blob([h+r],{type:'text/csv;charset=utf-8;'}); const l=document.createElement("a"); l.href=URL.createObjectURL(b); l.setAttribute("download","plano_acao_inepad.csv"); l.click(); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 hover:bg-black transition-all"><Download size={14}/> Exportar CSV</button></div>
                  <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden">
                    <table className="w-full text-left font-bold italic text-xs"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="p-6">Ação</th><th className="p-6">Reunião de Origem</th><th className="p-6">Responsável</th><th className="p-6 text-center">Status</th></tr></thead>
                      <tbody>{stats.allActions.map((acao: any, idx: number) => (
                        <tr key={idx} className="border-t hover:bg-slate-50 transition-all"><td className="p-6 text-slate-800">{acao.title}</td><td className="p-6 text-slate-400 text-[10px]">{acao.mTitle}</td><td className="p-6 text-slate-600">{acao.resp}</td><td className="p-6 text-center">
                          <select value={acao.status} onChange={(e) => updateActionStatusGlobal(acao.mId, acao.id, e.target.value)} className={`p-2 rounded-xl text-[9px] font-black uppercase italic outline-none border-none cursor-pointer ${acao.status === 'Concluída' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            <option value="Pendente">Pendente</option><option value="Em andamento">Em andamento</option><option value="Concluída">Concluída</option><option value="Atrasada">Atrasada</option>
                          </select>
                        </td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeMenu === 'usuarios' && (
                <div className="space-y-8 animate-in fade-in">
                  <h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Membros</h1>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4 h-fit sticky top-0"><h3 className="text-[10px] font-black uppercase italic text-slate-400 tracking-widest">Novo Perfil</h3><input placeholder="Nome" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none" value={newUserForm.name} onChange={e=>setnewUserForm({...newUserForm, name: e.target.value})} /><input placeholder="E-mail" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none" value={newUserForm.email} onChange={e=>setnewUserForm({...newUserForm, email: e.target.value})} /><input type="password" placeholder="Senha" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none" value={newUserForm.password} onChange={e=>setnewUserForm({...newUserForm, password: e.target.value})} /><select className="w-full p-3 border rounded-xl text-[10px] font-black uppercase italic" value={newUserForm.role} onChange={e=>setnewUserForm({...newUserForm, role: e.target.value})}><option value="Conselheiro">Conselheiro</option><option value="Secretário">Secretário</option><option value="Administrador">Administrador</option></select><button onClick={async ()=>{ const {data} = await supabase.from('members').insert([newUserForm]).select(); if(data) { setUsers([...users, data[0]]); setnewUserForm({name:'', email:'', role:'Conselheiro', password:''}); alert("Membro adicionado!"); } }} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Cadastrar</button></div>
                    <div className="md:col-span-3 bg-white rounded-[32px] border shadow-sm overflow-hidden"><table className="w-full text-left font-bold italic text-xs"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="p-6">Nome / E-mail</th><th className="p-6 text-center">Perfil</th><th className="p-6 text-center">Ações</th></tr></thead><tbody>{users.map((u:any, i:number) => (<tr key={i} className="border-t hover:bg-slate-50"><td className="p-6 text-xs">{u.name}<p className="text-[9px] text-slate-400 font-black tracking-widest">{u.email}</p></td><td className="p-6 text-center"><span className="bg-slate-50 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase">{u.role}</span></td><td className="p-6 text-center"><button onClick={async ()=>{ if(window.confirm(`Excluir ${u.name}?`)) { const {error} = await supabase.from('members').delete().eq('id', u.id); if(!error) setUsers(users.filter((x:any)=>x.id!==u.id)); } }} className="text-red-300 hover:text-red-500 transition-all"><Trash2 size={18}/></button></td></tr>))}</tbody></table></div>
                  </div>
                </div>
              )}

              {activeMenu === 'auditoria' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="flex justify-between items-center"><h1 className="text-xl font-bold italic text-slate-800"><History className="text-blue-600 inline mr-2" /> Auditoria Geral</h1><button onClick={() => { const h="Data,Usuário,Ação,Detalhes\n"; const r=auditLogs.map(l=>`${new Date(l.log_date).toLocaleString()},${l.username},${l.action},${l.details}`).join("\n"); const b=new Blob([h+r],{type:'text/csv;charset=utf-8;'}); const l=document.createElement("a"); l.href=URL.createObjectURL(b); l.setAttribute("download",`auditoria_inepad.csv`); l.click(); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 hover:bg-black transition-all"><FileText size={14}/> Exportar CSV</button></div>
                  <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-400 uppercase font-bold border-b"><tr><th className="p-6">Data</th><th className="p-6">Usuário</th><th className="p-6">Ação</th><th className="p-6">Detalhes</th></tr></thead><tbody>{auditLogs.map((log:any)=>(<tr key={log.id} className="border-t"><td className="p-6 font-bold text-slate-400 italic">{new Date(log.log_date).toLocaleString()}</td><td className="p-6 text-blue-600 font-black uppercase">{log.username}</td><td className="p-6"><span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-black uppercase text-[9px]">{log.action}</span></td><td className="p-6 text-slate-600 font-bold italic">{log.details}</td></tr>))}</tbody></table></div>
                </div>
              )}
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