import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard, Calendar, ChevronRight, UserPlus,
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2,
  Upload, Save, Lock, Target, FileCheck, BarChart3,
  PieChart as PieIcon, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, Settings, Camera, UserCircle, History, Filter, MessageSquare, Download, ExternalLink, ListChecks, Plus, Edit2, Check, Menu, ChevronUp, ChevronDown, Play, Square, Timer, SkipForward, Building2, ChevronLeft
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
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('info');
  const [dashboardFilter, setDashboardFilter] = useState('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [filterResp, setFilterResp] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOrigin, setFilterOrigin] = useState('all');

  const [isConvocationOpen, setIsConvocationOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);

  const blankMeeting = {
    title: '', status: 'Agendada', date: '', time: '', type: 'Híbrida', link: '', address: '',
    participants: [], pautas: [], materiais: [], deliberacoes: [], acoes: [], atas: []
  };
  const [currentMeeting, setCurrentMeeting] = useState<any>(blankMeeting);
  
  const [editingPart, setEditingPart] = useState<number | null>(null);
  const [editingPauta, setEditingPauta] = useState<number | null>(null);
  const [tmpPart, setTmpPart] = useState({ name: '', email: '' });
  const [tmpPauta, setTmpPauta] = useState({ title: '', resp: '', dur: '' });
  const [tmpAcao, setTmpAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente', obs: '' });
  const [tmpGlobalAcao, setTmpGlobalAcao] = useState({ title: '', resp: '', date: '', meetingId: '', obs: '' });
  const [tmpDelib, setTmpDelib] = useState({ title: '', voters: [] as string[] });
  const [newUserForm, setnewUserForm] = useState({ name: '', email: '', role: 'Conselheiro', password: '', client_id: '' });

  const [activePautaIndex, setActivePautaIndex] = useState<number | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const isSuper = currentUser?.role === 'SuperAdmin';
  const isAdm = currentUser?.role === 'Administrador' || isSuper;
  const isSec = currentUser?.role === 'Secretário';
  const canEdit = isAdm || isSec;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchMemberProfile(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) fetchMemberProfile(session.user.id);
      else setCurrentUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchMemberProfile = async (userId: string) => {
    const { data } = await supabase.from('members').select('id, name, email, role, client_id').eq('id', userId).single();
    if (data) setCurrentUser(data);
  };

  useEffect(() => { if (currentUser) fetchInitialData(); }, [currentUser]);

  useEffect(() => {
    let timer: any;
    if (isSessionActive && activePautaIndex !== null) {
      timer = setInterval(() => {
        setTimeElapsed(prev => {
          const newVal = prev + 1;
          const pautas = currentMeeting.pautas || [];
          const limite = (parseInt(pautas[activePautaIndex]?.dur) || 0) * 60;
          if (newVal === limite) alert("⚠️ TEMPO LIMITE ATINGIDO!");
          return newVal;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSessionActive, activePautaIndex]);

  const handleFinalizePauta = (index: number) => {
    const minutesSpent = Math.ceil(timeElapsed / 60);
    const newPautas = [...(currentMeeting.pautas || [])];
    newPautas[index] = { ...newPautas[index], realDur: minutesSpent, completed: true };
    setCurrentMeeting({ ...currentMeeting, pautas: newPautas });
    addLog('Pauta Concluída', `${newPautas[index].title}`);
    if (index + 1 < newPautas.length) { setActivePautaIndex(index + 1); setTimeElapsed(0); }
    else { setActivePautaIndex(null); setTimeElapsed(0); }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
        let mQuery = supabase.from('meetings').select('*');
        let uQuery = supabase.from('members').select('id, name, email, role, client_id, created_at');
        let lQuery = supabase.from('audit_logs').select('*');
        if (!isSuper) {
            mQuery = mQuery.eq('client_id', currentUser.client_id);
            uQuery = uQuery.eq('client_id', currentUser.client_id);
            lQuery = lQuery.eq('client_id', currentUser.client_id);
        }
        const [mRes, uRes, lRes] = await Promise.all([
          mQuery.order('created_at', { ascending: false }),
          uQuery.order('name'),
          lQuery.order('log_date', { ascending: false }).limit(50)
        ]);
        if (mRes.data) setMeetings(mRes.data);
        if (uRes.data) setUsers(uRes.data);
        if (lRes.data) setAuditLogs(lRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const addLog = async (action: string, details: string) => {
    const log = { username: currentUser?.name || 'Sistema', action, details, client_id: currentUser?.client_id };
    const { data } = await supabase.from('audit_logs').insert([log]).select();
    if (data) setAuditLogs(prev => [data[0], ...prev]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'materiais' | 'atas') => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fileName = `${currentUser.client_id}/${Date.now()}_${file.name}`;
      const filePath = `${type}/${fileName}`;
      await supabase.storage.from('meeting-files').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('meeting-files').getPublicUrl(filePath);
      const newFile = { name: file.name, url: publicUrl, uploadedAt: new Date().toISOString() };
      setCurrentMeeting((prev: any) => ({ ...prev, [type]: [...(prev[type] || []), newFile] }));
      
      if (type === 'atas') {
        // Lógica de notificação simplificada para garantir funcionamento
        const participants = currentMeeting.participants || [];
        const emails = participants.map((p: any) => p.email).filter((e: string) => e);
        if (emails.length > 0) {
          await supabase.functions.invoke('send-minute-notification', {
            body: { meetingTitle: currentMeeting.title, minuteUrl: publicUrl, recipients: emails }
          });
        }
      }
    } catch (err: any) { alert("Erro: " + err.message); }
    finally { setLoading(false); if (e.target) e.target.value = ''; }
  };

  const saveMeeting = async () => {
    if (!canEdit || !currentMeeting.title) return;
    const meetingData = { ...currentMeeting, client_id: currentUser.client_id };
    if (!meetingData.id) delete meetingData.id;
    const { data, error } = await supabase.from('meetings').upsert([meetingData]).select();
    if (data) {
      setMeetings(prev => {
        const idx = prev.findIndex(m => m.id === data[0].id);
        return idx !== -1 ? prev.map(m => m.id === data[0].id ? data[0] : m) : [data[0], ...prev];
      });
      setView('list');
      alert("Salvo com sucesso!");
    }
  };

  const saveGlobalAction = async () => {
    if (!canEdit || !tmpGlobalAcao.title || !tmpGlobalAcao.meetingId) return;
    const target = meetings.find(m => m.id === tmpGlobalAcao.meetingId);
    const newAction = { id: Date.now(), ...tmpGlobalAcao, status: 'Pendente' };
    const updated = [...(target.acoes || []), newAction];
    const { error } = await supabase.from('meetings').update({ acoes: updated }).eq('id', target.id);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === target.id ? { ...m, acoes: updated } : m));
      setTmpGlobalAcao({ title: '', resp: '', date: '', meetingId: '', obs: '' });
    }
  };

  // --- LÓGICA DO DASHBOARD (CORRIGIDA) ---
  const allMeetingsSource = useMemo(() => {
    return currentMeeting?.id ? meetings.map(m => m.id === currentMeeting.id ? currentMeeting : m) : meetings;
  }, [meetings, currentMeeting]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    
    // Define qual lista de reuniões usar com base no filtro do dashboard
    const source = (dashboardFilter === 'all') ? allMeetingsSource : allMeetingsSource.filter(m => m.id === dashboardFilter);

    // Flatten de todas as ações
    const allA = source.flatMap(m => (m.acoes || []).map((a:any) => ({ ...a, mTitle: m.title, mId: m.id })))
      .filter(a => {
        if (filterResp === 'all') return true;
        // Filtro Flexível: Busca parcial para evitar erro entre "Lucas" e "Lucas Clemente"
        const r = (a.resp || "").toLowerCase();
        const f = filterResp.toLowerCase();
        return r.includes(f) || f.includes(r);
      })
      .filter(a => (filterStatus === 'all' || a.status === filterStatus))
      .filter(a => (filterOrigin === 'all' || a.mId === filterOrigin));

    const countStatus = (s: string) => allA.filter(a => a.status === s).length;
    const atrasadas = allA.filter(a => a.status !== 'Concluída' && a.date && new Date(a.date) < today).length;
    
    return {
      concluida: `${allA.filter(a => a.status === 'Concluída').length}/${allA.length || 0}`,
      delibs: source.flatMap(m => m.deliberacoes || []).length,
      atas: source.reduce((acc, m) => acc + (m.atas?.length || 0), 0),
      atrasadas,
      allActions: allA,
      pieData: [
        { name: 'Em Andamento', value: countStatus('Em andamento'), color: '#d97706' },
        { name: 'Pendente', value: countStatus('Pendente'), color: '#94a3b8' },
        { name: 'Atrasada', value: atrasadas, color: '#be123c' }
      ],
      barData: source.slice(0,6).map(m => ({ name: m.date || 'S/D', 'Pautas': m.pautas?.length || 0, 'Ações': m.acoes?.length || 0 }))
    };
  }, [allMeetingsSource, dashboardFilter, filterResp, filterStatus, filterOrigin, activeMenu]);

  // Funções de Gerenciamento Global
  const updateActionStatusGlobal = async (mId: string, aId: any, s: string) => {
    const m = meetings.find(x => x.id === mId);
    const newA = m.acoes.map((a: any) => a.id === aId ? { ...a, status: s } : a);
    await supabase.from('meetings').update({ acoes: newA }).eq('id', mId);
    setMeetings(prev => prev.map(x => x.id === mId ? { ...x, acoes: newA } : x));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      {/* SIDEBAR */}
      <aside className={`bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 flex justify-center border-b border-white/5">
          <img src="/logo-sidebar.jpg" className="h-8 object-contain" style={{ mixBlendMode: 'lighten' }} />
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={20}/>, label: 'Dashboard' },
            { id: 'reunioes', icon: <Calendar size={20}/>, label: 'Conselho' },
            { id: 'plano-acao', icon: <ListChecks size={20}/>, label: 'Plano Global' },
            { id: 'usuarios', icon: <UserCog size={20}/>, label: 'Membros', adm: true }
          ].map(item => (!item.adm || isAdm) && (
            <button key={item.id} onClick={() => setActiveMenu(item.id)} className={`w-full flex items-center gap-3 p-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeMenu === item.id ? 'bg-amber-600 text-white' : 'hover:bg-slate-800'}`}>
              {item.icon} {!isSidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <button onClick={async () => { await supabase.auth.signOut(); setCurrentUser(null); }} className="p-6 text-red-400 flex items-center gap-3 text-xs font-bold uppercase"><LogOut size={20}/> {!isSidebarCollapsed && "Sair"}</button>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shadow-sm">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GovCorp • {currentUser?.client_id}</h2>
          <div className="flex items-center gap-3">
            <div className="text-right"><p className="text-sm font-bold">{currentUser?.name}</p><p className="text-[9px] text-amber-600 font-bold uppercase">{currentUser?.role}</p></div>
            <div className="w-10 h-10 rounded-lg bg-slate-900 text-amber-500 flex items-center justify-center font-bold">{currentUser?.name?.[0]}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {activeMenu === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold italic">Estratégia Corporativa</h1>
                <select className="bg-white border p-2 rounded-lg text-xs font-bold" value={dashboardFilter} onChange={e=>setDashboardFilter(e.target.value)}>
                  <option value="all">Consolidado Geral</option>
                  {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { l: 'Concluídas', v: stats.concluida, i: <CheckCircle2/>, c: 'text-amber-600' },
                  { l: 'Deliberações', v: stats.delibs, i: <FileText/>, c: 'text-slate-600' },
                  { l: 'Atas Online', v: stats.atas, i: <FileCheck/>, c: 'text-amber-600' },
                  { l: 'Atrasadas', v: stats.atrasadas, i: <AlertCircle/>, c: 'text-red-600' }
                ].map((s, i) => (
                  <div key={i} className="bg-white p-6 rounded-xl border shadow-sm flex items-center gap-4">
                    <div className={`p-3 rounded-lg bg-slate-50 ${s.c}`}>{s.i}</div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase">{s.l}</p><p className="text-2xl font-bold">{s.v}</p></div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-80">
                <div className="bg-slate-900 p-6 rounded-xl shadow-lg"><ResponsiveContainer><PieChart><Pie data={stats.pieData} innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>{stats.pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div>
                <div className="bg-white p-6 rounded-xl border shadow-sm"><ResponsiveContainer><BarChart data={stats.barData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{fontSize: 10}}/><YAxis hide/><Tooltip/><Bar dataKey="Pautas" fill="#cbd5e1" radius={[4,4,0,0]}/><Bar dataKey="Ações" fill="#d97706" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
              </div>
            </div>
          )}

          {activeMenu === 'reunioes' && (
            view === 'list' ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center"><h1 className="text-2xl font-bold italic">Conselho Deliberativo</h1><button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details');}} className="bg-amber-600 text-white px-6 py-2 rounded-lg font-bold text-xs uppercase">+ Nova</button></div>
                {meetings.map(m => (
                  <div key={m.id} onClick={()=>{setCurrentMeeting(m); setView('details');}} className="bg-white p-5 rounded-xl border flex justify-between items-center cursor-pointer hover:border-amber-500 transition-all">
                    <div className="flex items-center gap-4"><Calendar className="text-slate-400"/><h3 className="font-bold">{m.title}</h3></div>
                    <ChevronRight className="text-slate-300"/>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center"><button onClick={()=>setView('list')} className="text-xs font-bold uppercase flex items-center gap-2"><ChevronLeft/> Voltar</button><button onClick={saveMeeting} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold text-xs uppercase">Salvar Reunião</button></div>
                <input className="text-3xl font-bold italic w-full border-b outline-none bg-transparent" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})}/>
                
                <div className="flex gap-4 border-b">
                  {['info', 'pauta', 'acoes', 'atas'].map(t => <button key={t} onClick={()=>setTab(t)} className={`pb-2 text-[10px] font-bold uppercase tracking-widest ${tab === t ? 'border-b-2 border-amber-600 text-amber-600' : 'text-slate-400'}`}>{t}</button>)}
                </div>

                {tab === 'acoes' && (
                  <div className="space-y-4 bg-white p-6 rounded-xl border">
                    <div className="space-y-2">
                      {(currentMeeting.acoes || []).map((a: any, i: number) => (
                        <div key={i} className="p-3 border-l-4 border-emerald-500 bg-slate-50 flex justify-between">
                          <div><p className="font-bold">{a.title}</p><p className="text-[10px] text-slate-400">{a.resp} • {a.date}</p></div>
                          <button onClick={()=>setCurrentMeeting({...currentMeeting, acoes: currentMeeting.acoes.filter((_:any,idx:any)=>idx!==i)})}><Trash2 size={16} className="text-red-300"/></button>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-12 gap-2 p-4 border border-dashed rounded-lg">
                      <input className="col-span-6 p-2 border rounded text-xs" placeholder="Nova Ação" value={tmpAcao.title} onChange={e=>setTmpAcao({...tmpAcao, title: e.target.value})}/>
                      {/* TRAVA DE RESPONSÁVEL: Select baseado nos participantes */}
                      <select className="col-span-3 p-2 border rounded text-xs" value={tmpAcao.resp} onChange={e=>setTmpAcao({...tmpAcao, resp: e.target.value})}>
                        <option value="">Responsável...</option>
                        {currentMeeting.participants?.map((p: any, i: number) => <option key={i} value={p.name}>{p.name}</option>)}
                      </select>
                      <input type="date" className="col-span-2 p-2 border rounded text-xs" value={tmpAcao.date} onChange={e=>setTmpAcao({...tmpAcao, date: e.target.value})}/>
                      <button onClick={()=>{if(tmpAcao.title && tmpAcao.resp) {setCurrentMeeting({...currentMeeting, acoes: [...(currentMeeting.acoes || []), {...tmpAcao, id: Date.now()}]}); setTmpAcao({title:'', resp:'', date:'', status:'Pendente', obs:''});}}} className="col-span-1 bg-amber-600 text-white rounded flex items-center justify-center"><Plus/></button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {activeMenu === 'plano-acao' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold italic">Plano Global de Ações</h1>
              <div className="flex gap-3 bg-white p-4 rounded-xl border shadow-sm">
                <select className="text-[10px] font-bold uppercase p-2 border rounded" value={filterResp} onChange={e=>setFilterResp(e.target.value)}>
                  <option value="all">Filtrar Responsável</option>
                  {[...new Set(allMeetingsSource.flatMap(m => (m.acoes || []).map((a: any) => a.resp)))].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs font-bold italic">
                  <thead className="bg-slate-900 text-amber-500 uppercase tracking-widest">
                    <tr><th className="p-4">Iniciativa</th><th className="p-4">Responsável</th><th className="p-4">Origem</th><th className="p-4">Status</th></tr>
                  </thead>
                  <tbody>
                    {stats.allActions.map((a: any, i: number) => (
                      <tr key={i} className="border-b hover:bg-slate-50">
                        <td className="p-4">{a.title}</td>
                        <td className="p-4">{a.resp}</td>
                        <td className="p-4 text-slate-400">{a.mTitle}</td>
                        <td className="p-4">
                          <select className="bg-amber-50 text-amber-700 p-1 rounded" value={a.status} onChange={e=>updateActionStatusGlobal(a.mId, a.id, e.target.value)}>
                            <option value="Pendente">Pendente</option>
                            <option value="Em andamento">Execução</option>
                            <option value="Concluída">Finalizado</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <input type="file" ref={fileRef} className="hidden" onChange={e => handleFileUpload(e, 'materiais')} />
      <input type="file" ref={ataRef} className="hidden" onChange={e => handleFileUpload(e, 'atas')} />
    </div>
  );
};

export default App;