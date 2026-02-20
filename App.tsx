import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  LayoutDashboard, Calendar, ChevronRight, UserPlus, 
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, 
  GripVertical, Upload, Save, Lock, Target, FileCheck, BarChart3, 
  PieChart as PieIcon, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, Settings, Camera, UserCircle, History, Filter, MessageSquare, Download, ExternalLink
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// --- CONFIGURAÇÃO SUPABASE INEPAD ---
const supabaseUrl = 'https://jrtrrubtjbinnddqdbta.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydHJydWJ0amJpbm5kZHFkYnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjU2NjksImV4cCI6MjA4NzEwMTY2OX0.J2DNMhNwGlyG3u7L-kd6gW3NC5-EqVSogXyYchQiVyk';
const supabase = createClient(supabaseUrl, supabaseKey);

const App = () => {
  // --- ESTADOS DOS DADOS (NUVEM) ---
  const [users, setUsers] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE SESSÃO E UI ---
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('info');
  const [dashboardFilter, setDashboardFilter] = useState('all');

  // REFS PARA ARQUIVOS
  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);

  const blankMeeting = {
    title: '', status: 'Agendada', date: '', time: '', type: 'Híbrida', link: '', address: '',
    participants: [], pautas: [], materiais: [], deliberacoes: [], acoes: [], atas: []
  };
  const [currentMeeting, setCurrentMeeting] = useState<any>(blankMeeting);

  // --- ESTADOS TEMPORÁRIOS ---
  const [tmpPart, setTmpPart] = useState({ name: '', email: '' });
  const [tmpPauta, setTmpPauta] = useState({ title: '', resp: '', dur: '' });
  const [tmpAcao, setTmpAcao] = useState({ title: '', resp: '', date: '', status: 'Pendente' });
  const [tmpDelib, setTmpDelib] = useState({ title: '', voters: [] as string[] });
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', role: 'Conselheiro', password: '' });

  const isAdm = currentUser?.role === 'Administrador';

  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    fetchInitialData();
  }, []);

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

  // --- FUNÇÃO DE UPLOAD REAL (STORAGE) ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'materiais' | 'atas') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `${type}/${fileName}`;

      // 1. Enviar para o Bucket
      const { data, error } = await supabase.storage
        .from('meeting-files')
        .upload(filePath, file);

      if (error) throw error;

      // 2. Obter URL Pública
      const { data: { publicUrl } } = supabase.storage
        .from('meeting-files')
        .getPublicUrl(filePath);

      // 3. Atualizar Estado
      const newFile = { name: file.name, url: publicUrl, uploadedAt: new Date().toISOString() };
      setCurrentMeeting((prev: any) => ({
        ...prev,
        [type]: [...(prev[type] || []), newFile]
      }));

      addLog('Upload', `Arquivo ${file.name} subido para ${type}`);
      alert("Arquivo enviado com sucesso!");
    } catch (err: any) {
      alert("Erro no upload: " + err.message);
    } finally {
      setLoading(false);
      if (e.target) e.target.value = ''; // Limpa o input
    }
  };

  // --- PERSISTÊNCIA DAS REUNIÕES ---
  const saveMeeting = async () => {
    if (!currentMeeting.title) return alert("O título é obrigatório.");
    
    const { data, error } = await supabase
      .from('meetings')
      .upsert([currentMeeting])
      .select();

    if (!error && data) {
      setMeetings(prev => {
        const index = prev.findIndex(m => m.id === data[0].id);
        if (index !== -1) {
          const newM = [...prev]; newM[index] = data[0]; return newM;
        }
        return [data[0], ...prev];
      });
      setView('list');
      addLog('Salvamento', `Reunião: ${currentMeeting.title}`);
    }
  };

  const deleteMeeting = async (id: string, title: string) => {
    if (window.confirm(`Excluir a reunião "${title}"?`)) {
      const { error } = await supabase.from('meetings').delete().eq('id', id);
      if (!error) {
        setMeetings(prev => prev.filter(m => m.id !== id));
        addLog('Exclusão', `Reunião: ${title}`);
      }
    }
  };

  const updateActionStatus = async (meetingId: string, actionId: number, newStatus: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = meeting.acoes.map((a: any) => a.id === actionId ? { ...a, status: newStatus } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
      if (currentMeeting.id === meetingId) setCurrentMeeting((p: any) => ({ ...p, acoes: newAcoes }));
    }
  };

  // --- CÁLCULOS DASHBOARD ---
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
        { name: 'Atrasadas', value: atrasadas, color: '#ef4444' }
      ],
      barData: filteredM.map(m => ({ name: m.date || 'S/D', 'Itens em Pauta': m.pautas?.length || 0, 'Ações no Plano': m.acoes?.length || 0 }))
    };
  }, [meetings, dashboardFilter]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.email === authForm.email && u.password === authForm.password);
    if (user) { setCurrentUser(user); addLog('Login', 'Acesso ao sistema'); }
    else { alert('Credenciais inválidas.'); }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-10">
          <div className="text-center mb-8"><CheckCircle2 size={48} className="mx-auto mb-2 text-blue-500" /><h1 className="text-2xl font-black italic uppercase">GovCorp</h1></div>
          <form className="space-y-4" onSubmit={handleLogin}>
            <input type="email" placeholder="E-mail" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} />
            <input type="password" placeholder="Senha" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} />
            <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase shadow-lg hover:bg-blue-700 transition-all">Entrar no Painel</button>
          </form>
          <p className="mt-6 text-center text-[10px] font-black text-slate-300 uppercase italic tracking-widest">INEPAD 2001 - 2026</p>
        </div>
      </div>
    );
  }

  let mainContent;

  if (activeMenu === 'dashboard') {
    mainContent = (
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
            <div key={idx} className="bg-white p-6 rounded-3xl border shadow-sm">
                <div className={`w-10 h-10 rounded-2xl mb-4 flex items-center justify-center ${s.c==='blue'?'bg-blue-50 text-blue-600':s.c==='red'?'bg-red-50 text-red-600':s.c==='amber'?'bg-amber-50 text-amber-600':'bg-emerald-50 text-emerald-600'}`}>{s.i}</div>
                <p className="text-[9px] font-black text-slate-400 uppercase italic mb-1">{s.l}</p><p className="text-2xl font-black text-slate-800 tracking-tighter">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[340px]">
          <div className="bg-white p-8 rounded-[40px] border shadow-sm flex flex-col h-full"><h3 className="text-[10px] font-black uppercase mb-6 text-slate-500 italic">Status das Ações</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} innerRadius={50} outerRadius={70} dataKey="value" paddingAngle={5}>{stats.pieData.map((e,i)=>(<Cell key={i} fill={e.color}/>))}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div></div>
          <div className="bg-white p-8 rounded-[40px] border shadow-sm flex flex-col h-full"><h3 className="text-[10px] font-black uppercase mb-6 text-slate-500 italic">Itens vs Ações</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.barData}><CartesianGrid vertical={false} stroke="#f1f5f9"/><XAxis dataKey="name" tick={{fontSize:9}}/><YAxis hide/><Tooltip/><Bar dataKey="Itens em Pauta" fill="#4f46e5" radius={[4,4,0,0]} barSize={20}/><Bar dataKey="Ações no Plano" fill="#10b981" radius={[4,4,0,0]} barSize={20}/></BarChart></ResponsiveContainer></div></div>
        </div>
      </div>
    );
  } else if (activeMenu === 'reunioes') {
    mainContent = view === 'list' ? (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex justify-between items-center"><h1 className="text-2xl font-black italic tracking-tighter">Histórico Cloud</h1><button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">+ Nova Reunião</button></div>
        <div className="grid gap-3">{meetings.map((m:any, idx:number) => (<div key={idx} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-6 rounded-[32px] border flex justify-between items-center group cursor-pointer hover:border-blue-400 shadow-sm transition-all"><div className="flex items-center gap-4"><div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all"><Calendar size={20}/></div><div><h3 className="font-bold italic">{m.title}</h3><p className="text-[9px] font-black text-blue-600 uppercase italic tracking-widest">{m.status} • {m.date || 'S/D'}</p></div></div><div className="flex items-center gap-4">{isAdm && <button onClick={(e)=>{e.stopPropagation(); deleteMeeting(m.id, m.title);}} className="p-2 text-slate-200 hover:text-red-500 transition-all"><Trash2 size={18}/></button>}<ChevronRight size={18}/></div></div>))}</div>
      </div>
    ) : (
      <div className="animate-in fade-in pb-20">
        <div className="flex justify-between items-center mb-8"><button onClick={()=>setView('list')} className="text-slate-400 flex items-center gap-1 text-[10px] font-black uppercase italic"><ChevronRight className="rotate-180" size={16}/> Voltar</button><button onClick={saveMeeting} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center gap-2 hover:bg-black transition-all"><Save size={16}/> Salvar na Nuvem</button></div>
        <input placeholder="Título da Reunião..." className="text-3xl font-black text-slate-800 bg-transparent outline-none w-full italic mb-8 border-b-2 border-slate-100 focus:border-blue-300 pb-2 shadow-none" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} />
        <div className="border-b flex gap-6 mb-8 overflow-x-auto font-black text-[9px] uppercase italic tracking-widest">{['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Plano de Ação', 'Atas'].map((t, i) => (<button key={i} onClick={()=>setTab(['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i])} className={`pb-3 transition-all relative whitespace-nowrap ${tab === ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'][i] ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>{t}</button>))}</div>
        
        {tab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-[32px] border shadow-sm"><h3 className="text-[10px] font-black uppercase mb-4 italic text-slate-400">Participantes</h3><div className="space-y-2 mb-4">{(currentMeeting.participants || []).map((p:any, i:any) => (<div key={i} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-[10px] font-bold italic"><span>{p.name} <span className="text-slate-400">({p.email})</span></span><button onClick={()=>setCurrentMeeting({...currentMeeting, participants: currentMeeting.participants.filter((_:any, idx:any)=>idx!==i)})}><X size={14}/></button></div>))}</div><div className="space-y-2 p-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><input placeholder="Nome" className="w-full p-2 text-xs border rounded-xl" value={tmpPart.name} onChange={e=>setTmpPart({...tmpPart, name:e.target.value})} /><input placeholder="E-mail" className="w-full p-2 text-xs border rounded-xl" value={tmpPart.email} onChange={e=>setTmpPart({...tmpPart, email:e.target.value})} /><button onClick={()=>{if(tmpPart.name){setCurrentMeeting({...currentMeeting, participants:[...(currentMeeting.participants || []), tmpPart]}); setTmpPart({name:'', email:''});}}} className="w-full py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase">Adicionar</button></div></div>
            <div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4 h-fit"><h3 className="text-[10px] font-black uppercase mb-4 italic text-slate-400">Logística</h3><div className="flex gap-2">{['Online', 'Presencial', 'Híbrida'].map(t => (<button key={t} onClick={()=>setCurrentMeeting({...currentMeeting, type: t})} className={`flex-1 py-3 border rounded-xl text-[9px] font-black uppercase transition-all ${currentMeeting.type === t ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>{t}</button>))}</div><div className="grid grid-cols-2 gap-2"><input type="date" value={currentMeeting.date} className="p-3 border rounded-xl text-xs font-bold" onChange={e=>setCurrentMeeting({...currentMeeting, date:e.target.value})} /><input type="time" value={currentMeeting.time} className="p-3 border rounded-xl text-xs font-bold" onChange={e=>setCurrentMeeting({...currentMeeting, time:e.target.value})} /></div><input placeholder={currentMeeting.type==='Online'?"Link":"Endereço"} className="w-full p-3 border rounded-xl text-xs font-bold bg-slate-50 italic outline-none" value={currentMeeting.type === 'Online' ? currentMeeting.link : currentMeeting.address} onChange={e=>setCurrentMeeting({...currentMeeting, [currentMeeting.type==='Online'?'link':'address']:e.target.value})} /></div>
          </div>
        )}

        {tab === 'materiais' && (
          <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-8">
            <div className="flex justify-between items-center border-b pb-4"><h3 className="font-black text-[10px] uppercase italic text-slate-500 tracking-widest">Apoio</h3><button onClick={()=>fileRef.current?.click()} className="bg-blue-600 text-white px-6 py-2 rounded-2xl text-[9px] font-black uppercase shadow-xl hover:scale-105 transition-all"><Upload size={14} className="inline mr-2"/>Subir Arquivo</button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(currentMeeting.materiais || []).map((m:any, i:any) => (
                <div key={i} className="p-5 bg-white rounded-3xl flex items-center gap-4 border shadow-sm group">
                  <FileText size={24} className="text-blue-600"/>
                  <div className="flex-1 text-xs font-bold truncate italic">{m.name}</div>
                  <a href={m.url} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-blue-600"><ExternalLink size={18}/></a>
                  <button onClick={()=>setCurrentMeeting({...currentMeeting, materiais: currentMeeting.materiais.filter((_:any, idx:any)=>idx!==i)})}><Trash2 size={18} className="text-red-300 hover:text-red-500"/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'atas' && (
          <div className="bg-white p-8 rounded-[40px] border shadow-sm animate-in fade-in space-y-8">
            <div className="flex justify-between items-center border-b pb-4"><h3 className="text-[10px] font-black uppercase flex items-center gap-2 italic text-green-700 tracking-widest"><FileCheck size={18}/> Atas Oficiais</h3><button onClick={()=>ataRef.current?.click()} className="bg-green-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase shadow-xl hover:scale-105 transition-all"><Upload size={14} className="inline mr-2"/>Subir Ata Final</button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(currentMeeting.atas || []).map((ata:any, i:any) => (
                <div key={i} className="p-5 bg-green-50 border border-green-100 rounded-[32px] flex items-center gap-4 group shadow-sm">
                  <FileCheck size={28} className="text-green-600"/>
                  <div className="flex-1 min-w-0 font-bold italic"><p className="text-sm text-slate-700 truncate">{ata.name}</p></div>
                  <a href={ata.url} target="_blank" rel="noreferrer" className="p-2 text-green-600"><ExternalLink size={18}/></a>
                  <button onClick={()=>setCurrentMeeting({...currentMeeting, atas: currentMeeting.atas.filter((_:any, idx:any) => idx !== i)})} className="text-red-300 opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* ... OUTRAS ABAS (DELIB, PAUTA, ACOES) SIMPLIFICADAS PARA ESPAÇO ... */}
      </div>
    );
  } else if (activeMenu === 'usuarios') {
    mainContent = (
      <div className="space-y-8 animate-in fade-in"><h1 className="text-2xl font-black italic text-slate-800 tracking-tighter">Membros do Conselho</h1><div className="grid grid-cols-1 md:grid-cols-4 gap-6"><div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4 h-fit sticky top-0"><h3 className="text-[10px] font-black uppercase italic text-slate-400 tracking-widest">Novo Perfil</h3><input placeholder="Nome" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none" value={newUserForm.name} onChange={e=>setNewUserForm({...newUserForm, name: e.target.value})} /><input placeholder="Email" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none" value={newUserForm.email} onChange={e=>setNewUserForm({...newUserForm, email: e.target.value})} /><input type="password" placeholder="Senha" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none" value={newUserForm.password} onChange={e=>setNewUserForm({...newUserForm, password: e.target.value})} /><select className="w-full p-3 border rounded-xl text-[10px] font-black uppercase italic bg-white shadow-sm" value={newUserForm.role} onChange={e=>setNewUserForm({...newUserForm, role: e.target.value})}><option value="Conselheiro">Conselheiro</option><option value="Secretário">Secretário</option><option value="Administrador">Administrador</option></select><button onClick={async ()=>{if(!newUserForm.name || !newUserForm.email) return alert("Erro!"); const { data } = await supabase.from('members').insert([newUserForm]).select(); if(data) { setUsers([...users, data[0]]); alert("Sucesso!"); setNewUserForm({name:'', email:'', role:'Conselheiro', password:''}); }}} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Cadastrar na Nuvem</button></div><div className="md:col-span-3 bg-white rounded-[32px] border shadow-sm overflow-hidden"><table className="w-full text-left font-bold italic text-xs"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b"><tr><th className="p-6">Nome / E-mail</th><th className="p-6 text-center">Perfil</th><th className="p-6 text-center">Ações</th></tr></thead><tbody>{users.map((u:any, i:number) => (<tr key={i} className="border-t hover:bg-slate-50"><td className="p-6 text-xs">{u.name}<p className="text-[9px] text-slate-400 font-black tracking-widest">{u.email}</p></td><td className="p-6 text-center"><span className="bg-slate-50 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase">{u.role}</span></td><td className="p-6 text-center"><button onClick={async ()=>{ if(window.confirm(`Excluir ${u.name}?`)) { const {error} = await supabase.from('members').delete().eq('id', u.id); if(!error) { setUsers(users.filter((x:any)=>x.id!==u.id)); } } }} className="text-red-300 hover:text-red-500 transition-all"><Trash2 size={18}/></button></td></tr>))}</tbody></table></div></div></div>
    );
  } else if (activeMenu === 'auditoria') {
    mainContent = (
      <div className="space-y-6 animate-in fade-in"><div className="flex justify-between items-center"><h1 className="text-xl font-bold flex items-center gap-3 italic"><History className="text-blue-600" /> Log de Auditoria Cloud</h1><button onClick={() => { const h="Data,Usuário,Ação,Detalhes\n"; const r=auditLogs.map(l=>`${new Date(l.log_date).toLocaleString()},${l.username},${l.action},${l.details}`).join("\n"); const b=new Blob([h+r],{type:'text/csv;charset=utf-8;'}); const l=document.createElement("a"); l.href=URL.createObjectURL(b); l.setAttribute("download",`auditoria_inepad.csv`); l.click(); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2"><FileText size={14}/> Exportar CSV</button></div><div className="bg-white rounded-[40px] border shadow-sm overflow-hidden"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-400 uppercase font-bold border-b"><tr><th className="p-6">Data</th><th className="p-6">Usuário</th><th className="p-6">Ação</th><th className="p-6">Detalhes</th></tr></thead><tbody>{auditLogs.map((log:any)=>(<tr key={log.id} className="border-t"><td className="p-6 font-bold text-slate-400">{new Date(log.log_date).toLocaleString()}</td><td className="p-6 text-blue-600 font-bold uppercase">{log.username}</td><td className="p-6"><span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold uppercase text-[9px]">{log.action}</span></td><td className="p-6 text-slate-600 font-bold italic">{log.details}</td></tr>))}</tbody></table></div></div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl shrink-0">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800"><CheckCircle2 className="text-blue-500"/><span className="font-black text-white text-lg uppercase italic tracking-tighter">GovCorp</span></div>
        <nav className="flex-1 p-4 space-y-2 text-[10px] font-black uppercase italic tracking-widest">
          <button onClick={() => setActiveMenu('dashboard')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => {setActiveMenu('reunioes'); setView('list');}} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu === 'reunioes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calendar size={18}/> Reuniões</button>
          {isAdm && <button onClick={() => setActiveMenu('usuarios')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu === 'usuarios' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><UserCog size={18}/> Membros</button>}
          {isAdm && <button onClick={() => setActiveMenu('auditoria')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${activeMenu === 'auditoria' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><History size={18}/> Auditoria</button>}
          <div className="pt-10 border-t border-slate-800"><button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"><LogOut size={18}/> Sair</button></div>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">INEPAD Governança</span>
          <div className="flex gap-4 items-center">
            <div className="text-right"><p className="text-xs font-black text-slate-800 uppercase italic">{currentUser.name}</p><p className="text-[9px] font-bold text-blue-600 uppercase">{currentUser.role}</p></div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 border flex items-center justify-center text-blue-600 font-bold uppercase">{currentUser.name[0]}</div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">{loading ? <div className="h-full flex items-center justify-center font-black text-slate-400 uppercase italic animate-pulse">Sincronizando...</div> : mainContent}</div>
      </main>
      
      {/* INPUTS DE ARQUIVO ESCONDIDOS */}
      <input type="file" ref={fileRef} className="hidden" onChange={(e) => handleFileUpload(e, 'materiais')} />
      <input type="file" ref={ataRef} className="hidden" onChange={(e) => handleFileUpload(e, 'atas')} />
    </div>
  );
};

export default App;