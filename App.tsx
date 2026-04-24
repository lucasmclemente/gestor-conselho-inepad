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

  useEffect(() => {
    if (currentUser) fetchInitialData();
  }, [currentUser]);

  useEffect(() => {
    let timer: any;
    if (isSessionActive && activePautaIndex !== null) {
      timer = setInterval(() => {
        setTimeElapsed(prev => {
          const newVal = prev + 1;
          const pautas = currentMeeting.pautas || [];
          const pautaAtual = pautas[activePautaIndex];
          const limiteSegundos = (parseInt(pautaAtual?.dur) || 0) * 60;
          if (newVal === limiteSegundos) {
            alert(`⚠️ TEMPO LIMITE ATINGIDO: A pauta "${pautaAtual?.title}" ultrapassou o tempo estipulado.`);
          }
          return newVal;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSessionActive, activePautaIndex, currentMeeting.pautas]);

  const handleFinalizePauta = (index: number) => {
    const minutesSpent = Math.ceil(timeElapsed / 60);
    const newPautas = [...(currentMeeting.pautas || [])];
    newPautas[index] = { ...newPautas[index], realDur: minutesSpent, completed: true };
    setCurrentMeeting({ ...currentMeeting, pautas: newPautas });
    addLog('Pauta Concluída', `${newPautas[index].title} - Gasto: ${minutesSpent}min`);
    if (index + 1 < newPautas.length) {
      setActivePautaIndex(index + 1);
      setTimeElapsed(0);
    } else {
      setActivePautaIndex(null);
      setTimeElapsed(0);
      alert("Fim da Ordem do Dia. Todas as pautas foram discutidas.");
    }
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
    const log = {
        username: currentUser?.name || 'Sistema',
        action,
        details,
        client_id: currentUser?.client_id
    };
    const { data } = await supabase.from('audit_logs').insert([log]).select();
    if (data) setAuditLogs(prev => [data[0], ...prev]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'materiais' | 'atas') => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.client_id}/${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `${type}/${fileName}`;
      await supabase.storage.from('meeting-files').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('meeting-files').getPublicUrl(filePath);
      const newFile = { name: file.name, url: publicUrl, uploadedAt: new Date().toISOString() };
      
      setCurrentMeeting((prev: any) => ({ ...prev, [type]: [...(prev[type] || []), newFile] }));
      addLog('Upload', `Arquivo ${file.name} em ${type}`);

      if (type === 'atas') {
        const participants = currentMeeting.participants || [];
        const emails = participants.map((p: any) => p.email).filter((e: string) => e);

        // Alerta de Governança
        const unregistered = participants.filter((p: any) => !users.find((u: any) => u.email === p.email));
        if (unregistered.length > 0) {
          alert(`Aviso: Os participantes (${unregistered.map((u: any) => u.name).join(', ')}) não possuem cadastro. O relatório de pendências não será gerado para eles.`);
        }

        // LÓGICA DE BUSCA GLOBAL CORRIGIDA
        // 1. Unimos todas as reuniões (histórico + a atual)
        const allMeetingsSource = meetings.some(m => m.id === currentMeeting.id) 
          ? meetings 
          : [currentMeeting, ...meetings];

        const allPendingActions = allMeetingsSource.flatMap((m: any) => 
          (m.acoes || []).map((a: any) => ({ 
            ...a, 
            meetingTitle: m.title || 'Reunião sem Título'
          }))
        ).filter((a: any) => a.status !== 'Concluída');

        const usersToNotify = participants.map((p: any) => ({
          email: p.email,
          name: p.name,
          pendingActions: allPendingActions.filter((a: any) => a.resp === p.name)
        })).filter((u: any) => u.email);

        if (emails.length > 0) {
          try {
            await supabase.functions.invoke('send-minute-notification', {
              body: {
                meetingTitle: currentMeeting.title,
                minuteName: file.name,
                minuteUrl: publicUrl,
                actions: currentMeeting.acoes || [],
                recipients: emails,
                pendingSummary: usersToNotify 
              }
            });
            alert("Ata publicada e avisos enviados!");
          } catch (err) {
            console.error(err);
            alert("Erro ao notificar conselheiros.");
          }
        }
      }
    } catch (err: any) { alert("Erro: " + err.message); }
    finally { setLoading(false); if (e.target) e.target.value = ''; }
  };

  const saveMeeting = async () => {
    if (!canEdit) return;
    if (!currentMeeting.title) return alert("O título é obrigatório.");
    const meetingData = { ...currentMeeting, client_id: currentUser.client_id };
    if (meetingData.date === "") meetingData.date = null;
    if (meetingData.time === "") meetingData.time = null;
    if (!meetingData.id) delete meetingData.id;
    const { data, error } = await supabase.from('meetings').upsert([meetingData]).select();
    if (error) return alert("Erro ao salvar: " + error.message);
    if (data) {
      setMeetings(prev => {
        const index = prev.findIndex(m => m.id === data[0].id);
        if (index !== -1) { const newM = [...prev]; newM[index] = data[0]; return newM; }
        return [data[0], ...prev];
      });
      setView('list');
      addLog('Salvamento', `Reunião: ${currentMeeting.title}`);
      alert("Sucesso na gravação!");
    }
  };

  const saveGlobalAction = async () => {
    if (!canEdit) return;
    if (!tmpGlobalAcao.title || !tmpGlobalAcao.meetingId) return alert("Título e Reunião de Origem são obrigatórios.");
    const targetMeeting = meetings.find(m => m.id === tmpGlobalAcao.meetingId);
    if (!targetMeeting) return;
    const newAction = { id: Date.now(), title: tmpGlobalAcao.title, resp: tmpGlobalAcao.resp, date: tmpGlobalAcao.date, obs: tmpGlobalAcao.obs, status: 'Pendente' };
    const updatedActions = [...(targetMeeting.acoes || []), newAction];
    const { error } = await supabase.from('meetings').update({ acoes: updatedActions }).eq('id', targetMeeting.id);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === targetMeeting.id ? { ...m, acoes: updatedActions } : m));
      setTmpGlobalAcao({ title: '', resp: '', date: '', meetingId: '', obs: '' });
      addLog('Lançamento Direto', `Ação "${newAction.title}" adicionada.`);
      alert("Ação registrada!");
    }
  };

  const deleteMeeting = async (id: string, title: string) => {
    if (!canEdit) return;
    if (!window.confirm(`Deseja excluir "${title}"?`)) return;
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (!error) {
      setMeetings(prev => prev.filter(m => m.id !== id));
      addLog('Exclusão', `Reunião excluída: ${title}`);
    }
  };

  const deleteActionGlobal = async (meetingId: string, actionId: string | number) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).filter((a: any) => a.id !== actionId);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
    }
  };

  const updateActionStatusGlobal = async (meetingId: string, actionId: string | number, newStatus: string) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).map((a: any) => a.id === actionId ? { ...a, status: newStatus } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
    }
  };

  const updateActionDateGlobal = async (meetingId: string, actionId: string | number, newDate: string) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).map((a: any) => a.id === actionId ? { ...a, date: newDate } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
    }
  };

  const updateActionRespGlobal = async (meetingId: string, actionId: string | number, newResp: string) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).map((a: any) => a.id === actionId ? { ...a, resp: newResp } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
    }
  };

  const updateActionOriginGlobal = async (oldMeetingId: string, actionId: string | number, newMeetingId: string) => {
    if (!canEdit || oldMeetingId === newMeetingId) return;
    const oldM = meetings.find(m => m.id === oldMeetingId);
    const newM = meetings.find(m => m.id === newMeetingId);
    if (!oldM || !newM) return;
    const actionToMove = oldM.acoes.find((a: any) => a.id === actionId);
    const filteredOldAcoes = (oldM.acoes || []).filter((a: any) => a.id !== actionId);
    const updatedNewAcoes = [...(newM.acoes || []), actionToMove];
    const { error: err1 } = await supabase.from('meetings').update({ acoes: filteredOldAcoes }).eq('id', oldMeetingId);
    const { error: err2 } = await supabase.from('meetings').update({ acoes: updatedNewAcoes }).eq('id', newMeetingId);
    if (!err1 && !err2) {
      setMeetings(prev => prev.map(m => {
        if (m.id === oldMeetingId) return { ...m, acoes: filteredOldAcoes };
        if (m.id === newMeetingId) return { ...m, acoes: updatedNewAcoes };
        return m;
      }));
      addLog('Transferência', `Ação movida para reunião: ${newM.title}`);
    }
  };

  const updateActionObsGlobal = async (meetingId: string, actionId: string | number, newObs: string) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).map((a: any) => a.id === actionId ? { ...a, obs: newObs } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const totalEstimatedTime = useMemo(() => {
    return (currentMeeting.pautas || []).reduce((acc: number, p: any) => acc + (parseInt(p.dur) || 0), 0);
  }, [currentMeeting.pautas]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const filteredM = dashboardFilter === 'all' ? meetings : meetings.filter(m => m.id === dashboardFilter);
    const allA = filteredM.flatMap(m => (m.acoes || []).map((a:any) => ({ ...a, mTitle: m.title, mId: m.id })))
      .filter(a => (filterResp === 'all' || a.resp === filterResp))
      .filter(a => (filterStatus === 'all' || a.status === filterStatus))
      .filter(a => (filterOrigin === 'all' || a.mId === filterOrigin));

    const count = (st: string) => allA.filter(a => a.status === st).length;
    const atrasadas = allA.filter(a => a.status !== 'Concluída' && a.date && new Date(a.date) < today).length;
    return {
      concluida: `${allA.filter(a => a.status === 'Concluída').length}/${allA.length || 0}`,
      delibs: filteredM.flatMap(m => m.deliberacoes || []).length,
      atas: filteredM.reduce((acc, m) => acc + (m.atas?.length || 0), 0),
      atrasadas,
      allActions: allA,
      pieData: [
        { name: 'Em Andamento', value: count('Em andamento'), color: '#d97706' },
        { name: 'Pendente', value: count('Pendente'), color: '#94a3b8' },
        { name: 'Atrasada', value: atrasadas, color: '#be123c' }
      ],
      barData: filteredM.slice(0,6).map(m => ({ name: m.date || 'S/D', 'Pautas': m.pautas?.length || 0, 'Ações': m.acoes?.length || 0 }))
    };
  }, [meetings, dashboardFilter, filterResp, filterStatus, filterOrigin]);

  const ConvocationModal = () => (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-xl font-bold text-slate-800 italic">Convocação Oficial</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prévia do E-mail de Notificação</p>
          </div>
          <button onClick={() => setIsConvocationOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-400"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30">
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm space-y-6 font-sans">
            <div className="text-center border-b border-slate-100 pb-6">
                <img src="/logo-login.jpg" alt="INEPAD" className="h-12 mx-auto mb-4" />
                <h2 className="text-2xl font-extrabold text-slate-900 italic">{currentMeeting.title}</h2>
                <p className="text-sm text-amber-600 font-bold uppercase tracking-widest mt-2">Pauta e Convocação de Conselho</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase italic">Data e Hora</p>
                <p className="text-sm font-bold text-slate-800">{currentMeeting.date || 'S/D'} às {currentMeeting.time || 'S/H'}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase italic">Localização</p>
                <p className="text-sm font-bold text-slate-800">{currentMeeting.type}</p>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 uppercase mb-3 border-l-4 border-amber-500 pl-2">Programação (Ordem do Dia)</h4>
              <div className="space-y-3">
                {(!currentMeeting.pautas || currentMeeting.pautas.length === 0) ? <p className="text-xs text-slate-400 italic">Nenhuma pauta definida.</p> : 
                  currentMeeting.pautas.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs border-b border-slate-50 pb-2">
                      <span className="text-slate-700 font-bold italic">{i+1}. {p.title}</span>
                      <span className="text-slate-400 font-bold uppercase">{p.dur} min</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 border-t bg-white flex flex-col sm:flex-row gap-3">
          <button disabled={isSendingEmail} onClick={async () => {
              const emails = (currentMeeting.participants || []).map((p: any) => p.email).filter((e: string) => e);
              if (emails.length === 0) return alert("Erro: Não há e-mails.");
              setIsSendingEmail(true);
              try {
                await supabase.functions.invoke('send-invitation', { body: { meetingData: currentMeeting, recipients: emails } });
                alert("Convocações enviadas!");
                setIsConvocationOpen(false);
              } catch (err: any) { alert("Erro: " + err.message); } 
              finally { setIsSendingEmail(false); }
            }}
            className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-bold uppercase text-[10px] tracking-[2px] flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50"
          >
            {isSendingEmail ? "Processando..." : <><Send size={16} className="text-amber-500"/> Disparar Convocações Oficiais</>}
          </button>
        </div>
      </div>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
          <div className="text-center mb-8">
            <img src="/logo-login.jpg" alt="INEPAD" className="h-20 mx-auto mb-4 object-contain" />
            <h1 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Acesso GovCorp</h1>
            <p className="text-xs text-slate-500 mt-2 font-bold">25 ANOS DE GOVERNANÇA</p>
          </div>
          <form className="space-y-4" onSubmit={async (e)=>{
            e.preventDefault();
            setLoading(true);
            const { error: authError } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password });
            if (authError) alert('Erro de Acesso: ' + authError.message);
            setLoading(false);
          }}>
            <input type="email" placeholder="E-mail Corporativo" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold" value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} required />
            <input type="password" placeholder="Senha" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold" value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} required />
            <button disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-lg font-bold uppercase shadow-md transition-all disabled:opacity-50">
                {loading ? 'Validando...' : 'Entrar na Plataforma'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden text-slate-800">
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-slate-300 flex flex-col shadow-xl transition-all duration-300 md:relative transform ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'} ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}`}>
        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="absolute -right-3 top-20 bg-amber-600 text-white rounded-full p-1 shadow-md hidden md:block z-[60] hover:bg-amber-700 transition-colors"><ChevronRight size={16}/></button>
        <div className={`flex flex-col items-center justify-center border-b border-white/5 bg-slate-900/30 transition-all duration-300 ${isSidebarCollapsed ? 'p-4' : 'p-10'}`}><img src={isSidebarCollapsed ? "/favicon.png" : "/logo-sidebar.jpg"} alt="Logo" className={`w-auto object-contain transition-all ${isSidebarCollapsed ? 'h-8' : 'h-12'}`} style={{ mixBlendMode: 'lighten' }} /></div>
        <nav className="flex-1 px-3 py-4 space-y-1 text-[10px] font-bold uppercase tracking-widest">
          {[{ id: 'dashboard', icon: <LayoutDashboard size={18}/>, label: 'Dashboard' }, { id: 'reunioes', icon: <Calendar size={18}/>, label: 'Conselho', action: () => setView('list') }, { id: 'plano-acao', icon: <ListChecks size={18}/>, label: 'Plano de Ação' }, { id: 'usuarios', icon: <UserCog size={18}/>, label: isSuper ? 'Contas' : 'Membros', adm: true }, { id: 'auditoria', icon: <History size={18}/>, label: 'Auditoria', adm: true }].map((item) => (
            (!item.adm || isAdm) && (<button key={item.id} onClick={() => { setActiveMenu(item.id); if(item.action) item.action(); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 rounded-lg transition-all ${activeMenu === item.id ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-slate-700 hover:text-white'} ${isSidebarCollapsed ? 'justify-center p-3' : 'px-4 py-3'}`}><span className="shrink-0">{item.icon}</span>{!isSidebarCollapsed && <span className="truncate">{item.label}</span>}</button>)
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700/50"><button onClick={async () => { await supabase.auth.signOut(); setCurrentUser(null); }} className={`w-full flex items-center gap-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-all text-[10px] font-bold uppercase tracking-widest ${isSidebarCollapsed ? 'justify-center p-3' : 'px-4 py-3'}`}><LogOut size={18}/>{!isSidebarCollapsed && <span>Sair</span>}</button></div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm z-10"><div className="flex items-center gap-4"><button className="md:hidden p-2 text-slate-600" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button><h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">INEPAD Consultoria • Gestão: {currentUser.client_id}</h2></div><div className="flex gap-4 items-center text-right"><div className="hidden xs:block"><p className="text-sm font-bold text-slate-800">{currentUser.name}</p><p className="text-[10px] font-bold text-amber-600 uppercase">{currentUser.role}</p></div><div className="w-10 h-10 rounded-lg bg-slate-900 text-amber-500 flex items-center justify-center font-bold">{currentUser.name[0]}</div></div></header>
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {loading ? (<div className="flex items-center justify-center h-full text-amber-600 font-bold uppercase animate-pulse">Sincronizando...</div>) : (
            <>
              {activeMenu === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="flex justify-between items-center"><h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Estratégia {currentUser.client_id}</h1><div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm"><Filter size={16} className="text-amber-500"/><select className="text-xs font-bold uppercase outline-none bg-transparent cursor-pointer" value={dashboardFilter} onChange={e=>setDashboardFilter(e.target.value)}><option value="all">Consolidado Geral</option>{meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></div></div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">{[ {l:'Concluídas', v:stats.concluida, i:<CheckCircle2/>, c:'amber'}, {l:'Deliberações', v:stats.delibs, i:<FileText/>, c:'slate'}, {l:'Atas na Nuvem', v:stats.atas, i:<FileCheck/>, c:'amber'}, {l:'Em Atraso', v:stats.atrasadas, i:<AlertCircle/>, c:'red'} ].map((s, idx) => (<div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 transition-all hover:shadow-md"><div className={`p-3 rounded-lg ${s.c==='amber'?'bg-amber-100 text-amber-600':s.c==='red'?'bg-red-100 text-red-600':'bg-slate-100 text-slate-500'}`}>{s.i}</div><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.l}</p><p className="text-2xl font-bold text-slate-800 mt-1">{s.v}</p></div></div>))}</div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[350px]"><div className="bg-slate-900 p-6 rounded-xl shadow-xl flex flex-col h-full"><h3 className="text-xs font-bold uppercase text-amber-500 mb-4 tracking-widest italic">Status das Ações</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>{stats.pieData.map((e,i)=>(<Cell key={i} fill={e.color} stroke="none"/>))}</Pie><Tooltip/><Legend wrapperStyle={{fontSize:'10px', textTransform:'uppercase'}}/></PieChart></ResponsiveContainer></div></div><div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full"><h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest italic">Produtividade Recente</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.barData}><CartesianGrid vertical={false} stroke="#f1f5f9"/><XAxis dataKey="name" tick={{fontSize:10, fontWeight:600}}/><YAxis hide/><Tooltip/><Bar dataKey="Pautas" fill="#cbd5e1" radius={[4,4,0,0]} barSize={20}/><Bar dataKey="Ações" fill="#d97706" radius={[4,4,0,0]} barSize={20}/></BarChart></ResponsiveContainer></div></div></div>
                </div>
              )}
              {activeMenu === 'reunioes' && (
                view === 'list' ? (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Conselho Deliberativo</h1>{canEdit && (<button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-md tracking-widest">+ Nova Reunião</button>)}</div>
                    <div className="grid gap-4">{meetings.map((m) => (<div key={m.id} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-6 rounded-xl border border-slate-200 flex justify-between items-center group cursor-pointer hover:border-amber-500 hover:shadow-md transition-all shadow-sm"><div className="flex items-center gap-4"><div className="p-3 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-amber-100 group-hover:text-amber-700 transition-all"><Calendar size={24}/></div><div><h3 className="font-bold text-lg text-slate-800 group-hover:text-amber-600 transition-all italic">{m.title}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.status} • {m.date || 'DATA N/D'}</p></div></div><div className="flex items-center gap-3">{canEdit && (<button onClick={(e) => { e.stopPropagation(); deleteMeeting(m.id, m.title); }} className="p-3 text-slate-200 hover:text-red-600 transition-all hover:bg-red-50 rounded-lg"><Trash2 size={20}/></button>)}<ChevronRight size={20} className="text-slate-300 group-hover:text-amber-500 transition-all"/></div></div>))}</div>
                  </div>
                ) : (
                  <div className="animate-in fade-in duration-300 pb-20">
                    <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-10"><button onClick={()=>setView('list')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><ChevronRight className="rotate-180" size={20}/> Voltar</button>{canEdit && (<button onClick={saveMeeting} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase shadow-sm flex items-center gap-2 transition-all"><Save size={16} className="text-amber-500"/> Salvar</button>)}</div>
                    <input placeholder="Título..." className="text-4xl font-bold italic text-slate-900 bg-transparent outline-none w-full border-b border-slate-200 focus:border-amber-500 pb-2 mb-8" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} readOnly={!canEdit} />
                    <div className="border-b border-slate-200 flex gap-6 mb-8 overflow-x-auto font-bold text-[10px] uppercase tracking-widest no-scrollbar italic py-2">{['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Plano de Ação', 'Atas'].map((label, i) => { const ids = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas']; return <button key={i} onClick={()=>setTab(ids[i])} className={`pb-3 transition-all relative whitespace-nowrap ${tab === ids[i] ? 'text-amber-600 border-b-2 border-amber-600 scale-105' : 'text-slate-400 hover:text-slate-800'}`}>{label}</button> })}</div>
                    {tab === 'info' && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
                        <div className="lg:col-span-2 space-y-6">
                          {canEdit && currentMeeting.id && (<button onClick={() => setIsConvocationOpen(true)} className="w-full py-4 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-700 font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-amber-100 transition-all shadow-sm"><Mail size={18}/> Gerar Convocação Oficial</button>)}
                          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
                            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2 border-b border-slate-50 pb-4"><UserCheck size={16} className="text-amber-600"/> Participantes</h3>
                            <div className="space-y-2">{(currentMeeting.participants || []).map((p:any, i:any) => (
                              <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100 group transition-all hover:bg-white hover:shadow-md font-bold italic">
                                {editingPart === i ? (<div className="flex gap-2 w-full items-center"><input className="flex-1 p-2 border border-slate-200 rounded-md text-sm outline-none bg-white" value={p.name} onChange={e=>{const newP=[...currentMeeting.participants]; newP[i].name=e.target.value; setCurrentMeeting({...currentMeeting, participants:newP});}}/><input className="flex-1 p-2 border border-slate-200 rounded-md text-sm outline-none bg-white" value={p.email} onChange={e=>{const newP=[...currentMeeting.participants]; newP[i].email=e.target.value; setCurrentMeeting({...currentMeeting, participants:newP});}}/><button onClick={() => setEditingPart(null)} className="p-2 text-emerald-600"><Check size={18}/></button></div>) : (<><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center text-xs font-bold shadow-inner">{p.name[0]}</div><div><p className="text-sm text-slate-800">{p.name}</p><p className="text-[10px] text-slate-400 italic">{p.email}</p></div></div>{canEdit && <div className="flex gap-1 opacity-0 group-hover:opacity-100"><button onClick={()=>setEditingPart(i)} className="p-2 text-slate-400 hover:text-amber-600"><Edit2 size={16}/></button><button onClick={()=>setCurrentMeeting({...currentMeeting, participants:(currentMeeting.participants || []).filter((_:any,idx:any)=>idx!==i)})} className="p-2 text-slate-400 hover:text-red-500"><X size={16}/></button></div>}</>)}
                              </div>
                            ))}</div>
                            {canEdit && <div className="p-5 bg-slate-50 rounded-xl border border-dashed border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-4"><input placeholder="Nome" className="p-3 border rounded-lg text-sm bg-white font-bold" value={tmpPart.name} onChange={e=>setTmpPart({...tmpPart, name:e.target.value})}/><input placeholder="E-mail" className="p-3 border rounded-lg text-sm bg-white font-bold" value={tmpPart.email} onChange={e=>setTmpPart({...tmpPart, email:e.target.value})}/><button onClick={()=>{if(tmpPart.name){setCurrentMeeting({...currentMeeting, participants:[...(currentMeeting.participants || []), tmpPart]}); setTmpPart({name:'', email:''});}}} className="w-full sm:col-span-2 py-3 bg-amber-600 text-white rounded-lg text-xs font-bold uppercase">Adicionar</button></div>}
                          </div>
                        </div>
                        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6 h-fit"><h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-50 pb-4">Logística</h3><div className="space-y-4"><div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Data</label><input type="date" value={currentMeeting.date} className="w-full p-3 border rounded-lg text-sm font-bold" onChange={e=>setCurrentMeeting({...currentMeeting, date:e.target.value})} readOnly={!canEdit}/></div><div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Horário</label><input type="time" value={currentMeeting.time} className="w-full p-3 border rounded-lg text-sm font-bold" onChange={e=>setCurrentMeeting({...currentMeeting, time:e.target.value})} readOnly={!canEdit}/></div><div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Tipo</label><select className="w-full p-3 border rounded-lg text-sm font-bold" value={currentMeeting.type} onChange={e=>setCurrentMeeting({...currentMeeting, type:e.target.value})} disabled={!canEdit}><option value="Presencial">Presencial</option><option value="Online">Online</option><option value="Híbrida">Híbrida</option></select></div></div></div>
                      </div>
                    )}
                    {tab === 'pauta' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-6">
                        <div className="flex justify-between items-center bg-slate-900 p-6 rounded-xl shadow-lg gap-4"><div className="flex items-center gap-4"><div className="p-3 bg-amber-600/20 text-amber-500 rounded-lg"><Timer size={24}/></div><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimativa</p><p className="text-2xl font-bold text-white italic">{totalEstimatedTime} min</p></div></div><button onClick={() => setIsSessionActive(!isSessionActive)} className={`px-6 py-3 rounded-lg font-bold text-xs uppercase flex items-center gap-2 ${isSessionActive ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white'}`}>{isSessionActive ? <><Square size={16}/> Parar</> : <><Play size={16}/> Iniciar</>}</button></div>
                        <div className="space-y-2">{(currentMeeting.pautas || []).map((p:any, i:any) => (<div key={i} className={`flex justify-between items-center p-4 border rounded-lg transition-all border-l-4 font-bold italic ${activePautaIndex === i ? 'bg-amber-50 border-amber-500' : 'bg-white border-slate-200'}`}><div className="flex items-center gap-4 flex-1"><span className="text-slate-300">#{i+1}</span><div><p className="text-sm text-slate-800">{p.title}</p><p className="text-[10px] text-slate-500 uppercase">{p.resp} • {p.dur} min</p></div></div><div className="flex items-center gap-2">{isSessionActive && activePautaIndex === i && (<div className="font-mono text-lg text-amber-600">{formatTime(timeElapsed)}</div>)}{isSessionActive && activePautaIndex === i && <button onClick={() => handleFinalizePauta(i)} className="bg-emerald-600 text-white p-2 rounded-md"><Check size={16}/></button>}</div></div>))}</div>
                        {canEdit && (<div className="p-5 bg-slate-50 rounded-xl border border-dashed border-slate-300 grid grid-cols-1 sm:grid-cols-5 gap-4 items-end"><div><input placeholder="Título" className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpPauta.title} onChange={e=>setTmpPauta({...tmpPauta, title:e.target.value})}/></div><div><select className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpPauta.resp} onChange={e=>setTmpPauta({...tmpPauta, resp:e.target.value})}><option value="">Responsável...</option>{(currentMeeting.participants || []).map((p:any, i:number) => <option key={i} value={p.name}>{p.name}</option>)}</select></div><div><input type="number" placeholder="Minutos" className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpPauta.dur} onChange={e=>setTmpPauta({...tmpPauta, dur:e.target.value})}/></div><button onClick={()=>{if(tmpPauta.title){setCurrentMeeting({...currentMeeting, pautas:[...(currentMeeting.pautas || []), tmpPauta]}); setTmpPauta({title:'', resp:'', dur:''});}}} className="h-12 bg-amber-600 text-white rounded-lg flex items-center justify-center shadow-md"><Plus size={24}/></button></div>)}
                      </div>
                    )}
                    {tab === 'atas' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-8"><div className="flex justify-between items-center border-b border-slate-50 pb-4"><h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest">Atas Finais</h3>{canEdit && <button onClick={()=>ataRef.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all"><Upload size={14}/> Carregar</button>}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{(currentMeeting.atas || []).map((ata:any, i:any) => (<div key={i} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center gap-4 group italic font-bold"><div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><FileCheck size={24}/></div><div className="flex-1 truncate text-sm">{ata.name}</div><a href={ata.url} target="_blank" rel="noreferrer" className="text-slate-300 hover:text-amber-600"><ExternalLink size={18}/></a></div>))}</div></div>
                    )}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </main>
      {isConvocationOpen && <ConvocationModal />}
      <input type="file" ref={fileRef} className="hidden" onChange={(e) => handleFileUpload(e, 'materiais')} />
      <input type="file" ref={ataRef} className="hidden" onChange={(e) => handleFileUpload(e, 'atas')} />
    </div>
  );
};

export default App;