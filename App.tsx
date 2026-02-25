import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  LayoutDashboard, Calendar, ChevronRight, UserPlus, 
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2, 
  Upload, Save, Lock, Target, FileCheck, BarChart3, 
  PieChart as PieIcon, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, Settings, Camera, UserCircle, History, Filter, MessageSquare, Download, ExternalLink, ListChecks, Plus, Edit2, Check, Menu
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const saveMeeting = async () => {
    if (!currentMeeting.title) return alert("O título é obrigatório.");
    const meetingData = { ...currentMeeting };
    if (meetingData.date === "") meetingData.date = null;
    if (meetingData.time === "") meetingData.time = null;
    if (!meetingData.id) delete meetingData.id;

    const { data, error } = await supabase.from('meetings').upsert([meetingData]).select();
    if (error) return alert("Erro: " + error.message);

    if (data) {
      setMeetings(prev => {
        const index = prev.findIndex(m => m.id === data[0].id);
        if (index !== -1) { const newM = [...prev]; newM[index] = data[0]; return newM; }
        return [data[0], ...prev];
      });
      setView('list');
      addLog('Salvamento', `Reunião: ${currentMeeting.title}`);
      alert("Gravado com sucesso!");
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
        { name: 'Em Andamento', value: count('Em andamento'), color: '#D4AF37' },
        { name: 'Pendente', value: count('Pendente'), color: '#4B4B4B' },
        { name: 'Atrasada', value: atrasadas, color: '#991B1B' }
      ],
      barData: filteredM.slice(0,6).map(m => ({ name: m.date || 'S/D', 'Itens': m.pautas?.length || 0, 'Ações': m.acoes?.length || 0 }))
    };
  }, [meetings, dashboardFilter]);

  // Estilos CSS customizados para fontes e efeitos metálicos
  const customStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Montserrat:wght@400;600;800&display=swap');
    .font-serif { font-family: 'Playfair Display', serif; }
    .font-sans { font-family: 'Montserrat', sans-serif; }
    .gold-gradient { background: linear-gradient(135deg, #D4AF37 0%, #F5E396 50%, #C5A028 100%); }
    .gold-text { background: linear-gradient(135deg, #D4AF37 0%, #F5E396 50%, #C5A028 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .gold-border { border-color: #D4AF37; }
    .dark-panel { background-color: #1A1A1A; }
    .lead-panel { background-color: #2C2C2C; }
  `;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center p-4 font-sans">
        <style>{customStyles}</style>
        <div className="w-full max-w-md bg-[#1A1A1A] rounded-[40px] shadow-2xl p-10 border border-[#D4AF37]/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 gold-gradient opacity-50"></div>
          <div className="text-center mb-10">
            <CheckCircle2 size={56} className="mx-auto mb-4 text-[#D4AF37]" />
            <h1 className="text-3xl font-serif font-bold gold-text uppercase tracking-widest italic">INEPAD</h1>
            <p className="text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase mt-2">Governança & Sucessão • 25 Anos</p>
          </div>
          <form className="space-y-4" onSubmit={(e)=>{e.preventDefault(); const u = users.find(u=>u.email===authForm.email && u.password===authForm.password); if(u){setCurrentUser(u); addLog('Login','Acesso');}else alert('Credenciais Inválidas');}}>
            <input type="email" placeholder="E-mail Corporativo" className="w-full p-4 bg-[#2C2C2C] border border-white/5 rounded-2xl outline-none font-bold text-white placeholder:text-slate-600 focus:border-[#D4AF37]/50 transition-all" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} />
            <input type="password" placeholder="Chave de Acesso" className="w-full p-4 bg-[#2C2C2C] border border-white/5 rounded-2xl outline-none text-white placeholder:text-slate-600 focus:border-[#D4AF37]/50 transition-all" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} />
            <button className="w-full gold-gradient text-[#1A1A1A] py-4 rounded-2xl font-black uppercase shadow-lg shadow-[#D4AF37]/20 hover:scale-[1.02] active:scale-[0.98] transition-all">Acessar Plataforma</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col md:flex-row font-sans overflow-hidden text-[#1A1A1A]">
      <style>{customStyles}</style>
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* SIDEBAR PREMIUM */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 dark-panel text-slate-300 flex flex-col shadow-2xl transform transition-transform duration-500 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 flex flex-col items-center border-b border-white/5">
          <h2 className="font-serif text-2xl font-bold gold-text italic tracking-tighter">INEPAD</h2>
          <p className="text-[8px] font-black tracking-[0.4em] text-slate-500 uppercase mt-1">25 ANOS DE SUCESSO</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 text-[10px] font-black uppercase italic tracking-[0.15em]">
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={18}/>, label: 'Estratégia' },
            { id: 'reunioes', icon: <Calendar size={18}/>, label: 'Conselho', action: () => setView('list') },
            { id: 'plano-acao', icon: <ListChecks size={18}/>, label: 'Plano Global' },
            { id: 'usuarios', icon: <UserCog size={18}/>, label: 'Membros', adm: true },
            { id: 'auditoria', icon: <History size={18}/>, label: 'Compliance', adm: true }
          ].map((item) => (
            (!item.adm || isAdm) && (
              <button key={item.id} onClick={() => { setActiveMenu(item.id); if(item.action) item.action(); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-300 ${activeMenu === item.id ? 'bg-[#D4AF37] text-[#1A1A1A] shadow-[0_0_20px_rgba(212,175,55,0.3)]' : 'hover:bg-white/5'}`}>
                {item.icon} {item.label}
              </button>
            )
          ))}
          <div className="pt-10 border-t border-white/5"><button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-4 px-5 py-4 rounded-xl text-red-500/70 hover:bg-red-500/5 transition-all"><LogOut size={18}/> Encerrar Sessão</button></div>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* HEADER */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-slate-600" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic hidden sm:inline">Gestão de Governança Corporativa</span>
          </div>
          <div className="flex gap-4 items-center">
            <div className="text-right hidden xs:block">
              <p className="text-xs font-black text-[#1A1A1A] uppercase italic">{currentUser.name}</p>
              <p className="text-[9px] font-bold text-[#D4AF37] uppercase">{currentUser.role}</p>
            </div>
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center text-[#1A1A1A] font-black uppercase shadow-inner border border-white/20">{currentUser.name[0]}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
          {loading ? (
            <div className="h-full flex items-center justify-center font-black text-[#D4AF37] uppercase italic animate-pulse tracking-widest">Sincronizando com a Nuvem...</div>
          ) : (
            <>
              {activeMenu === 'dashboard' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-3xl font-serif font-bold italic text-[#1A1A1A] tracking-tighter">Visão Estratégica</h1>
                    <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl border shadow-sm w-full sm:w-auto">
                      <Filter size={16} className="text-[#D4AF37]"/><select className="text-[10px] font-black uppercase italic outline-none bg-transparent w-full cursor-pointer" value={dashboardFilter} onChange={e=>setDashboardFilter(e.target.value)}>
                        <option value="all">CONSOLIDADO INEPAD</option>
                        {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[ 
                      {l:'Ações Concluídas', v:stats.concluida, i:<CheckCircle2/>, c:'gold'}, 
                      {l:'Deliberações', v:stats.delibs, i:<FileText/>, c:'lead'}, 
                      {l:'ATAs Oficiais', v:stats.atas, i:<FileCheck/>, c:'gold'}, 
                      {l:'Prioridades Críticas', v:stats.atrasadas, i:<AlertCircle/>, c:'red'} 
                    ].map((s, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                          <div className={`w-12 h-12 rounded-2xl mb-4 flex items-center justify-center ${s.c==='gold'?'gold-gradient text-[#1A1A1A]':'bg-[#2C2C2C] text-[#D4AF37]'}`}>{s.i}</div>
                          <p className="text-[9px] font-black text-slate-400 uppercase italic mb-1 tracking-widest">{s.l}</p>
                          <p className="text-3xl font-black text-[#1A1A1A] tracking-tighter">{s.v}</p>
                          <div className="absolute top-0 right-0 w-24 h-24 bg-[#D4AF37]/5 rounded-full translate-x-12 -translate-y-12 group-hover:scale-110 transition-transform"></div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:h-[380px]">
                    <div className="bg-[#1A1A1A] p-6 md:p-8 rounded-[40px] shadow-2xl flex flex-col h-[320px] lg:h-full border border-white/5">
                      <h3 className="text-[10px] font-black uppercase mb-6 gold-text italic tracking-[0.2em]">Métricas de Governança</h3>
                      <div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} innerRadius={65} outerRadius={85} dataKey="value" paddingAngle={8}>{stats.pieData.map((e,i)=>(<Cell key={i} fill={e.color} stroke="none"/>))}</Pie><Tooltip contentStyle={{backgroundColor:'#1A1A1A', border:'1px solid #D4AF37', borderRadius:'12px', color:'#fff', fontSize:'10px', fontWeight:'bold'}}/><Legend wrapperStyle={{fontSize:'9px', fontWeight:'bold', textTransform:'uppercase', fontStyle:'italic'}}/></PieChart></ResponsiveContainer></div>
                    </div>
                    <div className="bg-white p-6 md:p-8 rounded-[40px] shadow-sm border border-slate-100 flex flex-col h-[320px] lg:h-full">
                      <h3 className="text-[10px] font-black uppercase mb-6 text-slate-400 italic tracking-[0.2em]">Fluxo de Produtividade</h3>
                      <div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.barData}><CartesianGrid vertical={false} stroke="#F1F5F9" strokeDasharray="3 3"/><XAxis dataKey="name" tick={{fontSize:9, fontWeight:800}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip cursor={{fill: '#FDFBF7'}}/><Bar dataKey="Itens" fill="#1A1A1A" radius={[6,6,0,0]} barSize={24}/><Bar dataKey="Ações" fill="#D4AF37" radius={[6,6,0,0]} barSize={24}/></BarChart></ResponsiveContainer></div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 space-y-6 overflow-hidden">
                    <div className="flex justify-between items-center"><h3 className="text-[10px] font-black uppercase italic text-[#1A1A1A] flex items-center gap-3 tracking-[0.2em]"><ListChecks size={20} className="text-[#D4AF37]"/> Ações de Alta Prioridade</h3><button onClick={() => setActiveMenu('plano-acao')} className="text-[9px] font-black text-[#D4AF37] uppercase italic hover:underline hover:scale-105 transition-all">Plano Global →</button></div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-bold italic text-xs min-w-[500px]">
                        <thead className="text-[9px] font-black uppercase text-slate-300 border-b border-slate-50"><tr className="tracking-widest"><th className="pb-6">Ação</th><th className="pb-6">Liderança</th><th className="pb-6 text-center">Status</th></tr></thead>
                        <tbody>{stats.allActions.slice(0, 5).map((acao: any, idx: number) => (
                          <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-[#FDFBF7] transition-all group">
                            <td className="py-5 text-[#1A1A1A] group-hover:pl-2 transition-all">{acao.title}</td>
                            <td className="py-5 text-slate-400 font-black uppercase text-[10px]">{acao.resp}</td>
                            <td className="py-5 text-center"><span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${acao.status === 'Concluída' ? 'bg-emerald-50 text-emerald-600' : 'bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30 shadow-sm'}`}>{acao.status}</span></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* REUNIÕES (LAYOUT PRESERVADO - ESTILO PREMIUM) */}
              {activeMenu === 'reunioes' && (
                view === 'list' ? (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <h1 className="text-3xl font-serif font-bold italic text-[#1A1A1A] tracking-tighter">Histórico de Conselho</h1>
                      <button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="w-full sm:w-auto gold-gradient text-[#1A1A1A] px-8 py-3.5 rounded-2xl font-black text-xs uppercase shadow-xl shadow-[#D4AF37]/20 hover:scale-105 transition-all">+ Agendar Reunião</button>
                    </div>
                    <div className="grid gap-4">{meetings.map((m:any, idx:number) => (
                      <div key={idx} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-7 rounded-[32px] border border-slate-100 flex justify-between items-center group cursor-pointer hover:border-[#D4AF37] transition-all shadow-sm">
                        <div className="flex items-center gap-5">
                          <div className="p-4 bg-[#FDFBF7] text-slate-400 rounded-[20px] group-hover:gold-gradient group-hover:text-[#1A1A1A] transition-all shadow-inner"><Calendar size={24}/></div>
                          <div className="min-w-0"><h3 className="font-serif text-xl font-bold italic text-[#1A1A1A] truncate">{m.title}</h3><p className="text-[10px] font-black text-[#D4AF37] uppercase italic tracking-[0.2em]">{m.status} • {m.date || 'S/D'}</p></div>
                        </div>
                        <div className="flex items-center gap-4"><span className="text-[9px] font-black uppercase text-slate-300 hidden sm:inline tracking-widest">Detalhes</span><ChevronRight size={20} className="text-slate-300 group-hover:text-[#D4AF37] group-hover:translate-x-1 transition-all"/></div>
                      </div>
                    ))}</div>
                  </div>
                ) : (
                  <div className="animate-in fade-in pb-20 duration-500">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
                      <button onClick={()=>setView('list')} className="text-slate-400 flex items-center gap-2 text-[10px] font-black uppercase italic tracking-widest hover:text-[#1A1A1A] transition-all"><ChevronRight className="rotate-180" size={16}/> Histórico</button>
                      <button onClick={saveMeeting} className="w-full sm:w-auto bg-[#1A1A1A] text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase shadow-2xl flex items-center justify-center gap-3 border border-[#D4AF37]/30 hover:bg-black transition-all"><Save size={18} className="text-[#D4AF37]"/> Sincronizar na Nuvem</button>
                    </div>
                    <input placeholder="Título da Sessão Estratégica..." className="text-3xl md:text-5xl font-serif font-bold italic text-[#1A1A1A] bg-transparent outline-none w-full mb-10 border-b-2 border-[#FDFBF7] focus:border-[#D4AF37] pb-4 transition-all" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} />
                    
                    <div className="border-b border-slate-100 flex gap-8 mb-10 overflow-x-auto font-black text-[10px] uppercase italic tracking-widest no-scrollbar py-2">
                      {['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Plano de Ação', 'Atas'].map((label, i) => {
                        const ids = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas'];
                        return <button key={i} onClick={()=>setTab(ids[i])} className={`pb-4 transition-all relative whitespace-nowrap flex items-center gap-2 ${tab === ids[i] ? 'text-[#D4AF37] border-b-2 border-[#D4AF37] scale-105' : 'text-slate-300 hover:text-[#1A1A1A]'}`}>{label}</button>
                      })}
                    </div>
                    
                    {/* CONTEÚDO ABAS (LÓGICA PADRÃO OURO PRESERVADA - ESTILO LUXO) */}
                    {tab === 'info' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in zoom-in-95 duration-500">
                        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-50 pb-6 gap-4"><h3 className="text-[11px] font-black uppercase italic text-[#1A1A1A] tracking-[0.2em] flex items-center gap-2"><UserCheck size={18} className="text-[#D4AF37]"/> Conselheiros & Convidados</h3><button onClick={() => { addLog('Convocação', `Disparo 25 Anos: ${currentMeeting.participants.length} membros`); alert('Convocação enviada com o selo INEPAD 25 Anos!'); }} className="w-full sm:w-auto bg-[#1A1A1A] text-[#D4AF37] px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 border border-[#D4AF37]/30 hover:scale-105 transition-all"><Send size={12}/> Convocar</button></div>
                          <div className="space-y-3">{(currentMeeting.participants || []).map((p:any, i:any) => (
                            <div key={i} className="flex justify-between items-center p-5 bg-[#FDFBF7] rounded-[24px] text-xs font-bold italic border border-slate-100 group">
                              {editingPart === i ? (
                                <div className="flex gap-2 w-full animate-in fade-in">
                                  <input className="flex-1 p-2 border rounded-xl outline-none focus:border-[#D4AF37]" value={p.name} onChange={e=>{const newP=[...currentMeeting.participants]; newP[i].name=e.target.value; setCurrentMeeting({...currentMeeting, participants:newP});}}/>
                                  <input className="flex-1 p-2 border rounded-xl outline-none focus:border-[#D4AF37]" value={p.email} onChange={e=>{const newP=[...currentMeeting.participants]; newP[i].email=e.target.value; setCurrentMeeting({...currentMeeting, participants:newP});}}/>
                                  <button onClick={() => setEditingPart(null)} className="text-emerald-600 p-2"><Check size={20}/></button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-[#1A1A1A] text-[#D4AF37] flex items-center justify-center text-[10px] font-black shadow-sm">{p.name[0]}</div><span>{p.name} <span className="text-slate-400 text-[10px] not-italic ml-2 opacity-0 group-hover:opacity-100 transition-opacity">({p.email})</span></span></div>
                                  <div className="flex gap-2">
                                    <button onClick={()=>setEditingPart(i)} className="p-2 text-slate-300 hover:text-[#D4AF37] transition-all"><Edit2 size={16}/></button>
                                    <button onClick={()=>setCurrentMeeting({...currentMeeting, participants:currentMeeting.participants.filter((_,idx)=>idx!==i)})} className="p-2 text-slate-300 hover:text-red-500 transition-all"><X size={18}/></button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}</div>
                          <div className="p-6 bg-[#FDFBF7] rounded-[32px] border-2 border-dashed border-slate-200 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><input placeholder="Nome Completo" className="w-full p-4 border rounded-2xl text-xs font-bold outline-none focus:border-[#D4AF37]" value={tmpPart.name} onChange={e=>setTmpPart({...tmpPart, name:e.target.value})}/><input placeholder="E-mail Corporativo" className="w-full p-4 border rounded-2xl text-xs font-bold outline-none focus:border-[#D4AF37]" value={tmpPart.email} onChange={e=>setTmpPart({...tmpPart, email:e.target.value})}/></div>
                            <button onClick={()=>{if(tmpPart.name){setCurrentMeeting({...currentMeeting, participants:[...(currentMeeting.participants || []), tmpPart]}); setTmpPart({name:'', email:''});}}} className="w-full py-4 gold-gradient text-[#1A1A1A] rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-[#D4AF37]/10 hover:brightness-105 transition-all">Vincular à Sessão</button>
                          </div>
                        </div>
                        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8 h-fit">
                          <h3 className="text-[11px] font-black uppercase italic text-[#1A1A1A] tracking-[0.2em] border-b border-slate-50 pb-6">Logística & Governança</h3>
                          <div className="flex gap-3">{['Online', 'Presencial', 'Híbrida'].map(t => (<button key={t} onClick={()=>setCurrentMeeting({...currentMeeting, type: t})} className={`flex-1 py-5 border-2 rounded-[24px] text-[10px] font-black uppercase italic transition-all ${currentMeeting.type === t ? 'bg-[#1A1A1A] border-[#D4AF37] text-[#D4AF37] shadow-xl translate-y-[-2px]' : 'bg-[#FDFBF7] border-transparent text-slate-300 hover:border-slate-200'}`}>{t}</button>))}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Data da Sessão</p><input type="date" value={currentMeeting.date} className="w-full p-5 border border-slate-100 rounded-[20px] text-xs font-bold bg-[#FDFBF7] outline-none focus:border-[#D4AF37]" onChange={e=>setCurrentMeeting({...currentMeeting, date:e.target.value})}/></div>
                            <div className="space-y-2"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Horário de Início</p><input type="time" value={currentMeeting.time} className="w-full p-5 border border-slate-100 rounded-[20px] text-xs font-bold bg-[#FDFBF7] outline-none focus:border-[#D4AF37]" onChange={e=>setCurrentMeeting({...currentMeeting, time:e.target.value})}/></div>
                          </div>
                          <div className="space-y-2"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Canal / Endereço</p><input placeholder="..." className="w-full p-5 border border-slate-100 rounded-[20px] text-xs font-bold bg-[#FDFBF7] italic outline-none focus:border-[#D4AF37]" value={currentMeeting.type === 'Online' ? currentMeeting.link : currentMeeting.address} onChange={e=>setCurrentMeeting({...currentMeeting, [currentMeeting.type==='Online'?'link':'address']:e.target.value})} /></div>
                        </div>
                      </div>
                    )}

                    {/* ABAS REESTILIZADAS PARA O PADRÃO 25 ANOS (PRESERVANDO FUNÇÕES) */}
                    {tab === 'pauta' && (
                      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm animate-in fade-in duration-500 space-y-8">
                        <div className="space-y-4">{(currentMeeting.pautas || []).map((p:any, i:any) => (
                          <div key={i} className="flex justify-between items-center p-6 bg-[#FDFBF7] rounded-[28px] border-l-8 border-[#D4AF37] font-bold italic text-xs shadow-sm hover:translate-x-1 transition-all">
                            <div className="min-w-0 flex items-center gap-6">
                              <div className="w-10 h-10 bg-[#1A1A1A] text-[#D4AF37] rounded-xl flex items-center justify-center font-black italic shadow-md">{i+1}</div>
                              <div><span className="text-sm text-[#1A1A1A]">{p.title}</span><p className="text-[#D4AF37] text-[9px] uppercase mt-1 font-black tracking-widest">Liderança: {p.resp} • Duração: {p.dur} MIN</p></div>
                            </div>
                            <button onClick={()=>setCurrentMeeting({...currentMeeting, pautas: currentMeeting.pautas.filter((_, idx)=>idx!==i)})} className="p-3 text-slate-200 hover:text-red-500 transition-all"><Trash2 size={20}/></button>
                          </div>
                        ))}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-8 bg-[#FDFBF7] rounded-[40px] border-2 border-dashed border-slate-200">
                          <input placeholder="Assunto da Pauta" className="sm:col-span-1 p-4 border rounded-2xl text-xs font-bold outline-none focus:border-[#D4AF37]" value={tmpPauta.title} onChange={e=>setTmpPauta({...tmpPauta, title:e.target.value})}/>
                          <select className="p-4 border rounded-2xl text-xs font-bold bg-white outline-none focus:border-[#D4AF37]" value={tmpPauta.resp} onChange={e=>setTmpPauta({...tmpPauta, resp:e.target.value})}><option value="">Responsável...</option>{currentMeeting.participants.map((p:any, i:number) => <option key={i} value={p.name}>{p.name}</option>)}</select>
                          <input placeholder="Minutos" className="p-4 border rounded-2xl text-xs font-bold outline-none focus:border-[#D4AF37]" type="number" value={tmpPauta.dur} onChange={e=>setTmpPauta({...tmpPauta, dur:e.target.value})}/>
                          <button onClick={()=>{if(tmpPauta.title){setCurrentMeeting({...currentMeeting, pautas:[...(currentMeeting.pautas || []), tmpPauta]}); setTmpPauta({title:'', resp:'', dur:''});}}} className="bg-[#1A1A1A] text-[#D4AF37] rounded-2xl text-[10px] font-black uppercase border border-[#D4AF37]/40 shadow-xl hover:bg-black">Adicionar Item</button>
                        </div>
                      </div>
                    )}

                    {tab === 'materiais' && (
                      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm animate-in fade-in duration-500 space-y-10">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-8"><h3 className="font-black text-[11px] uppercase italic text-[#1A1A1A] tracking-[0.3em] flex items-center gap-2">Dossiês & Apoio Estratégico</h3><button onClick={()=>fileRef.current?.click()} className="gold-gradient text-[#1A1A1A] px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:scale-105 transition-all"><Upload size={16} className="inline mr-2"/>Subir Documento</button></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{(currentMeeting.materiais || []).map((m:any, i:any) => (
                          <div key={i} className="p-7 bg-white rounded-[32px] flex flex-col items-center gap-4 border border-slate-50 shadow-sm group hover:border-[#D4AF37] transition-all text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#1A1A1A]"></div>
                            <div className="w-16 h-16 bg-[#FDFBF7] rounded-[24px] flex items-center justify-center text-[#D4AF37] shadow-inner mb-2"><FileText size={32}/></div>
                            <div className="min-w-0 w-full"><p className="text-xs font-bold truncate italic text-[#1A1A1A]">{m.name}</p><p className="text-[9px] font-black uppercase text-slate-300 mt-1 tracking-widest">Base de Conhecimento</p></div>
                            <div className="flex gap-4 w-full justify-center pt-4 border-t border-slate-50">
                              <a href={m.url} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#1A1A1A] text-[#D4AF37] rounded-xl text-[9px] font-black uppercase hover:bg-black"><ExternalLink size={14}/> Abrir</a>
                              <button onClick={()=>setCurrentMeeting({...currentMeeting, materiais: currentMeeting.materiais.filter((_, idx)=>idx!==i)})} className="p-2 text-slate-200 hover:text-red-500 transition-all"><Trash2 size={18}/></button>
                            </div>
                          </div>
                        ))}</div>
                      </div>
                    )}

                    {tab === 'delib' && (
                      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm animate-in fade-in duration-500 space-y-8">
                        <h3 className="text-[11px] font-black uppercase italic text-[#1A1A1A] tracking-[0.3em] flex items-center gap-2"><MessageSquare size={20} className="text-[#D4AF37]"/> Registro Decisório</h3>
                        <div className="space-y-6">{(currentMeeting.deliberacoes || []).map((d:any, i:any) => (
                          <div key={i} className="p-8 bg-[#FDFBF7] rounded-[36px] border border-[#D4AF37]/20 font-bold italic text-sm shadow-sm relative group">
                            <div className="absolute top-6 left-6 w-12 h-12 bg-[#1A1A1A] rounded-2xl flex items-center justify-center text-[#D4AF37] opacity-10 group-hover:opacity-100 transition-opacity"><MessageSquare size={24}/></div>
                            <div className="pl-16"><div className="flex justify-between mb-4"><p className="text-base text-[#1A1A1A] leading-relaxed pr-10">{d.title}</p><button onClick={()=>setCurrentMeeting({...currentMeeting, deliberacoes: currentMeeting.deliberacoes.filter((_, idx)=>idx!==i)})} className="text-slate-300 hover:text-red-500 transition-all"><Trash2 size={22}/></button></div>
                            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100"><span className="text-[9px] font-black uppercase text-[#D4AF37] mt-1 mr-2 tracking-widest italic">Votantes:</span> {d.voters.map((v:string, vi:number) => <span key={vi} className="bg-[#1A1A1A] text-[#D4AF37] px-3 py-1 rounded-full text-[8px] uppercase font-black italic shadow-sm tracking-widest">{v}</span>)}</div></div>
                          </div>
                        ))}</div>
                        <div className="p-10 bg-[#1A1A1A] rounded-[48px] border border-[#D4AF37]/30 space-y-8 shadow-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/5 rounded-full translate-x-32 -translate-y-32"></div>
                          <textarea placeholder="Redija a deliberação estratégica aprovada pelo conselho..." className="w-full p-8 bg-[#2C2C2C] border border-white/5 rounded-[32px] text-sm h-32 italic font-bold outline-none focus:border-[#D4AF37]/50 shadow-inner text-white placeholder:text-slate-600" value={tmpDelib.title} onChange={e=>setTmpDelib({...tmpDelib, title:e.target.value})} />
                          <div className="space-y-4"><p className="text-[10px] font-black uppercase text-[#D4AF37] tracking-[0.3em] italic">Conselheiros Presentes no Voto:</p><div className="flex flex-wrap gap-4 p-6 bg-[#2C2C2C] rounded-[24px] border border-white/5">{currentMeeting.participants.map((p:any, i:number) => (<label key={i} className="flex items-center gap-3 text-[10px] font-black uppercase italic text-slate-400 cursor-pointer hover:text-white transition-all"><input type="checkbox" className="w-5 h-5 rounded-lg accent-[#D4AF37]" checked={tmpDelib.voters.includes(p.name)} onChange={(e) => { if(e.target.checked) setTmpDelib({...tmpDelib, voters: [...tmpDelib.voters, p.name]}); else setTmpDelib({...tmpDelib, voters: tmpDelib.voters.filter(v => v !== p.name)}); }} /> {p.name}</label>))}</div></div>
                          <button onClick={()=>{if(tmpDelib.title){setCurrentMeeting({...currentMeeting, deliberacoes:[...(currentMeeting.deliberacoes || []), tmpDelib]}); setTmpDelib({title:'', voters:[]});}}} className="w-full py-5 gold-gradient text-[#1A1A1A] rounded-[24px] text-[11px] font-black uppercase shadow-xl hover:brightness-110 active:scale-[0.99] transition-all tracking-[0.2em]">Oficializar Decisão do Conselho</button>
                        </div>
                      </div>
                    )}

                    {tab === 'acoes' && (
                      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm animate-in fade-in duration-500 space-y-8">
                        <h3 className="text-[11px] font-black uppercase italic text-[#1A1A1A] tracking-[0.3em] flex items-center gap-2"><Target size={20} className="text-[#D4AF37]"/> Desdobramento de Ações</h3>
                        <div className="space-y-4">{(currentMeeting.acoes || []).map((a:any, i:any) => (
                          <div key={i} className="p-6 bg-[#FDFBF7] rounded-[28px] border border-slate-100 flex justify-between items-center text-xs font-bold italic shadow-sm hover:border-[#D4AF37]/30 transition-all">
                            <div className="flex items-center gap-6"><div className="w-12 h-12 bg-[#1A1A1A] text-[#D4AF37] rounded-2xl flex items-center justify-center shadow-lg"><Target size={24}/></div><div><span className="text-sm text-[#1A1A1A] leading-tight">{a.title}</span><p className="text-[9px] text-slate-400 italic font-black uppercase mt-1 tracking-widest">Executor: {a.resp} • Prazo Fatal: {a.date}</p></div></div>
                            <button onClick={()=>setCurrentMeeting({...currentMeeting, acoes: currentMeeting.acoes.filter((_, idx)=>idx!==i)})}><Trash2 size={20} className="text-slate-200 hover:text-red-500 transition-all"/></button>
                          </div>
                        ))}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-8 bg-[#FDFBF7] rounded-[40px] border-2 border-dashed border-slate-200">
                          <input placeholder="Objetivo da Ação" className="sm:col-span-1 p-4 border rounded-2xl text-xs font-bold italic outline-none focus:border-[#D4AF37]" value={tmpAcao.title} onChange={e=>setTmpAcao({...tmpAcao, title:e.target.value})}/>
                          <select className="p-4 border rounded-2xl text-xs font-bold italic bg-white outline-none focus:border-[#D4AF37]" value={tmpAcao.resp} onChange={e=>setTmpAcao({...tmpAcao, resp:e.target.value})}><option value="">Selecione o Executor...</option>{currentMeeting.participants.map((p:any, i:number) => <option key={i} value={p.name}>{p.name}</option>)}</select>
                          <input type="date" className="p-4 border rounded-2xl text-xs font-bold italic outline-none focus:border-[#D4AF37]" value={tmpAcao.date} onChange={e=>setTmpAcao({...tmpAcao, date:e.target.value})}/>
                          <button onClick={()=>{if(tmpAcao.title){setCurrentMeeting({...currentMeeting, acoes:[...(currentMeeting.acoes || []), {...tmpAcao, id: Date.now()}]}); setTmpAcao({title:'', resp:'', date:'', status:'Pendente'});}}} className="bg-[#1A1A1A] text-[#D4AF37] rounded-2xl text-[10px] font-black uppercase shadow-xl hover:scale-[1.02] transition-all">Vincular Objetivo</button>
                        </div>
                      </div>
                    )}

                    {tab === 'atas' && (
                      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm animate-in fade-in duration-500 space-y-10 text-center">
                        <div className="flex flex-col items-center gap-3 mb-4"><div className="w-20 h-20 gold-gradient text-[#1A1A1A] rounded-[30px] flex items-center justify-center shadow-2xl mb-2"><FileCheck size={40}/></div><h3 className="font-serif text-2xl font-bold italic text-[#1A1A1A]">Registro Histórico (ATAs)</h3><p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em]">Documentos de Fé Pública INEPAD</p></div>
                        <button onClick={()=>ataRef.current?.click()} className="w-full max-w-sm mx-auto bg-[#1A1A1A] text-[#D4AF37] px-10 py-5 rounded-[24px] text-[11px] font-black uppercase shadow-2xl border border-[#D4AF37]/40 flex items-center justify-center gap-4 hover:brightness-110 transition-all"><Upload size={20}/> Subir ATA Oficial Assinada</button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-10 border-t border-slate-50">{(currentMeeting.atas || []).map((ata:any, i:any) => (
                          <div key={i} className="p-7 bg-[#FDFBF7] border border-slate-100 rounded-[32px] flex items-center gap-5 group shadow-sm hover:border-[#D4AF37]/40 transition-all">
                            <div className="w-16 h-16 bg-[#1A1A1A] text-[#D4AF37] rounded-[20px] flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform"><FileCheck size={32}/></div>
                            <div className="flex-1 min-w-0 font-bold italic text-left"><p className="text-sm text-[#1A1A1A] truncate">{ata.name}</p><p className="text-[9px] font-black uppercase text-[#D4AF37] tracking-widest mt-1">ATA Registrada na Nuvem</p></div>
                            <div className="flex flex-col gap-2"><a href={ata.url} target="_blank" rel="noreferrer" className="p-3 text-[#D4AF37] hover:scale-110 transition-all"><ExternalLink size={24}/></a><button onClick={()=>setCurrentMeeting({...currentMeeting, atas: currentMeeting.atas.filter((_, idx) => idx !== i)})} className="p-3 text-slate-200 hover:text-red-500"><Trash2 size={20}/></button></div>
                          </div>
                        ))}</div>
                      </div>
                    )}
                  </div>
                )
              )}

              {/* PLANO GLOBAL, MEMBROS E AUDITORIA - ESTILO PREMIUM PRESERVADO */}
              {activeMenu === 'plano-acao' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"><h1 className="text-3xl font-serif font-bold italic text-[#1A1A1A] tracking-tighter">Plano de Ações Consolidado</h1><button onClick={() => { const h="Ação,Reunião,Responsável,Status\n"; const r=stats.allActions.map(a=>`${a.title},${a.mTitle},${a.resp},${a.status}`).join("\n"); const b=new Blob([h+r],{type:'text/csv;charset=utf-8;'}); const l=document.createElement("a"); l.href=URL.createObjectURL(b); l.setAttribute("download","plano_acao_inepad_25anos.csv"); l.click(); }} className="w-full sm:w-auto bg-[#1A1A1A] text-[#D4AF37] px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-3 border border-[#D4AF37]/30 shadow-xl"><Download size={18}/> Exportar CSV</button></div>
                  <div className="bg-white rounded-[48px] shadow-sm border border-slate-50 overflow-hidden overflow-x-auto">
                    <table className="w-full text-left font-bold italic text-xs min-w-[800px]">
                      <thead className="bg-[#1A1A1A] text-[10px] font-black uppercase text-[#D4AF37] italic tracking-[0.2em]"><tr className="border-b border-white/5"><th className="p-8">Objetivo Estratégico</th><th className="p-8">Origem</th><th className="p-8">Liderança</th><th className="p-8 text-center">Status de Entrega</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">{stats.allActions.map((acao: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#FDFBF7] transition-all text-[#1A1A1A] group">
                          <td className="p-8 group-hover:pl-10 transition-all">{acao.title}</td>
                          <td className="p-8 text-slate-300 text-[10px] tracking-widest">{acao.mTitle}</td>
                          <td className="p-8 text-slate-500 uppercase text-[10px]">{acao.resp}</td>
                          <td className="p-8 text-center">
                            <select value={acao.status} onChange={(e) => updateActionStatusGlobal(acao.mId, acao.id, e.target.value)} className={`p-3 rounded-xl text-[10px] font-black uppercase italic outline-none border border-transparent cursor-pointer transition-all ${acao.status === 'Concluída' ? 'bg-emerald-50 text-emerald-600' : 'bg-[#1A1A1A] text-[#D4AF37] border-[#D4AF37]/30 shadow-sm'}`}>
                              <option value="Pendente">Aguardando</option><option value="Em andamento">Em Execução</option><option value="Concluída">Entregue</option><option value="Atrasada">Crítico / Atrasado</option>
                            </select>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MEMBROS E AUDITORIA COM O MESMO PADRÃO VISUAL */}
              {activeMenu === 'usuarios' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <h1 className="text-3xl font-serif font-bold italic text-[#1A1A1A] tracking-tighter">Membros do Conselho</h1>
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="bg-[#1A1A1A] p-8 rounded-[40px] shadow-2xl space-y-6 h-fit sticky top-0 border border-white/5">
                      <h3 className="text-[11px] font-black uppercase italic gold-text tracking-[0.3em]">Novo Perfil</h3>
                      <input placeholder="Nome Completo" className="w-full p-4 bg-[#2C2C2C] border border-white/5 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#D4AF37]/50" value={newUserForm.name} onChange={e=>setnewUserForm({...newUserForm, name: e.target.value})} />
                      <input placeholder="E-mail" className="w-full p-4 bg-[#2C2C2C] border border-white/5 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#D4AF37]/50" value={newUserForm.email} onChange={e=>setnewUserForm({...newUserForm, email: e.target.value})} />
                      <input type="password" placeholder="Senha" className="w-full p-4 bg-[#2C2C2C] border border-white/5 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#D4AF37]/50" value={newUserForm.password} onChange={e=>setnewUserForm({...newUserForm, password: e.target.value})} />
                      <select className="w-full p-4 border-none rounded-2xl text-[10px] font-black uppercase italic bg-[#2C2C2C] text-white" value={newUserForm.role} onChange={e=>setnewUserForm({...newUserForm, role: e.target.value})}><option value="Conselheiro">Conselheiro</option><option value="Secretário">Secretário</option><option value="Administrador">Administrador</option></select>
                      <button onClick={async ()=>{ const {data} = await supabase.from('members').insert([newUserForm]).select(); if(data) { setUsers([...users, data[0]]); setnewUserForm({name:'', email:'', role:'Conselheiro', password:''}); alert("Membro Integrado!"); } }} className="w-full py-4 gold-gradient text-[#1A1A1A] rounded-2xl font-black text-[11px] uppercase shadow-xl hover:brightness-110">Cadastrar no Sistema</button>
                    </div>
                    <div className="lg:col-span-3 bg-white rounded-[40px] shadow-sm border border-slate-50 overflow-hidden overflow-x-auto">
                      <table className="w-full text-left font-bold italic text-xs min-w-[600px]"><thead className="bg-[#1A1A1A] text-[10px] font-black uppercase text-[#D4AF37] border-b border-white/5"><tr><th className="p-8">Membro / Identificação</th><th className="p-8 text-center">Perfil de Acesso</th><th className="p-8 text-center">Gestão</th></tr></thead><tbody className="divide-y divide-slate-50">{users.map((u:any, i:number) => (<tr key={i} className="hover:bg-[#FDFBF7] transition-all"><td className="p-8"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-[#2C2C2C] text-[#D4AF37] flex items-center justify-center font-black italic">{u.name[0]}</div><div><p className="text-sm text-[#1A1A1A]">{u.name}</p><p className="text-[10px] text-slate-300 font-black tracking-widest">{u.email}</p></div></div></td><td className="p-8 text-center"><span className="bg-[#FDFBF7] px-5 py-2 rounded-xl text-[10px] font-black uppercase border border-[#D4AF37]/10 text-[#D4AF37] shadow-sm">{u.role}</span></td><td className="p-8 text-center"><button onClick={async ()=>{ if(window.confirm(`Remover acesso de ${u.name}?`)) { const {error} = await supabase.from('members').delete().eq('id', u.id); if(!error) setUsers(users.filter((x:any)=>x.id!==u.id)); } }} className="text-slate-200 hover:text-red-500 transition-all"><Trash2 size={22}/></button></td></tr>))}</tbody></table>
                    </div>
                  </div>
                </div>
              )}

              {activeMenu === 'auditoria' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"><h1 className="text-3xl font-serif font-bold italic text-[#1A1A1A] tracking-tighter flex items-center gap-4"><History className="text-[#D4AF37] inline" /> Compliance & Auditoria</h1><button onClick={() => { const h="Data,Usuário,Ação,Detalhes\n"; const r=auditLogs.map(l=>`${new Date(l.log_date).toLocaleString()},${l.username},${l.action},${l.details}`).join("\n"); const b=new Blob([h+r],{type:'text/csv;charset=utf-8;'}); const l=document.createElement("a"); l.href=URL.createObjectURL(b); l.setAttribute("download",`auditoria_inepad_25anos.csv`); l.click(); }} className="w-full sm:w-auto bg-[#1A1A1A] text-[#D4AF37] px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-3 border border-[#D4AF37]/30 shadow-xl"><FileText size={18}/> Exportar Histórico</button></div>
                  <div className="bg-white rounded-[48px] shadow-sm border border-slate-50 overflow-hidden overflow-x-auto"><table className="w-full text-left text-xs min-w-[800px]"><thead className="bg-[#1A1A1A] text-[10px] font-black uppercase text-[#D4AF37] border-b border-white/5"><tr><th className="p-8">Estampa de Tempo</th><th className="p-8">Autor</th><th className="p-8">Evento de Governança</th><th className="p-8">Rastreador</th></tr></thead><tbody className="divide-y divide-slate-50">{auditLogs.map((log:any)=>(<tr key={log.id} className="hover:bg-[#FDFBF7] transition-all"><td className="p-8 font-black text-slate-300 italic text-[11px]">{new Date(log.log_date).toLocaleString()}</td><td className="p-8 text-[#1A1A1A] font-black uppercase text-[11px]">{log.username}</td><td className="p-8"><span className="bg-[#1A1A1A] text-[#D4AF37] px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest border border-[#D4AF37]/20 shadow-sm">{log.action}</span></td><td className="p-8 text-slate-500 font-bold italic">{log.details}</td></tr>))}</tbody></table></div>
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