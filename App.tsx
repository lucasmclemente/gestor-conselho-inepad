import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard, Calendar, ChevronRight, UserPlus,
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2,
  Upload, Save, Lock, Target, FileCheck, BarChart3,
  PieChart as PieIcon, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, Settings, Camera, UserCircle, History, Filter, MessageSquare, Download, ExternalLink, ListChecks, Plus, Edit2, Check, Menu, ChevronUp, ChevronDown, Play, Square, Timer, SkipForward, Building2, ChevronLeft, UserMinus
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

  // Estados para Filtros do Plano Global
  const [filterResp, setFilterResp] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOrigin, setFilterOrigin] = useState('all');

  // Estados para Convocação
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
  const [tmpPart, setTmpPart] = useState({ name: '', email: '', isExternal: false });
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

  // --- LOGICA DE SESSÃO (SUPABASE AUTH) ---
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
    const { data } = await supabase
      .from('members')
      .select('id, name, email, role, client_id')
      .eq('id', userId)
      .single();
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

        // --- SCAN GLOBAL DE PENDÊNCIAS ---
        const allPendingActions = meetings.flatMap((m: any) => 
          (m.acoes || []).map((a: any) => ({ 
            ...a, 
            meetingTitle: m.title 
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
            alert("Ata publicada e relatórios de pendências globais enviados!");
          } catch (notificationError) {
            console.error("Erro no disparo:", notificationError);
            alert("Ata publicada, mas não conseguimos disparar os avisos de pendências.");
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

            {currentMeeting.materiais?.length > 0 && (
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 uppercase mb-3 border-l-4 border-amber-500 pl-2">Documentação de Apoio</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentMeeting.materiais.map((m: any, i: number) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-3">
                      <FileText size={16} className="text-amber-600" />
                      <span className="text-[10px] font-bold text-slate-600 truncate">{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-6 text-center border-t border-slate-100">
              <p className="text-[10px] text-slate-400 italic">Sua presença é essencial para o quórum deliberativo.</p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-white flex flex-col sm:flex-row gap-3">
          <button 
            disabled={isSendingEmail}
            onClick={async () => {
              const emails = (currentMeeting.participants || []).map((p: any) => p.email).filter((e: string) => e);
              
              if (emails.length === 0) {
                return alert("Erro: Não há participantes com e-mail cadastrado nesta reunião.");
              }

              setIsSendingEmail(true);
              try {
                const { data, error } = await supabase.functions.invoke('send-invitation', {
                  body: {
                    meetingData: currentMeeting,
                    recipients: emails
                  }
                });

                if (error) throw error;

                addLog('Convocação', `E-mails oficiais enviados para ${emails.length} membros.`);
                alert("Convocações enviadas com sucesso via Resend!");
                setIsConvocationOpen(false);
              } catch (err: any) {
                console.error(err);
                alert("Erro ao disparar e-mails: " + err.message);
              } finally {
                setIsSendingEmail(false);
              }
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
            
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
              email: authForm.email,
              password: authForm.password,
            });
            
            if (authError) {
              alert('Erro de Acesso: ' + authError.message);
            } else if (authData?.user) { 
              addLog('Login', `Usuário autenticado via Auth: ${authData.user.email}`); 
            }
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
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-20 bg-amber-600 text-white rounded-full p-1 shadow-md hidden md:block z-[60] hover:bg-amber-700 transition-colors"
        >
          {isSidebarCollapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
        </button>

        <div className={`flex flex-col items-center justify-center border-b border-white/5 bg-slate-900/30 transition-all duration-300 ${isSidebarCollapsed ? 'p-4' : 'p-10'}`}>
            <img 
              src={isSidebarCollapsed ? "/favicon.png" : "/logo-sidebar.jpg"} 
              alt="INEPAD Logo" 
              className={`w-auto object-contain transition-all ${isSidebarCollapsed ? 'h-8' : 'h-12'}`} 
              style={{ mixBlendMode: 'lighten' }} 
            />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 text-[10px] font-bold uppercase tracking-widest">
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={18}/>, label: 'Dashboard' },
            { id: 'reunioes', icon: <Calendar size={18}/>, label: 'Conselho', action: () => setView('list') },
            { id: 'plano-acao', icon: <ListChecks size={18}/>, label: 'Plano de Ação' },
            { id: 'usuarios', icon: <UserCog size={18}/>, label: isSuper ? 'Contas de Clientes' : 'Membros', adm: true },
            { id: 'auditoria', icon: <History size={18}/>, label: 'Auditoria', adm: true }
          ].map((item) => (
            (!item.adm || isAdm) && (
              <button 
                key={item.id} 
                onClick={() => { setActiveMenu(item.id); if(item.action) item.action(); setIsMobileMenuOpen(false); }} 
                className={`w-full flex items-center gap-3 rounded-lg transition-all ${activeMenu === item.id ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-slate-700 hover:text-white'} ${isSidebarCollapsed ? 'justify-center p-3' : 'px-4 py-3'}`}
                title={isSidebarCollapsed ? item.label : ''}
              >
                <span className="shrink-0">{item.icon}</span>
                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            )
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700/50">
            <button 
              onClick={async () => {
                 await supabase.auth.signOut();
                 setCurrentUser(null);
              }} 
              className={`w-full flex items-center gap-3 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all text-[10px] font-bold uppercase tracking-widest ${isSidebarCollapsed ? 'justify-center p-3' : 'px-4 py-3'}`}
              title={isSidebarCollapsed ? 'Sair' : ''}
            >
              <LogOut size={18}/>
              {!isSidebarCollapsed && <span>Sair</span>}
            </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-slate-600" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button>
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">INEPAD Consultoria • {isSuper ? 'GESTÃO MASTER' : `Gestão: ${currentUser.client_id}`}</h2>
          </div>
          <div className="flex gap-4 items-center">
            <div className="text-right hidden xs:block">
              <p className="text-sm font-bold text-slate-800 leading-tight">{currentUser.name}</p>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{currentUser.role}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-900 text-amber-500 flex items-center justify-center font-bold border border-white/10 shadow-lg">{currentUser.name[0]}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-full text-amber-600 font-bold uppercase animate-pulse">Sincronizando...</div>
          ) : (
            <>
              {activeMenu === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Estratégia {isSuper ? 'INEPAD' : currentUser.client_id}</h1>
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-slate-200 w-full sm:w-auto shadow-sm">
                      <Filter size={16} className="text-amber-500"/><select className="text-xs font-bold uppercase outline-none bg-transparent w-full cursor-pointer text-slate-600" value={dashboardFilter} onChange={e=>setDashboardFilter(e.target.value)}>
                        <option value="all">Consolidado Geral</option>
                        {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[ {l:'Concluídas', v:stats.concluida, i:<CheckCircle2/>, c:'amber'}, {l:'Deliberações', v:stats.delibs, i:<FileText/>, c:'slate'}, {l:'Atas na Nuvem', v:stats.atas, i:<FileCheck/>, c:'amber'}, {l:'Em Atraso', v:stats.atrasadas, i:<AlertCircle/>, c:'red'} ].map((s, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 transition-all hover:shadow-md">
                          <div className={`p-3 rounded-lg ${s.c==='amber'?'bg-amber-100 text-amber-600':s.c==='red'?'bg-red-100 text-red-600':'bg-slate-100 text-slate-500'}`}>{s.i}</div>
                          <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.l}</p><p className="text-2xl font-bold text-slate-800 mt-1">{s.v}</p></div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[350px]">
                    <div className="bg-slate-900 p-6 rounded-xl shadow-xl flex flex-col h-full"><h3 className="text-xs font-bold uppercase text-amber-500 mb-4 tracking-widest italic">Status das Ações</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie chart-id="status-pie" data={stats.pieData} innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>{stats.pieData.map((e,i)=>(<Cell key={i} fill={e.color} stroke="none"/>))}</Pie><Tooltip/><Legend wrapperStyle={{fontSize:'10px', textTransform:'uppercase'}}/></PieChart></ResponsiveContainer></div></div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full"><h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest italic">Produtividade Recente</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.barData}><CartesianGrid vertical={false} stroke="#f1f5f9"/><XAxis dataKey="name" tick={{fontSize:10, fontWeight:600}}/><YAxis hide/><Tooltip/><Bar dataKey="Pautas" fill="#cbd5e1" radius={[4,4,0,0]} barSize={20}/><Bar dataKey="Ações" fill="#d97706" radius={[4,4,0,0]} barSize={20}/></BarChart></ResponsiveContainer></div></div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center"><h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest italic flex items-center gap-2"><ListChecks size={16} className="text-amber-600"/> Resumo do Plano de Ação</h3></div>
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm font-bold italic"><thead className="bg-slate-900 text-[10px] font-bold uppercase text-amber-500 tracking-widest"><tr><th className="px-6 py-4">Iniciativa</th><th className="px-6 py-4">Responsável</th><th className="px-6 py-4">Origem</th><th className="px-6 py-4 text-center">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{stats.allActions.length === 0 ? (<tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 uppercase text-[10px]">Nenhuma ação pendente</td></tr>) : (stats.allActions.slice(0, 5).map((acao: any, idx: any) => (<tr key={`${acao.mId}-${acao.id}`} className="hover:bg-slate-50 transition-all border-l-4 border-l-transparent hover:border-l-amber-500"><td className="px-6 py-4 text-slate-800">{acao.title}</td><td className="px-6 py-4 text-slate-600">{acao.resp || 'N/D'}</td><td className="px-6 py-4 text-slate-400 text-[10px] uppercase tracking-widest">{acao.mTitle}</td><td className="px-6 py-4 text-center"><span className={`px-3 py-1 rounded-full text-[9px] uppercase font-bold ${acao.status === 'Concluída' ? 'bg-emerald-100 text-emerald-700' : acao.status === 'Em andamento' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{acao.status}</span></td></tr>)))}</tbody></table></div>
                  </div>
                </div>
              )}

              {activeMenu === 'reunioes' && (
                view === 'list' ? (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Conselho Deliberativo</h1>{canEdit && (<button onClick={()=>{setCurrentMeeting(blankMeeting); setView('details'); setTab('info');}} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all shadow-md tracking-widest">+ Nova Reunião</button>)}</div>
                    <div className="grid gap-4">{meetings.map((m, idx) => (<div key={m.id} onClick={()=>{setCurrentMeeting(m); setView('details'); setTab('info');}} className="bg-white p-6 rounded-xl border border-slate-200 flex justify-between items-center group cursor-pointer hover:border-amber-500 hover:shadow-md transition-all shadow-sm"><div className="flex items-center gap-4"><div className="p-3 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-amber-100 group-hover:text-amber-700 transition-all"><Calendar size={24}/></div><div><h3 className="font-bold text-lg text-slate-800 group-hover:text-amber-600 transition-all italic">{m.title}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.status} • {m.date || 'DATA N/D'}</p></div></div><div className="flex items-center gap-3">{canEdit && (<button onClick={(e) => { e.stopPropagation(); deleteMeeting(m.id, m.title); }} className="p-3 text-slate-200 hover:text-red-600 transition-all hover:bg-red-50 rounded-lg"><Trash2 size={20}/></button>)}<ChevronRight size={20} className="text-slate-300 group-hover:text-amber-500 transition-all"/></div></div>))}</div>
                  </div>
                ) : (
                  <div className="animate-in fade-in duration-300 pb-20">
                    <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-10"><button onClick={()=>setView('list')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><ChevronRight className="rotate-180" size={20}/> Voltar</button>{canEdit && (<button onClick={saveMeeting} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase shadow-sm flex items-center gap-2 transition-all"><Save size={16} className="text-amber-500"/> Salvar</button>)}</div>
                    <input placeholder="Título da Reunião..." className="text-3xl md:text-4xl font-bold italic text-slate-900 bg-transparent outline-none w-full border-b border-slate-200 focus:border-amber-500 pb-2 mb-8" value={currentMeeting.title} onChange={e=>setCurrentMeeting({...currentMeeting, title: e.target.value})} readOnly={!canEdit} />
                    <div className="border-b border-slate-200 flex gap-6 mb-8 overflow-x-auto font-bold text-[10px] uppercase tracking-widest no-scrollbar italic py-2">{['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Plano de Ação', 'Atas'].map((label, i) => { const ids = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas']; return <button key={i} onClick={()=>setTab(ids[i])} className={`pb-3 transition-all relative whitespace-nowrap ${tab === ids[i] ? 'text-amber-600 border-b-2 border-amber-600 scale-105' : 'text-slate-400 hover:text-slate-800'}`}>{label}</button> })}</div>
                    {tab === 'info' && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
                        <div className="lg:col-span-2 space-y-6">
                          {canEdit && currentMeeting.id && (
                            <button 
                              onClick={() => setIsConvocationOpen(true)}
                              className="w-full py-4 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-700 font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-amber-100 transition-all shadow-sm"
                            >
                              <Mail size={18}/> Gerar Convocação Oficial do Conselho
                            </button>
                          )}
                          <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
                            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2 border-b border-slate-50 pb-4"><UserCheck size={16} className="text-amber-600"/> Participantes</h3>
                            <div className="space-y-2">{(currentMeeting.participants || []).map((p:any, i:any) => (
                              <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100 group transition-all hover:bg-white hover:shadow-md font-bold italic">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center text-xs font-bold shadow-inner">
                                    {p.isExternal ? <UserMinus size={16} className="text-slate-300"/> : p.name[0]}
                                  </div>
                                  <div>
                                    <p className="text-sm text-slate-800 flex items-center gap-2">
                                      {p.name}
                                      {p.isExternal && <span className="bg-slate-200 text-slate-500 text-[8px] px-1.5 py-0.5 rounded uppercase tracking-tighter not-italic">Ouvinte</span>}
                                    </p>
                                    <p className="text-[10px] text-slate-400 italic font-medium">{p.email}</p>
                                  </div>
                                </div>
                                {canEdit && <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={()=>setCurrentMeeting({...currentMeeting, participants:(currentMeeting.participants || []).filter((_:any,idx:any)=>idx!==i)})} className="p-2 text-slate-400 hover:text-red-500 rounded-md"><X size={16}/></button></div>}
                              </div>
                            ))}</div>
                            {canEdit && (
                              <div className="p-5 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex flex-col gap-4 animate-in slide-in-from-top-1">
                                <div className="flex gap-4 border-b border-slate-200 pb-3">
                                   <button onClick={()=>setTmpPart({...tmpPart, isExternal: false})} className={`text-[9px] font-bold uppercase tracking-widest py-1 px-3 rounded-full transition-all ${!tmpPart.isExternal ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Membro Interno</button>
                                   <button onClick={()=>setTmpPart({...tmpPart, isExternal: true, name: '', email: ''})} className={`text-[9px] font-bold uppercase tracking-widest py-1 px-3 rounded-full transition-all ${tmpPart.isExternal ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Convidado Externo</button>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 items-end w-full">
                                  {tmpPart.isExternal ? (
                                    <>
                                      <div className="flex-1 w-full space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do Convidado</label>
                                        <input className="w-full p-3 border rounded-lg text-sm bg-white font-bold outline-none" placeholder="Ex: João da Silva" value={tmpPart.name} onChange={e=>setTmpPart({...tmpPart, name: e.target.value})} />
                                      </div>
                                      <div className="flex-1 w-full space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail</label>
                                        <input className="w-full p-3 border rounded-lg text-sm bg-white font-bold outline-none" placeholder="joao@empresa.com" value={tmpPart.email} onChange={e=>setTmpPart({...tmpPart, email: e.target.value})} />
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex-1 w-full space-y-1">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selecionar Membro Cadastrado</label>
                                      <select 
                                        className="w-full p-3 border rounded-lg text-sm bg-white font-bold outline-none focus:ring-2 focus:ring-amber-500/20" 
                                        onChange={e => {
                                          const selected = users.find(u => u.id === e.target.value);
                                          if (selected) setTmpPart({ ...tmpPart, name: selected.name, email: selected.email });
                                        }}
                                        value={users.find(u => u.email === tmpPart.email)?.id || ''}
                                      >
                                        <option value="">Selecione um usuário...</option>
                                        {users.map((u: any) => (
                                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  
                                  <button 
                                    onClick={() => {
                                      if (tmpPart.name && tmpPart.email && !(currentMeeting.participants || []).some((p: any) => p.email === tmpPart.email)) {
                                        setCurrentMeeting({ ...currentMeeting, participants: [...(currentMeeting.participants || []), tmpPart] });
                                        setTmpPart({ name: '', email: '', isExternal: false });
                                      } else if (tmpPart.name) {
                                        alert("Preencha todos os campos ou verifique se o membro já está na lista.");
                                      }
                                    }} 
                                    className={`h-12 px-6 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-md whitespace-nowrap ${tmpPart.isExternal ? 'bg-slate-800 text-white' : 'bg-amber-600 text-white'}`}
                                  >
                                    {tmpPart.isExternal ? 'Adicionar Ouvinte' : 'Vincular Membro'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-6 h-fit"><h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-50 pb-4">Logística</h3><div className="space-y-4"><div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Data</label><input type="date" value={currentMeeting.date} className="w-full p-3 border rounded-lg text-sm font-bold" onChange={e=>setCurrentMeeting({...currentMeeting, date:e.target.value})} readOnly={!canEdit}/></div><div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Horário</label><input type="time" value={currentMeeting.time} className="w-full p-3 border rounded-lg text-sm font-bold" onChange={e=>setCurrentMeeting({...currentMeeting, time:e.target.value})} readOnly={!canEdit}/></div><div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Tipo</label><select className="w-full p-3 border rounded-lg text-sm font-bold" value={currentMeeting.type} onChange={e=>setCurrentMeeting({...currentMeeting, type:e.target.value})} disabled={!canEdit}><option value="Presencial">Presencial</option><option value="Online">Online</option><option value="Híbrida">Híbrida</option></select></div></div></div>
                      </div>
                    )}
                    {tab === 'pauta' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-6">
                        <div className="flex justify-between items-center bg-slate-900 p-6 rounded-xl border border-white/10 shadow-lg gap-4"><div className="flex items-center gap-4"><div className="p-3 bg-amber-600/20 text-amber-500 rounded-lg"><Timer size={24}/></div><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimativa da Sessão</p><p className="text-2xl font-bold text-white italic">{totalEstimatedTime} <span className="text-sm font-normal not-italic text-slate-400">min</span></p></div></div><button onClick={() => { setIsSessionActive(!isSessionActive); if(!isSessionActive) addLog('Início Sessão', `Reunião iniciada por ${currentUser.name}`); }} className={`px-6 py-3 rounded-lg font-bold text-xs uppercase flex items-center gap-2 transition-all shadow-md ${isSessionActive ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white'}`}>{isSessionActive ? <><Square size={16}/> Parar</> : <><Play size={16}/> Iniciar</>}</button></div>
                        <div className="space-y-2">{(currentMeeting.pautas || []).map((p:any, i:any) => (<div key={i} className={`flex justify-between items-center p-4 border rounded-lg transition-all group border-l-4 font-bold italic ${activePautaIndex === i ? 'bg-amber-50 border-amber-500' : 'bg-white border-slate-200'}`}><div className="flex items-center gap-4 flex-1"><span className="text-slate-300">#{i+1}</span><div><p className="text-sm text-slate-800">{p.title}</p><p className="text-[10px] text-slate-500 font-bold uppercase">{p.resp} • {p.dur} min</p></div></div><div className="flex items-center gap-2">{isSessionActive && activePautaIndex === i && (<div className={`font-mono text-lg ${timeElapsed > (parseInt(p.dur) * 60) ? 'text-red-600' : 'text-amber-600'}`}>{formatTime(timeElapsed)}</div>)}{isSessionActive && activePautaIndex === i && <button onClick={() => handleFinalizePauta(i)} className="bg-emerald-600 text-white p-2 rounded-md"><Check size={16}/></button>}{canEdit && <button onClick={()=>setCurrentMeeting({...currentMeeting, pautas: (currentMeeting.pautas || []).filter((_:any, idx:any)=>idx!==i)})} className="p-2 text-slate-200 hover:text-red-500"><Trash2 size={18}/></button>}</div></div>))}</div>
                        {canEdit && (<div className="p-5 bg-slate-50 rounded-xl border border-dashed border-slate-300 grid grid-cols-1 sm:grid-cols-5 gap-4 items-end"><div className="sm:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assunto</label><input placeholder="Título" className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpPauta.title} onChange={e=>setTmpPauta({...tmpPauta, title:e.target.value})}/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resp.</label>
                        <select className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpPauta.resp} onChange={e=>setTmpPauta({...tmpPauta, resp:e.target.value})}>
                          <option value="">Selecione...</option>
                          {/* Filtro: Apenas membros internos (não externos) podem ser responsáveis por pautas */}
                          {(currentMeeting.participants || []).filter((p:any) => !p.isExternal).map((p:any, i:number) => <option key={i} value={p.name}>{p.name}</option>)}
                        </select></div><div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tempo</label><input type="number" className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpPauta.dur} onChange={e=>setTmpPauta({...tmpPauta, dur:e.target.value})}/></div><button onClick={()=>{if(tmpPauta.title){setCurrentMeeting({...currentMeeting, pautas:[...(currentMeeting.pautas || []), tmpPauta]}); setTmpPauta({title:'', resp:'', dur:''});}}} className="h-12 bg-amber-600 text-white rounded-lg flex items-center justify-center shadow-md"><Plus size={24}/></button></div>)}
                      </div>
                    )}
                    {tab === 'materiais' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-6"><div className="flex justify-between items-center mb-4"><h3 className="text-xs font-bold uppercase text-slate-600 tracking-widest">Documentos</h3>{canEdit && <button onClick={()=>fileRef.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all"><Upload size={14}/> Upload</button>}</div><div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{(currentMeeting.materiais || []).map((m:any, i:any) => (<div key={i} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center gap-3 relative group"><FileText size={20} className="text-amber-600"/><div className="flex-1 truncate text-xs font-bold italic">{m.name}</div><a href={m.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-amber-600"><ExternalLink size={14}/></a></div>))}</div></div>
                    )}
                    {tab === 'delib' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-8"><div className="space-y-4">{(currentMeeting.deliberacoes || []).map((d:any, i:any) => (<div key={i} className="p-6 bg-slate-50 rounded-xl border border-slate-200 shadow-sm group font-bold italic"><p className="text-sm text-slate-800">"{d.title}"</p><div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200 mt-4"><span className="text-[10px] font-bold uppercase text-slate-400">Votantes:</span> {d.voters.map((v:any, vi:any) => <span key={vi} className="bg-white px-3 py-1 rounded-full text-[9px] uppercase border">{v}</span>)}</div></div>))}</div>{canEdit && (<div className="p-6 bg-amber-50 rounded-xl border border-amber-200 space-y-4"><textarea placeholder="Texto da Deliberação..." className="w-full p-4 border rounded-lg text-sm h-24 font-bold italic outline-none" value={tmpDelib.title} onChange={e=>setTmpDelib({...tmpDelib, title:e.target.value})} /><div className="flex flex-wrap gap-3 p-4 bg-white rounded-lg border max-h-40 overflow-y-auto">
                        {/* Filtro: Ouvintes externos não podem votar */}
                        {(currentMeeting.participants || []).filter((p:any) => !p.isExternal).map((p:any, i:number) => (<label key={i} className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500 cursor-pointer"><input type="checkbox" checked={tmpDelib.voters.includes(p.name)} onChange={(e) => { if(e.target.checked) setTmpDelib({...tmpDelib, voters: [...tmpDelib.voters, p.name]}); else setTmpDelib({...tmpDelib, voters: tmpDelib.voters.filter(v => v !== p.name)}); }} /> {p.name}</label>))}</div><button onClick={()=>{if(tmpDelib.title){setCurrentMeeting({...currentMeeting, deliberacoes:[...(currentMeeting.deliberacoes || []), tmpDelib]}); setTmpDelib({title:'', voters:[]});}}} className="w-full py-3 bg-amber-600 text-white rounded-lg font-bold uppercase shadow-sm">Oficializar</button></div>)}</div>
                    )}
                    {tab === 'acoes' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-6">
                        <div className="space-y-3">{(currentMeeting.acoes || []).map((a:any, i:any) => (<div key={a.id || i} className="p-4 bg-white rounded-lg border border-l-4 border-l-emerald-500 shadow-sm flex flex-col group font-bold italic"><div className="flex justify-between items-center w-full"><div><p className="text-sm text-slate-800">{a.title}</p><p className="text-[10px] text-slate-400 uppercase mt-1 tracking-widest">{a.resp} • {a.date}</p></div>{canEdit && <button onClick={()=>setCurrentMeeting({...currentMeeting, acoes: (currentMeeting.acoes || []).filter((_:any, idx:any)=>idx!==i)})}><Trash2 size={18} className="text-slate-200 hover:text-red-500"/></button>}</div>{a.obs && <div className="mt-2 text-[10px] text-amber-700 bg-amber-50/50 p-2 rounded border border-amber-100/50 whitespace-pre-wrap">OBS: {a.obs}</div>}</div>))}</div>
                        {canEdit && (<div className="p-5 bg-slate-50 border border-dashed border-slate-300 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-4 items-end"><div className="sm:col-span-5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ação</label><input placeholder="Título" className="w-full p-3 border rounded-lg text-sm bg-white font-bold italic" value={tmpAcao.title} onChange={e=>setTmpAcao({...tmpAcao, title:e.target.value})}/></div><div className="sm:col-span-3"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resp.</label>
                        <select className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpAcao.resp} onChange={e=>setTmpAcao({...tmpAcao, resp:e.target.value})}>
                          <option value="">Selecione um Usuário...</option>
                          {/* Trava: Apenas membros cadastrados no sistema (users) podem ser responsáveis por ações */}
                          {users.map((u:any) => <option key={u.id} value={u.name}>{u.name}</option>)}
                        </select>
                        </div><div className="sm:col-span-3"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prazo</label><input type="date" className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpAcao.date} onChange={e=>setTmpAcao({...tmpAcao, date:e.target.value})}/></div><div className="sm:col-span-12"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Observações Explicativas</label><textarea rows={2} placeholder="Notas detalhadas sobre o que aconteceu nesta ação..." className="w-full p-3 border rounded-lg text-sm bg-white font-bold italic outline-none focus:ring-2 focus:ring-amber-500/20" value={tmpAcao.obs} onChange={e=>setTmpAcao({...tmpAcao, obs:e.target.value})}/></div><div className="sm:col-span-12"><button onClick={()=>{if(tmpAcao.title){setCurrentMeeting({...currentMeeting, acoes:[...(currentMeeting.acoes || []), {...tmpAcao, id: Date.now()}]}); setTmpAcao({title:'', resp:'', date:'', status:'Pendente', obs:''});}}} className="w-full p-3 bg-emerald-600 text-white rounded-lg flex items-center justify-center shadow-md font-bold uppercase text-[10px] tracking-widest"><Plus size={18} className="mr-2"/> Adicionar Iniciativa</button></div></div>)}
                      </div>
                    )}
                    {tab === 'atas' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-8"><div className="flex justify-between items-center border-b border-slate-50 pb-4"><h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest">Atas Finais</h3>{canEdit && <button onClick={()=>ataRef.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all"><Upload size={14}/> Carregar</button>}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{(currentMeeting.atas || []).map((ata:any, i:any) => (
                        <div key={i} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center gap-4 group italic font-bold">
                          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><FileCheck size={24}/></div>
                          <div className="flex-1 truncate text-sm">{ata.name}</div>
                          <a href={ata.url} target="_blank" rel="noreferrer" className="text-slate-300 hover:text-amber-600"><ExternalLink size={18}/></a>
                        </div>
                      ))}</div></div>
                    )}
                  </div>
                )
              )}
              
              {activeMenu === 'plano-acao' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Plano Global</h1>
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200 w-full md:w-auto">
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200">
                        <User size={14} className="text-amber-500"/><select className="text-[10px] font-bold uppercase outline-none bg-transparent cursor-pointer text-slate-600" value={filterResp} onChange={e=>setFilterResp(e.target.value)}>
                          <option value="all">Responsável</option>
                          {[...new Set(meetings.flatMap((m: any) => (m.acoes || []).map((a: any) => a.resp)))].filter(r => r).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200">
                        <Target size={14} className="text-amber-500"/><select className="text-[10px] font-bold uppercase outline-none bg-transparent cursor-pointer text-slate-600" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                          <option value="all">Status</option>
                          <option value="Pendente">Pendente</option>
                          <option value="Em andamento">Em andamento</option>
                          <option value="Concluída">Concluída</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200">
                        <Building2 size={14} className="text-amber-500"/><select className="text-[10px] font-bold uppercase outline-none bg-transparent cursor-pointer text-slate-600" value={filterOrigin} onChange={e=>setFilterOrigin(e.target.value)}>
                          <option value="all">Origem (Reunião)</option>
                          {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                        </select>
                      </div>
                      {(filterResp !== 'all' || filterStatus !== 'all' || filterOrigin !== 'all') && (
                        <button onClick={() => { setFilterResp('all'); setFilterStatus('all'); setFilterOrigin('all'); }} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400" title="Limpar Filtros"><X size={16}/></button>
                      )}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="bg-white p-5 border border-amber-200 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-12 gap-4 items-end animate-in slide-in-from-top-2">
                      <div className="md:col-span-3"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Iniciativa</label><input placeholder="Título" className="w-full p-3 border rounded-lg text-sm font-bold bg-slate-50 outline-none italic" value={tmpGlobalAcao.title} onChange={e=>setTmpGlobalAcao({...tmpGlobalAcao, title: e.target.value})} /></div>
                      <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resp.</label><select className="w-full p-3 border rounded-lg text-sm font-bold bg-slate-50" value={tmpGlobalAcao.resp} onChange={e=>setTmpGlobalAcao({...tmpGlobalAcao, resp: e.target.value})}><option value="">Selecione um Usuário...</option>{users.map((u, i) => <option key={i} value={u.name}>{u.name}</option>)}</select></div>
                      <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Origem</label><select className="w-full p-3 border rounded-lg text-sm font-bold bg-slate-50" value={tmpGlobalAcao.meetingId} onChange={e=>setTmpGlobalAcao({...tmpGlobalAcao, meetingId: e.target.value})}><option value="">Vincular...</option>{meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></div>
                      <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prazo</label><input type="date" className="w-full p-3 border rounded-lg text-sm font-bold bg-slate-50" value={tmpGlobalAcao.date} onChange={e=>setTmpGlobalAcao({...tmpGlobalAcao, date: e.target.value})} /></div>
                      <div className="md:col-span-3"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Observações Detalhadas</label><textarea rows={2} placeholder="Notas explicativas sobre o status..." className="w-full p-3 border rounded-lg text-sm font-bold bg-slate-50 outline-none italic focus:ring-2 focus:ring-amber-500/20" value={tmpGlobalAcao.obs} onChange={e=>setTmpGlobalAcao({...tmpGlobalAcao, obs: e.target.value})} /></div>
                      <div className="md:col-span-12"><button onClick={saveGlobalAction} className="w-full py-3 bg-amber-600 text-white rounded-lg flex items-center justify-center shadow-md hover:bg-amber-700 transition-all font-bold uppercase text-[10px] tracking-widest"><Plus size={18} className="mr-2"/> Lançar Ação Global</button></div>
                    </div>
                  )}
                  
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[1200px] font-bold italic">
                      <thead className="bg-slate-900 text-[10px] font-bold uppercase text-amber-500 border-b border-white/5 tracking-widest">
                        <tr><th className="px-6 py-4">Iniciativa</th><th className="px-6 py-4">Responsável</th><th className="px-6 py-4">Origem</th><th className="px-6 py-4" style={{width: '140px'}}>Prazo</th><th className="px-6 py-4" style={{width: '400px'}}>Observações Explicativas</th><th className="px-6 py-4 text-center">Status</th>{canEdit && <th className="px-6 py-4 text-center">Gestão</th>}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stats.allActions.map((acao:any) => (
                          <tr key={`${acao.mId}-${acao.id}`} className="hover:bg-slate-50 transition-all">
                            <td className="px-6 py-4 text-slate-800">{acao.title}</td>
                            <td className="px-6 py-4 text-slate-600">
                              {canEdit ? (
                                <select 
                                  className="bg-transparent border-none outline-none text-xs font-bold text-slate-600 cursor-pointer w-full"
                                  value={acao.resp || ''} 
                                  onChange={(e) => updateActionRespGlobal(acao.mId, acao.id, e.target.value)}
                                >
                                  <option value="">Selecione...</option>
                                  {acao.resp && !users.find(u => u.name === acao.resp) && <option value={acao.resp}>{acao.resp}</option>}
                                  {users.map((u: any) => <option key={u.id} value={u.name}>{u.name}</option>)}
                                </select>
                              ) : (acao.resp || 'N/D')}
                            </td>
                            <td className="px-6 py-4 text-slate-400 text-[10px] uppercase tracking-widest">
                              {canEdit ? (
                                <select 
                                  className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-400 uppercase cursor-pointer w-full"
                                  value={acao.mId} 
                                  onChange={(e) => updateActionOriginGlobal(acao.mId, acao.id, e.target.value)}
                                >
                                  {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                                </select>
                              ) : acao.mTitle}
                            </td>
                            <td className="px-6 py-4"><input type="date" className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-600 cursor-pointer p-1 rounded hover:bg-white transition-all" value={acao.date || ''} onChange={(e) => updateActionDateGlobal(acao.mId, acao.id, e.target.value)} disabled={!canEdit}/></td>
                            <td className="px-6 py-4">
                              <textarea 
                                className="bg-white border border-slate-100 outline-none text-[11px] text-slate-600 italic w-full focus:ring-1 focus:ring-amber-200 p-3 rounded-lg shadow-sm transition-all resize-none overflow-y-auto" 
                                rows={6} 
                                defaultValue={acao.obs || ''} 
                                onBlur={(e) => updateActionObsGlobal(acao.mId, acao.id, e.target.value)} 
                                placeholder="Anote aqui os detalhes da evolução desta ação..." 
                                disabled={!canEdit}
                              />
                            </td>
                            <td className="px-6 py-4 text-center"><select value={acao.status} onChange={(e) => updateActionStatusGlobal(acao.mId, acao.id, e.target.value)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border-none bg-amber-50 text-amber-700 cursor-pointer" disabled={!canEdit}><option value="Pendente">Aguardando</option><option value="Em andamento">Execução</option><option value="Concluída">Finalizado</option></select></td>
                            {canEdit && <td className="px-6 py-4 text-center"><button onClick={() => deleteActionGlobal(acao.mId, acao.id)} className="text-slate-200 hover:text-red-600"><Trash2 size={16}/></button></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeMenu === 'usuarios' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">{isSuper ? 'Gestão Master de Contas' : 'Conselheiros'}</h1></div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <div className="bg-slate-900 p-8 rounded-2xl shadow-xl space-y-4 h-fit sticky top-24 border border-white/5">
                      <h3 className="text-[10px] font-bold uppercase text-amber-500 border-b border-white/5 pb-3 tracking-widest">{isSuper ? 'Novo Cliente' : 'Novo Membro'}</h3>
                      <div><label className="text-[10px] font-bold text-slate-500 uppercase">Nome</label><input className="w-full p-3 bg-slate-800 text-white rounded-lg outline-none font-bold" value={newUserForm.name} onChange={e=>setnewUserForm({...newUserForm, name: e.target.value})} /></div>
                      <div><label className="text-[10px] font-bold text-slate-500 uppercase">E-mail</label><input className="w-full p-3 bg-slate-800 text-white rounded-lg outline-none font-bold" value={newUserForm.email} onChange={e=>setnewUserForm({...newUserForm, email: e.target.value})} /></div>
                      <div><label className="text-[10px] font-bold text-slate-500 uppercase">Perfil</label><select className="w-full p-3 bg-slate-800 text-white rounded-lg font-bold" value={newUserForm.role} onChange={e=>setnewUserForm({...newUserForm, role: e.target.value})}><option value="Conselheiro">Conselheiro</option><option value="Secretário">Secretário</option><option value="Administrador">Administrador</option>{isSuper && <option value="SuperAdmin">SuperAdmin</option>}</select></div>
                      <div><label className="text-[10px] font-bold text-slate-500 uppercase">Senha</label><input type="password" className="w-full p-3 bg-slate-800 text-white rounded-lg outline-none font-bold" value={newUserForm.password} onChange={e=>setnewUserForm({...newUserForm, password: e.target.value})} /></div>
                      <div><label className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-2"><Building2 size={12}/> Identificador</label><input placeholder={isSuper ? "Ex: Empresa-A" : "Auto"} className="w-full p-3 bg-slate-800 text-white rounded-lg outline-none font-bold border border-amber-500/30" value={isSuper ? newUserForm.client_id : (newUserForm.client_id || currentUser.client_id)} onChange={e=>setnewUserForm({...newUserForm, client_id: e.target.value})} readOnly={!isSuper} /></div>
                    
                    <button 
                      disabled={loading}
                      onClick={async ()=>{ 
                        setLoading(true);
                        const payload = { ...newUserForm, client_id: isSuper ? newUserForm.client_id : currentUser.client_id }; 
                        
                        const authClient = createClient(supabaseUrl, supabaseKey, {
                          auth: {
                            persistSession: false,
                            autoRefreshToken: false,
                            detectSessionInUrl: false
                          }
                        });

                        const { data, error } = await authClient.auth.signUp({
                          email: payload.email,
                          password: payload.password,
                          options: {
                            data: {
                              name: payload.name,
                              role: payload.role,
                              client_id: payload.client_id,
                              email_verified: true
                            }
                          }
                        });

                        if(error) {
                          alert("Erro ao habilitar acesso: " + error.message);
                        } else if (data.user) {
                          const { error: dbError } = await supabase.from('members').insert([{
                            id: data.user.id,
                            name: payload.name,
                            email: payload.email,
                            role: payload.role,
                            client_id: payload.client_id
                          }]);

                          if (dbError) {
                            alert("Erro ao registrar perfil.");
                          } else {
                            setnewUserForm({name:'', email:'', role:'Conselheiro', password:'', client_id:''}); 
                            alert("Sucesso!"); 
                            fetchInitialData();
                          }
                        }
                        setLoading(false);
                      }} 
                      className="w-full py-3 bg-amber-600 text-white rounded-lg font-bold uppercase shadow-md hover:bg-amber-700 transition-all tracking-widest disabled:opacity-50"
                    >
                      {loading ? "Processando..." : "Habilitar Acesso Oficial"}
                    </button>
                    </div>
                    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                      <table className="w-full text-left text-sm min-w-[500px] font-bold italic">
                        <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-50 tracking-widest">
                          <tr><th className="px-6 py-4">Membro</th><th className="px-6 py-4 text-center">Empresa</th><th className="px-6 py-4 text-center">Nível</th><th className="px-6 py-4 text-center">Gestão</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {users.map((u:any) => (<tr key={u.id} className="hover:bg-slate-50 transition-all"><td className="px-6 py-4">{u.name} <br/><span className="text-[9px] text-slate-300">{u.email}</span></td><td className="px-6 py-4 text-center text-[10px] text-amber-600 uppercase">{u.client_id}</td><td className="px-6 py-4 text-center text-[10px]">{u.role}</td><td className="px-6 py-4 text-center"><button onClick={async ()=>{ if(window.confirm(`Remover?`)) { const {error} = await supabase.from('members').delete().eq('id', u.id); if(!error) setUsers(users.filter((x:any)=>x.id!==u.id)); } }} className="text-slate-200 hover:text-red-500"><Trash2 size={18}/></button></td></tr>))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              
              {activeMenu === 'auditoria' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Auditoria de {isSuper ? 'Sistema' : currentUser.client_id}</h1></div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm font-bold italic">
                      <thead className="bg-slate-900 text-[10px] font-bold uppercase text-amber-500 tracking-widest">
                        <tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Usuário</th><th className="px-6 py-4">Ação</th><th className="px-6 py-4">Detalhes</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditLogs.map((log, i) => (
                          <tr key={log.id || i} className="hover:bg-slate-50 transition-all text-slate-600">
                            <td className="px-6 py-4 text-[10px]">{new Date(log.log_date).toLocaleString()}</td>
                            <td className="px-6 py-4">{log.username}</td>
                            <td className="px-6 py-4 text-amber-600 uppercase text-[10px]">{log.action}</td>
                            <td className="px-6 py-4 text-xs">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
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