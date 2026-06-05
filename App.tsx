import React, { useState, useRef, useMemo, useEffect } from 'react';
import { generateMeetingPDF } from './services/generateMeetingPDF';
import { generateAtaPDF } from './services/generateAtaPDF';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard, Calendar, ChevronRight, UserPlus,
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2,
  Upload, Save, Lock, Target, FileCheck, BarChart3,
  PieChart as PieIcon, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, Settings, Camera, UserCircle, History, Filter, MessageSquare, Download, ExternalLink, ListChecks, Plus, Edit2, Check, Menu, ChevronUp, ChevronDown, Play, Square, Timer, SkipForward, Building2, ChevronLeft, UserMinus, ThumbsUp, ThumbsDown, CircleSlash, MinusCircle, Archive, Search
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// --- CONFIGURAÇÃO SUPABASE ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
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
  const [tmpPart, setTmpPart] = useState({ name: '', email: '', isExternal: false });
  const [tmpPauta, setTmpPauta] = useState({ title: '', resp: '', dur: '' });
  const [tmpAcao, setTmpAcao] = useState({ title: '', resps: [] as string[], resp: '', date: '', status: 'Pendente', obs: '' });
  const [tmpGlobalAcao, setTmpGlobalAcao] = useState({ title: '', resps: [] as string[], date: '', meetingId: '', obs: '' });
  const [tmpDelib, setTmpDelib] = useState({ title: '', voters: [] as string[], votes: {} as any });
  const [editingObsKey, setEditingObsKey] = useState<string | null>(null);
  const [obsInputValue, setObsInputValue] = useState('');
  const [editingRespsKey, setEditingRespsKey] = useState<string | null>(null);
  const [newUserForm, setnewUserForm] = useState({ name: '', email: '', role: 'Conselheiro', password: '', client_id: '' });
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [clientProfileForm, setClientProfileForm] = useState({ name: '', logo_url: '' });
  const [savingClientProfile, setSavingClientProfile] = useState(false);
  const [atasSearch, setAtasSearch] = useState('');
  const logoRef = useRef<HTMLInputElement>(null);

  const [activePautaIndex, setActivePautaIndex] = useState<number | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const isSuper = currentUser?.role === 'SuperAdmin';
  const isAdm = currentUser?.role === 'Administrador' || isSuper;
  const isSec = currentUser?.role === 'Secretário';
  const canEdit = isAdm || isSec;

  // --- LOGICA DE SESSÃO ---
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
    // Tenta ler role e client_id do user_metadata do Auth (mais seguro)
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    const meta = user?.user_metadata;
    if (meta?.role && meta?.client_id) {
      setCurrentUser({
        id: userId,
        name: meta.name || user?.email || '',
        email: user?.email ?? '',
        role: meta.role,
        client_id: meta.client_id
      });
    } else {
      // Fallback para tabela members (compatibilidade com usuários sem metadata)
      const { data } = await supabase.from('members').select('id, name, email, role, client_id').eq('id', userId).single();
      if (data) setCurrentUser(data);
    }
  };

  useEffect(() => { if (currentUser) fetchInitialData(); }, [currentUser]);

  // --- LOGICA DO CRONÔMETRO ---
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
            alert(`⚠️ TEMPO ESGOTADO: A pauta "${pautaAtual?.title}" ultrapassou o limite planejado.`);
          }
          return newVal;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSessionActive, activePautaIndex, currentMeeting.pautas]);

  const handleMovePauta = (index: number, direction: 'up' | 'down') => {
    if (!canEdit || isSessionActive) return;
    const newPautas = [...(currentMeeting.pautas || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPautas.length) return;
    [newPautas[index], newPautas[targetIndex]] = [newPautas[targetIndex], newPautas[index]];
    setCurrentMeeting({ ...currentMeeting, pautas: newPautas });
  };

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
      setIsSessionActive(false);
      setActivePautaIndex(null);
      setTimeElapsed(0);
      alert("Fim da Ordem do Dia. Todas as pautas concluídas.");
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
      const [mRes, uRes, lRes, cRes] = await Promise.all([
        mQuery.order('created_at', { ascending: false }),
        uQuery.order('name'),
        lQuery.order('log_date', { ascending: false }).limit(50),
        supabase.from('clients').select('*').eq('client_id', currentUser.client_id).maybeSingle()
      ]);
      if (mRes.data) setMeetings(mRes.data);
      if (uRes.data) setUsers(uRes.data);
      if (lRes.data) setAuditLogs(lRes.data);
      if (cRes.data) {
        setClientProfile(cRes.data);
        setClientProfileForm({ name: cRes.data.name || '', logo_url: cRes.data.logo_url || '' });
      } else {
        setClientProfileForm({ name: currentUser.client_id, logo_url: '' });
      }
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.client_id}/${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `${type}/${fileName}`;
      await supabase.storage.from('meeting-files').upload(filePath, file);
      const { data: signedData, error: signedError } = await supabase.storage
        .from('meeting-files')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);
      if (signedError) throw signedError;
      const secureUrl = signedData.signedUrl;
      const newFile = { name: file.name, url: secureUrl, uploadedAt: new Date().toISOString() };
      // Atas: substituir a anterior (cada reunião tem 1 ata vigente)
      // Materiais: acumular normalmente
      if (type === 'atas' && (currentMeeting.atas || []).length > 0) {
        const confirmar = window.confirm(
          `Já existe uma ata publicada para esta reunião:\n"${currentMeeting.atas[0].name}"\n\nDeseja substituí-la pela nova versão?`
        );
        if (!confirmar) { setLoading(false); if (e.target) e.target.value = ''; return; }
      }
      const updatedFiles = type === 'atas' ? [newFile] : [...(currentMeeting[type] || []), newFile];

      // Auto-save diretamente no banco — evita perda de dados se o usuário não clicar em Salvar
      if (currentMeeting.id) {
        const { data: saved, error: saveErr } = await supabase
          .from('meetings')
          .update({ [type]: updatedFiles })
          .eq('id', currentMeeting.id)
          .select()
          .single();
        if (saveErr) throw saveErr;
        setCurrentMeeting(saved);
        setMeetings(prev => prev.map(m => m.id === currentMeeting.id ? saved : m));
      } else {
        // Reunião ainda não foi salva — atualiza apenas o estado local
        setCurrentMeeting((prev: any) => ({ ...prev, [type]: updatedFiles }));
      }

      addLog('Upload', `Arquivo ${file.name} em ${type}`);

      if (type === 'atas') {
        const participants = (currentMeeting.participants || []).filter((p: any) => !p.isExternal);
        const emails = participants.map((p: any) => p.email).filter((e: string) => e);
        const allPendingActions = meetings.flatMap((m: any) => (m.acoes || []).map((a: any) => ({ ...a, meetingTitle: m.title }))).filter((a: any) => a.status !== 'Concluída');
        const usersToNotify = participants.map((p: any) => ({ email: p.email, name: p.name, pendingActions: allPendingActions.filter((a: any) => a.resp === p.name) })).filter((u: any) => u.email);
        if (emails.length > 0) {
          try {
            await supabase.functions.invoke('send-minute-notification', {
              body: { meetingTitle: currentMeeting.title, minuteName: file.name, minuteUrl: secureUrl, actions: currentMeeting.acoes || [], recipients: emails, pendingSummary: usersToNotify }
            });
            alert("✅ Ata publicada, salva automaticamente e e-mails enviados!");
          } catch (e) { alert("✅ Ata publicada e salva automaticamente. Erro no disparo de e-mails."); }
        } else {
          alert("✅ Ata publicada e salva automaticamente!");
        }
      }
    } catch (err: any) { alert("Erro: " + err.message); }
    finally { setLoading(false); if (e.target) e.target.value = ''; }
  };

  const saveMeeting = async () => {
    if (!canEdit) return;
    if (!currentMeeting.title) return alert("O título é obrigatório.");
    const meetingData = {
      ...currentMeeting,
      client_id: currentUser.client_id,
      date: currentMeeting.date === "" ? null : currentMeeting.date,
      time: currentMeeting.time === "" ? null : currentMeeting.time
    };
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
    const newAction = { id: Date.now(), title: tmpGlobalAcao.title, resps: tmpGlobalAcao.resps, resp: tmpGlobalAcao.resps[0] || '', date: tmpGlobalAcao.date, obs: tmpGlobalAcao.obs, status: 'Pendente' };
    const updatedActions = [...(targetMeeting.acoes || []), newAction];
    const { error } = await supabase.from('meetings').update({ acoes: updatedActions }).eq('id', targetMeeting.id);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === targetMeeting.id ? { ...m, acoes: updatedActions } : m));
      setTmpGlobalAcao({ title: '', resps: [], date: '', meetingId: '', obs: '' });
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
    if (!error) setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
  };

  const updateActionStatusGlobal = async (meetingId: string, actionId: string | number, newStatus: string) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).map((a: any) => a.id === actionId ? { ...a, status: newStatus } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
  };

  const updateActionDateGlobal = async (meetingId: string, actionId: string | number, newDate: string) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).map((a: any) => a.id === actionId ? { ...a, date: newDate } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
  };

  const updateActionRespGlobal = async (meetingId: string, actionId: string | number, newResp: string) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).map((a: any) => a.id === actionId ? { ...a, resp: newResp } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
  };

  const updateActionRespsGlobal = async (meetingId: string, actionId: string | number, newResps: string[]) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).map((a: any) => a.id === actionId ? { ...a, resps: newResps, resp: newResps[0] || a.resp || '' } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
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
      setMeetings(prev => prev.map(m => m.id === oldMeetingId ? { ...m, acoes: filteredOldAcoes } : m.id === newMeetingId ? { ...m, acoes: updatedNewAcoes } : m));
    }
  };

  const updateActionObsGlobal = async (meetingId: string, actionId: string | number, newObs: string) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).map((a: any) => a.id === actionId ? { ...a, obs: newObs } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
  };

  // --- CADASTRO DE NOVO MEMBRO (via Edge Function segura) ---
  // CORREÇÃO FINAL: verifica diretamente no banco se o membro foi criado,
  // ignorando o código de retorno HTTP da Edge Function
  const handleCreateUser = async () => {
    const clientId = isSuper ? newUserForm.client_id : currentUser.client_id;
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password || !clientId) {
      return alert("Todos os campos são obrigatórios.");
    }
    if (newUserForm.password.length < 8) {
      return alert("A senha deve ter no mínimo 8 caracteres.");
    }
    if (!/[a-zA-Z]/.test(newUserForm.password) || !/[0-9]/.test(newUserForm.password)) {
      return alert("A senha deve conter letras e números.");
    }
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      // Chama a Edge Function — não valida o retorno HTTP pois pode retornar 500
      // mesmo quando o cadastro foi realizado com sucesso
      await supabase.functions.invoke('create-user', {
        body: {
          name: newUserForm.name,
          email: newUserForm.email,
          password: newUserForm.password,
          role: newUserForm.role,
          client_id: clientId,
          created_by: currentUser.name
        },
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      // Verifica diretamente no banco se o membro foi criado com sucesso
      const { data: membroVerificado } = await supabase
        .from('members')
        .select('id, name, email, role, client_id, created_at')
        .eq('email', newUserForm.email)
        .single();

      if (!membroVerificado) {
        throw new Error("Não foi possível confirmar o cadastro. Tente novamente.");
      }

      setUsers(prev => [...prev, membroVerificado].sort((a, b) => a.name.localeCompare(b.name)));
      addLog('Cadastro', `Novo membro: ${membroVerificado.name} (${membroVerificado.role}) — ${clientId}`);
      setnewUserForm({ name: '', email: '', role: 'Conselheiro', password: '', client_id: '' });
      alert(`✅ Membro ${membroVerificado.name} cadastrado com sucesso!`);
    } catch (err: any) {
      alert("Erro ao cadastrar: " + (err.message || "Verifique se a Edge Function 'create-user' está publicada."));
    } finally {
      setLoading(false);
    }
  };

  // --- PERFIL DA EMPRESA ---
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop();
    const fileName = `${currentUser.client_id}/logo.${ext}`;
    const { error: upError } = await supabase.storage.from('client-logos').upload(fileName, file, { upsert: true });
    if (upError) { alert('Erro no upload: ' + upError.message); return; }
    const { data: urlData } = supabase.storage.from('client-logos').getPublicUrl(fileName);
    setClientProfileForm(prev => ({ ...prev, logo_url: urlData.publicUrl }));
  };

  const saveClientProfile = async () => {
    setSavingClientProfile(true);
    const payload = { client_id: currentUser.client_id, name: clientProfileForm.name, logo_url: clientProfileForm.logo_url };
    const { data, error } = await supabase.from('clients').upsert(payload, { onConflict: 'client_id' }).select().single();
    if (error) { alert('Erro ao salvar perfil: ' + error.message); }
    else { setClientProfile(data); addLog('Configuração', `Perfil da empresa atualizado: ${data.name}`); alert('✅ Perfil salvo com sucesso!'); }
    setSavingClientProfile(false);
  };

  // Retorna o nome do votante que corresponde ao usuário atual (por nome ou por email)
  const resolveVoterName = (voters: string[]): string | null => {
    if (voters.includes(currentUser?.name)) return currentUser.name;
    const match = (currentMeeting.participants || []).find(
      (p: any) => p.email === currentUser?.email && voters.includes(p.name)
    );
    return match?.name ?? null;
  };

  // --- LÓGICA DE VOTAÇÃO ---
  const handleRegisterVote = async (delibIndex: number, voteType: 'Favor' | 'Contra' | 'Abstenção') => {
    const newDelibs = [...(currentMeeting.deliberacoes || [])];
    const delib = newDelibs[delibIndex];
    const voterName = resolveVoterName(delib.voters || []) || currentUser.name;
    const votes = { ...(delib.votes || {}), [voterName]: voteType };
    newDelibs[delibIndex] = { ...delib, votes };
    if (currentMeeting.id) {
      const { error } = await supabase.from('meetings').update({ deliberacoes: newDelibs }).eq('id', currentMeeting.id);
      if (error) { alert('Erro ao registrar voto: ' + error.message); return; }
    }
    setCurrentMeeting({ ...currentMeeting, deliberacoes: newDelibs });
    setMeetings((prev: any) => prev.map((m: any) => m.id === currentMeeting.id ? { ...m, deliberacoes: newDelibs } : m));
    addLog('Votação', `Voto "${voteType}" em: ${delib.title}`);
  };

  const handleDeleteDelib = async (index: number) => {
    if (!window.confirm("Deseja excluir esta deliberação?")) return;
    const newDelibs = (currentMeeting.deliberacoes || []).filter((_: any, i: number) => i !== index);
    if (currentMeeting.id) {
      const { error } = await supabase.from('meetings').update({ deliberacoes: newDelibs }).eq('id', currentMeeting.id);
      if (error) { alert('Erro ao excluir deliberação: ' + error.message); return; }
    }
    setCurrentMeeting({ ...currentMeeting, deliberacoes: newDelibs });
    setMeetings((prev: any) => prev.map((m: any) => m.id === currentMeeting.id ? { ...m, deliberacoes: newDelibs } : m));
    addLog('Exclusão', `Deliberação removida.`);
  };

  const updateDelibVoters = async (delibIndex: number, newVoters: string[]) => {
    if (!canEdit) return;
    const newDelibs = [...(currentMeeting.deliberacoes || [])];
    newDelibs[delibIndex] = { ...newDelibs[delibIndex], voters: newVoters };
    if (currentMeeting.id) {
      const { error } = await supabase.from('meetings').update({ deliberacoes: newDelibs }).eq('id', currentMeeting.id);
      if (error) { alert('Erro ao atualizar votantes: ' + error.message); return; }
    }
    setCurrentMeeting({ ...currentMeeting, deliberacoes: newDelibs });
    setMeetings((prev: any) => prev.map((m: any) => m.id === currentMeeting.id ? { ...m, deliberacoes: newDelibs } : m));
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
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const filteredM = dashboardFilter === 'all' ? meetings : meetings.filter(m => m.id === dashboardFilter);
    const allA = filteredM.flatMap(m => (m.acoes || []).map((a: any) => ({ ...a, mTitle: m.title, mId: m.id })))
      .filter(a => filterResp === 'all' || (a.resps?.length > 0 ? a.resps.includes(filterResp) : a.resp === filterResp))
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
      barData: filteredM.slice(0, 6).map(m => ({ name: m.date || 'S/D', 'Pautas': m.pautas?.length || 0, 'Ações': m.acoes?.length || 0 }))
    };
  }, [meetings, dashboardFilter, filterResp, filterStatus, filterOrigin]);

  // Regenera a signed URL antes de abrir — evita o erro 404 por URL expirada (7 dias)
  const openAtaUrl = async (storedUrl: string, setLoading?: (v: boolean) => void) => {
    try {
      if (setLoading) setLoading(true);
      // Extrai o filePath da URL armazenada (funciona tanto para signed quanto para public URLs)
      const match = storedUrl.match(/\/(?:sign|public)\/meeting-files\/(.+?)(?:\?|$)/);
      if (!match) {
        // URL fora do padrão esperado — tenta abrir direto
        window.open(storedUrl, '_blank');
        return;
      }
      const filePath = decodeURIComponent(match[1]);
      const { data, error } = await supabase.storage
        .from('meeting-files')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);
      if (error) {
        alert(`Erro ao acessar o arquivo: ${error.message}\n\nO arquivo pode ter sido removido do servidor.`);
        return;
      }
      if (!data?.signedUrl) {
        alert('Não foi possível gerar o link de acesso. Tente novamente.');
        return;
      }
      window.open(data.signedUrl, '_blank');
    } catch (e: any) {
      alert('Erro inesperado ao abrir o arquivo: ' + (e?.message || e));
    } finally {
      if (setLoading) setLoading(false);
    }
  };

  const allAtas = useMemo(() => {
    return meetings
      .flatMap(m => (m.atas || []).map((ata: any) => ({
        ...ata,
        meetingTitle: m.title,
        meetingDate: m.date,
        meetingId: m.id,
        meetingStatus: m.status,
      })))
      .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
  }, [meetings]);

  const filteredAtas = useMemo(() => {
    if (!atasSearch.trim()) return allAtas;
    const s = atasSearch.toLowerCase();
    return allAtas.filter(a =>
      a.name?.toLowerCase().includes(s) ||
      a.meetingTitle?.toLowerCase().includes(s)
    );
  }, [allAtas, atasSearch]);

  const ConvocationModal = () => (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-xl font-bold text-slate-800 italic">Convocação Oficial</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prévia do E-mail de Notificação</p>
          </div>
          <button onClick={() => setIsConvocationOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-400"><X size={20} /></button>
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
                      <span className="text-slate-700 font-bold italic">{i + 1}. {p.title}</span>
                      <span className="text-slate-400 font-bold uppercase">{p.dur} min</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 border-t bg-white flex flex-col sm:flex-row gap-3">
          <button disabled={isSendingEmail} onClick={async () => {
            const emails = (currentMeeting.participants || []).map((p: any) => p.email).filter((e: string) => e);
            if (emails.length === 0) return alert("Erro: Não há participantes com e-mail.");
            setIsSendingEmail(true);
            try {
              await supabase.functions.invoke('send-invitation', { body: { meetingData: currentMeeting, recipients: emails } });
              addLog('Convocação', `E-mails enviados.`);
              alert("Convocações enviadas!");
              setIsConvocationOpen(false);
            } catch (e) { alert("Erro ao disparar."); }
            finally { setIsSendingEmail(false); }
          }} className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-bold uppercase text-[10px] tracking-[2px] flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50">
            {isSendingEmail ? "Processando..." : <><Send size={16} className="text-amber-500" /> Disparar Convocações Oficiais</>}
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
          <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password });
            if (error) alert('Erro de Acesso: ' + error.message);
            setLoading(false);
          }}>
            <input type="email" placeholder="E-mail Corporativo" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} required />
            <input type="password" placeholder="Senha" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} required />
            <button disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-lg font-bold uppercase shadow-md transition-all">Entrar na Plataforma</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden text-slate-800">
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-slate-300 flex flex-col shadow-xl transition-all duration-300 md:relative transform ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'} ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}`}>
        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="absolute -right-3 top-20 bg-amber-600 text-white rounded-full p-1 shadow-md hidden md:block z-[60] hover:bg-amber-700 transition-colors">
          {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <div className={`flex flex-col items-center justify-center border-b border-white/5 bg-slate-900/30 transition-all duration-300 ${isSidebarCollapsed ? 'p-4' : 'p-10'}`}>
          {clientProfile?.logo_url ? (
            <img src={clientProfile.logo_url} alt={clientProfile.name || 'Logo'} className={`w-auto object-contain transition-all ${isSidebarCollapsed ? 'h-8' : 'h-14'}`} style={{ mixBlendMode: 'lighten' }} />
          ) : (
            isSidebarCollapsed
              ? <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center text-xs font-black">{(currentUser?.client_id || 'C')[0]}</div>
              : <img src="/logo-sidebar.jpg" alt="Logo" className="w-auto h-12 object-contain" style={{ mixBlendMode: 'lighten' }} />
          )}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 text-[10px] font-bold uppercase tracking-widest">
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
            { id: 'reunioes', icon: <Calendar size={18} />, label: 'Conselho', action: () => setView('list') },
            { id: 'plano-acao', icon: <ListChecks size={18} />, label: 'Plano de Ação' },
            { id: 'repositorio-atas', icon: <Archive size={18} />, label: 'Repositório de Atas' },
            { id: 'usuarios', icon: <UserCog size={18} />, label: isSuper ? 'Contas de Clientes' : 'Membros', adm: true },
            { id: 'auditoria', icon: <History size={18} />, label: 'Auditoria', adm: true }
          ].map((item) => (
            (!item.adm || isAdm) && (
              <button key={item.id} onClick={() => { setActiveMenu(item.id); if (item.action) item.action(); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 rounded-lg transition-all ${activeMenu === item.id ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-slate-700 hover:text-white'} ${isSidebarCollapsed ? 'justify-center p-3' : 'px-4 py-3'}`}>
                <span className="shrink-0">{item.icon}</span>
                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            )
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700/50">
          <button onClick={async () => { await supabase.auth.signOut(); setCurrentUser(null); }} className={`w-full flex items-center gap-3 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all text-[10px] font-bold uppercase tracking-widest ${isSidebarCollapsed ? 'justify-center p-3' : 'px-4 py-3'}`}>
            <LogOut size={18} />
            {!isSidebarCollapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-slate-600" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24} /></button>
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">INEPAD Consultoria • {isSuper ? 'GESTÃO MASTER' : (clientProfile?.name || currentUser.client_id)}</h2>
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
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Estratégia {currentUser.client_id}</h1>
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-slate-200 w-full sm:w-auto shadow-sm">
                      <Filter size={16} className="text-amber-500" /><select className="text-xs font-bold uppercase outline-none bg-transparent w-full cursor-pointer text-slate-600" value={dashboardFilter} onChange={e => setDashboardFilter(e.target.value)}>
                        <option value="all">Consolidado Geral</option>
                        {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[{ l: 'Concluídas', v: stats.concluida, i: <CheckCircle2 />, c: 'amber' }, { l: 'Deliberações', v: stats.delibs, i: <FileText />, c: 'slate' }, { l: 'Atas na Nuvem', v: stats.atas, i: <FileCheck />, c: 'amber' }, { l: 'Em Atraso', v: stats.atrasadas, i: <AlertCircle />, c: 'red' }].map((s, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 transition-all hover:shadow-md">
                        <div className={`p-3 rounded-lg ${s.c === 'amber' ? 'bg-amber-100 text-amber-600' : s.c === 'red' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{s.i}</div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.l}</p><p className="text-2xl font-bold text-slate-800 mt-1">{s.v}</p></div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[350px]">
                    <div className="bg-slate-900 p-6 rounded-xl shadow-xl flex flex-col h-full"><h3 className="text-xs font-bold uppercase text-amber-500 mb-4 tracking-widest italic">Status das Ações</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>{stats.pieData.map((e, i) => (<Cell key={i} fill={e.color} stroke="none" />))}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} /></PieChart></ResponsiveContainer></div></div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full"><h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest italic">Produtividade Recente</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.barData}><CartesianGrid vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600 }} /><YAxis hide /><Tooltip /><Bar dataKey="Pautas" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} /><Bar dataKey="Ações" fill="#d97706" radius={[4, 4, 0, 0]} barSize={20} /></BarChart></ResponsiveContainer></div></div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                      <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest italic flex items-center gap-2"><ListChecks size={16} className="text-amber-600" /> Resumo do Plano de Ação</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm font-bold italic">
                        <thead className="bg-slate-900 text-[10px] font-bold uppercase text-amber-500 tracking-widest">
                          <tr><th className="px-6 py-4">Iniciativa</th><th className="px-6 py-4">Responsável</th><th className="px-6 py-4">Origem</th><th className="px-6 py-4 text-center">Status</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stats.allActions.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 uppercase text-[10px]">Nenhuma ação pendente</td></tr>
                          ) : (
                            stats.allActions.slice(0, 5).map((acao: any) => (
                              <tr key={`${acao.mId}-${acao.id}`} className="hover:bg-slate-50 transition-all border-l-4 border-l-transparent hover:border-l-amber-500">
                                <td className="px-6 py-4 text-slate-800">{acao.title}</td>
                                <td className="px-6 py-4 text-slate-600">{acao.resp || 'N/D'}</td>
                                <td className="px-6 py-4 text-slate-400 text-[10px] uppercase tracking-widest">{acao.mTitle}</td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`px-3 py-1 rounded-full text-[9px] uppercase font-bold ${acao.status === 'Concluída' ? 'bg-emerald-100 text-emerald-700' : acao.status === 'Em andamento' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{acao.status}</span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeMenu === 'reunioes' && (
                view === 'list' ? (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Conselho Deliberativo</h1>{canEdit && (<button onClick={() => { setCurrentMeeting(blankMeeting); setView('details'); setTab('info'); }} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all shadow-md tracking-widest">+ Nova Reunião</button>)}</div>
                    <div className="grid gap-4">{meetings.map((m) => (<div key={m.id} onClick={() => { setCurrentMeeting(m); setView('details'); setTab('info'); }} className="bg-white p-6 rounded-xl border border-slate-200 flex justify-between items-center group cursor-pointer hover:border-amber-500 hover:shadow-md transition-all shadow-sm"><div className="flex items-center gap-4"><div className="p-3 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-amber-100 group-hover:text-amber-700 transition-all"><Calendar size={24} /></div><div><h3 className="font-bold text-lg text-slate-800 group-hover:text-amber-600 transition-all italic">{m.title}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.status} • {m.date || 'DATA N/D'}</p></div></div><div className="flex items-center gap-3">{canEdit && (<button onClick={(e) => { e.stopPropagation(); deleteMeeting(m.id, m.title); }} className="p-3 text-slate-200 hover:text-red-600 rounded-lg"><Trash2 size={20} /></button>)}<ChevronRight size={20} className="text-slate-300 group-hover:text-amber-500 transition-all" /></div></div>))}</div>
                  </div>
                ) : (
                  <div className="animate-in fade-in duration-300 pb-20">
                    <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-10"><button onClick={() => setView('list')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><ChevronRight className="rotate-180" size={20} /> Voltar</button><div className="flex items-center gap-2">{currentMeeting.id && (<button onClick={() => generateMeetingPDF(currentMeeting, currentUser?.client_id || 'INEPAD')} className="border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-amber-400 hover:text-amber-600 px-4 py-2.5 rounded-lg font-bold text-xs uppercase shadow-sm flex items-center gap-2 transition-all"><Download size={15} /> Exportar PDF</button>)}{currentMeeting.id && (<button onClick={() => generateAtaPDF(currentMeeting, clientProfile?.name || currentUser.client_id, clientProfile?.logo_url).catch((e: any) => alert('Erro ao gerar ata: ' + e.message))} className="border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400 px-4 py-2.5 rounded-lg font-bold text-xs uppercase shadow-sm flex items-center gap-2 transition-all"><FileText size={15} /> Gerar Ata</button>)}{canEdit && (<button onClick={saveMeeting} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase shadow-sm flex items-center gap-2 transition-all"><Save size={16} className="text-amber-500" /> Salvar</button>)}</div></div>
                    <input placeholder="Título..." className="text-3xl md:text-4xl font-bold italic text-slate-900 bg-transparent outline-none w-full border-b border-slate-200 focus:border-amber-500 pb-2 mb-8" value={currentMeeting.title} onChange={e => setCurrentMeeting({ ...currentMeeting, title: e.target.value })} readOnly={!canEdit} />
                    <div className="border-b border-slate-200 flex gap-6 mb-8 overflow-x-auto font-bold text-[10px] uppercase tracking-widest no-scrollbar italic py-2">{['Informações', 'Ordem do Dia', 'Materiais', 'Deliberações', 'Plano de Ação', 'Atas'].map((label, i) => { const ids = ['info', 'pauta', 'materiais', 'delib', 'acoes', 'atas']; return <button key={i} onClick={() => setTab(ids[i])} className={`pb-3 transition-all relative whitespace-nowrap ${tab === ids[i] ? 'text-amber-600 border-b-2 border-amber-600 scale-105' : 'text-slate-400 hover:text-slate-800'}`}>{label}</button> })}</div>

                    {tab === 'info' && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
                        <div className="lg:col-span-2 space-y-6">
                          {canEdit && currentMeeting.id && (<button onClick={() => setIsConvocationOpen(true)} className="w-full py-4 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-700 font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-amber-100 transition-all shadow-sm"><Mail size={18} /> Gerar Convocação Oficial do Conselho</button>)}
                          <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
                            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2 border-b border-slate-50 pb-4"><UserCheck size={16} className="text-amber-600" /> Participantes</h3>
                            <div className="space-y-2">{(currentMeeting.participants || []).map((p: any, i: any) => (
                              <div key={i} className={`flex justify-between items-center p-4 rounded-lg border group transition-all hover:shadow-md font-bold italic ${p.present === false ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100 hover:bg-white'}`}>
                                <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xs font-bold ${p.present === false ? 'bg-red-50 border-red-200 text-red-400' : 'bg-white border-slate-200 text-slate-400'}`}>{p.name[0]}</div>
                                  <div>
                                    <p className={`text-sm ${p.present === false ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                      {p.name} {p.isExternal && <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded uppercase ml-2 border border-amber-200">Convidado</span>}
                                      {p.present === false && <span className="text-[8px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded uppercase ml-2 border border-red-200 not-italic">Ausente</span>}
                                    </p>
                                    <p className="text-[10px] text-slate-400 italic">{p.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {canEdit && (
                                    <button
                                      onClick={() => {
                                        const newParts = (currentMeeting.participants || []).map((pt: any, idx: any) => idx === i ? { ...pt, present: pt.present === false ? true : false } : pt);
                                        setCurrentMeeting({ ...currentMeeting, participants: newParts });
                                      }}
                                      className={`p-2 rounded-lg transition-all ${p.present === false ? 'text-red-400 hover:text-red-600 hover:bg-red-100' : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'}`}
                                      title={p.present === false ? 'Marcar como presente' : 'Marcar como ausente'}
                                    >
                                      {p.present === false ? <UserMinus size={15} /> : <UserCheck size={15} />}
                                    </button>
                                  )}
                                  {canEdit && <button onClick={() => setCurrentMeeting({ ...currentMeeting, participants: (currentMeeting.participants || []).filter((_: any, idx: any) => idx !== i) })} className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16} /></button>}
                                </div>
                              </div>
                            ))}</div>
                            {canEdit && (
                              <div className="p-5 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex flex-col gap-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Membro do Sistema</label>
                                    <select className="w-full p-3 border rounded-lg text-sm bg-white font-bold outline-none"
                                      onChange={e => { const s = users.find(u => u.id === e.target.value); if (s) setTmpPart({ name: s.name, email: s.email, isExternal: false }); }}
                                      value={users.find(u => u.email === tmpPart.email && !tmpPart.isExternal)?.id || ''}>
                                      <option value="">Selecione um membro...</option>
                                      {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Convidado Externo (Nome)</label>
                                    <input type="text" placeholder="Digite o nome..." className="w-full p-3 border rounded-lg text-sm bg-white font-bold outline-none"
                                      value={tmpPart.isExternal ? tmpPart.name : ''}
                                      onChange={e => setTmpPart({ ...tmpPart, name: e.target.value, isExternal: true })} />
                                  </div>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 items-end">
                                  <div className="flex-1 space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">E-mail {tmpPart.isExternal && "(Convidado)"}</label>
                                    <input type="email" placeholder="email@exemplo.com" className="w-full p-3 border rounded-lg text-sm bg-white font-bold outline-none"
                                      value={tmpPart.email}
                                      onChange={e => setTmpPart({ ...tmpPart, email: e.target.value })} />
                                  </div>
                                  <button onClick={() => {
                                    if (tmpPart.name && tmpPart.email) {
                                      setCurrentMeeting({ ...currentMeeting, participants: [...(currentMeeting.participants || []), tmpPart] });
                                      setTmpPart({ name: '', email: '', isExternal: false });
                                    } else { alert("Nome e E-mail são obrigatórios."); }
                                  }} className="h-12 px-6 bg-amber-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-md">Adicionar</button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-6 h-fit"><h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-50 pb-4">Logística</h3><div className="space-y-4"><div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Data</label><input type="date" value={currentMeeting.date} className="w-full p-3 border rounded-lg text-sm font-bold" onChange={e => setCurrentMeeting({ ...currentMeeting, date: e.target.value })} readOnly={!canEdit} /></div><div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Horário</label><input type="time" value={currentMeeting.time} className="w-full p-3 border rounded-lg text-sm font-bold" onChange={e => setCurrentMeeting({ ...currentMeeting, time: e.target.value })} readOnly={!canEdit} /></div></div></div>
                      </div>
                    )}

                    {tab === 'pauta' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-6">
                        <div className="flex justify-between items-center bg-slate-900 p-6 rounded-xl border border-white/10 shadow-lg gap-4">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-600/20 text-amber-500 rounded-lg"><Timer size={24} /></div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimativa Total</p>
                              <p className="text-2xl font-bold text-white italic">{totalEstimatedTime} <span className="text-sm font-normal not-italic text-slate-400">min</span></p>
                            </div>
                          </div>
                          <button onClick={() => {
                            if (!isSessionActive) { setActivePautaIndex(0); setTimeElapsed(0); addLog('Início Sessão', `Reunião iniciada.`); }
                            else { setActivePautaIndex(null); }
                            setIsSessionActive(!isSessionActive);
                          }} className={`px-6 py-3 rounded-lg font-bold text-xs uppercase flex items-center gap-2 transition-all shadow-md ${isSessionActive ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
                            {isSessionActive ? <><Square size={16} /> Encerrar Reunião</> : <><Play size={16} /> Iniciar Reunião</>}
                          </button>
                        </div>
                        <div className="space-y-3">
                          {(currentMeeting.pautas || []).map((p: any, i: any) => (
                            <div key={i} className={`flex flex-col border rounded-lg transition-all group border-l-4 font-bold italic overflow-hidden ${activePautaIndex === i ? 'bg-amber-50 border-amber-500 scale-[1.01] shadow-sm' : 'bg-white border-slate-200'}`}>
                              <div className="flex justify-between items-center p-4">
                                <div className="flex items-center gap-4 flex-1">
                                  <div className="flex flex-col gap-1 mr-2">
                                    {!isSessionActive && canEdit && (<><button onClick={() => handleMovePauta(i, 'up')} className="text-slate-300 hover:text-amber-600 disabled:opacity-0" disabled={i === 0}><ChevronUp size={16} /></button><button onClick={() => handleMovePauta(i, 'down')} className="text-slate-300 hover:text-amber-600 disabled:opacity-0" disabled={i === currentMeeting.pautas.length - 1}><ChevronDown size={16} /></button></>)}
                                    {isSessionActive && activePautaIndex === i && <Play size={16} className="text-amber-500 animate-pulse" />}
                                  </div>
                                  <span className="text-slate-300">#{i + 1}</span>
                                  <div>
                                    <p className="text-sm text-slate-800">{p.title}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">{p.resp} • {p.dur} min {p.realDur && <span className="text-emerald-600 ml-2">Gasto: {p.realDur}min</span>}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  {isSessionActive && activePautaIndex === i && (<><div className={`font-mono text-xl ${timeElapsed > (parseInt(p.dur) * 60) ? 'text-red-600 animate-pulse' : 'text-amber-600'}`}>{formatTime(timeElapsed)}</div><button onClick={() => handleFinalizePauta(i)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2">Próxima <SkipForward size={14} /></button></>)}
                                  {!isSessionActive && canEdit && <button onClick={() => setCurrentMeeting({ ...currentMeeting, pautas: (currentMeeting.pautas || []).filter((_: any, idx: any) => idx !== i) })} className="p-2 text-slate-200 hover:text-red-500 transition-all"><Trash2 size={18} /></button>}
                                  {p.completed && <CheckCircle2 size={20} className="text-emerald-500" />}
                                </div>
                              </div>
                              {!isSessionActive && (
                                <div className="px-4 pb-3 border-t border-slate-50 bg-white" onClick={e => e.stopPropagation()}>
                                  {canEdit && editingObsKey === `pauta-notes-${i}` ? (
                                    <textarea
                                      autoFocus
                                      rows={3}
                                      className="mt-2 w-full text-[10px] text-slate-700 bg-white border border-slate-200 rounded-lg p-2 outline-none resize-none font-normal not-italic focus:border-amber-400 focus:ring-1 focus:ring-amber-100"
                                      value={obsInputValue}
                                      onChange={e => setObsInputValue(e.target.value)}
                                      onBlur={() => {
                                        const newPautas = [...(currentMeeting.pautas || [])];
                                        newPautas[i] = { ...newPautas[i], notes: obsInputValue };
                                        setCurrentMeeting({ ...currentMeeting, pautas: newPautas });
                                        setEditingObsKey(null);
                                      }}
                                      onKeyDown={e => { if (e.key === 'Escape') setEditingObsKey(null); }}
                                      placeholder="Registre os pontos discutidos nesta pauta..."
                                    />
                                  ) : p.notes ? (
                                    <p
                                      className={`mt-2 text-[10px] text-slate-600 bg-slate-50/50 p-2 rounded border border-slate-100 whitespace-pre-wrap font-normal not-italic leading-relaxed ${canEdit ? 'cursor-pointer hover:border-amber-300 transition-colors' : ''}`}
                                      onClick={() => canEdit && (setEditingObsKey(`pauta-notes-${i}`), setObsInputValue(p.notes || ''))}
                                      title={canEdit ? 'Clique para editar' : undefined}
                                    ><span className="font-bold text-amber-600 text-[9px] uppercase tracking-wider">Discussão: </span>{p.notes}</p>
                                  ) : canEdit ? (
                                    <button
                                      className="mt-1.5 text-[9px] text-slate-300 hover:text-amber-500 font-normal not-italic flex items-center gap-1 transition-colors"
                                      onClick={() => { setEditingObsKey(`pauta-notes-${i}`); setObsInputValue(''); }}
                                    ><MessageSquare size={10} /> adicionar notas de discussão</button>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {canEdit && !isSessionActive && (
                          <div className="p-5 bg-slate-50 rounded-xl border border-dashed border-slate-300 grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
                            <div className="sm:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase">Assunto</label><input placeholder="Título" className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpPauta.title} onChange={e => setTmpPauta({ ...tmpPauta, title: e.target.value })} /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase">Resp.</label><select className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpPauta.resp} onChange={e => setTmpPauta({ ...tmpPauta, resp: e.target.value })}><option value="">Selecione...</option>{(currentMeeting.participants || []).map((p: any, i: number) => <option key={i} value={p.name}>{p.name}</option>)}</select></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase">Minutos</label><input type="number" className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpPauta.dur} onChange={e => setTmpPauta({ ...tmpPauta, dur: e.target.value })} /></div>
                            <button onClick={() => { if (tmpPauta.title) { setCurrentMeeting({ ...currentMeeting, pautas: [...(currentMeeting.pautas || []), tmpPauta] }); setTmpPauta({ title: '', resp: '', dur: '' }); } }} className="h-12 bg-amber-600 text-white rounded-lg flex items-center justify-center shadow-md"><Plus size={24} /></button>
                          </div>
                        )}
                      </div>
                    )}

                    {tab === 'materiais' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-6">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-xs font-bold uppercase text-slate-600 tracking-widest flex items-center gap-2">Documentos <span className="bg-red-50 text-red-500 text-[8px] px-2 py-0.5 rounded-full border border-red-100">Somente Internos</span></h3>{canEdit && <button onClick={() => fileRef.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all"><Upload size={14} /> Upload</button>}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{(currentMeeting.materiais || []).map((m: any, i: any) => (<div key={i} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center gap-3 relative group"><FileText size={20} className="text-amber-600" /><div className="flex-1 truncate text-xs font-bold italic">{m.name}</div><a href={m.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-amber-600"><ExternalLink size={14} /></a></div>))}</div>
                      </div>
                    )}

                    {tab === 'delib' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-6" onClick={() => setEditingRespsKey(null)}>
                        {/* Empty state */}
                        {(currentMeeting.deliberacoes || []).length === 0 && (
                          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                            <ListChecks size={52} className="mb-3 opacity-30" />
                            <p className="text-sm font-bold italic">Nenhuma deliberação registrada</p>
                            {canEdit && <p className="text-xs mt-1 font-normal not-italic">Use o formulário abaixo para registrar a primeira proposição</p>}
                          </div>
                        )}
                        {/* Cards de deliberação */}
                        <div className="space-y-4">
                          {(currentMeeting.deliberacoes || []).map((d: any, i: any) => {
                            const voters: string[] = d.voters || [];
                            const votes: Record<string, string> = d.votes || {};
                            // Resolve o nome do votante pelo nome OU pelo e-mail do usuário logado
                            const myVoterName = (() => {
                              if (voters.includes(currentUser?.name)) return currentUser?.name;
                              const match = (currentMeeting.participants || []).find(
                                (p: any) => p.email === currentUser?.email && voters.includes(p.name)
                              );
                              return match?.name ?? null;
                            })();
                            const canUserVote = !!myVoterName;
                            const userVote = myVoterName ? votes[myVoterName] : undefined;
                            const favorCount = voters.filter(v => votes[v] === 'Favor').length;
                            const contraCount = voters.filter(v => votes[v] === 'Contra').length;
                            const abstCount = voters.filter(v => votes[v] === 'Abstenção').length;
                            const totalVoted = favorCount + contraCount + abstCount;
                            const pendingCount = voters.length - totalVoted;
                            const allVoted = voters.length > 0 && pendingCount === 0;
                            const votersKey = `delib-voters-${i}`;
                            const internalParticipants = (currentMeeting.participants || []).filter((p: any) => !p.isExternal);
                            const availableToAdd = internalParticipants.filter((p: any) => !voters.includes(p.name));
                            // Resultado
                            let resultLabel = 'SEM VOTANTES'; let resultCls = 'bg-slate-100 text-slate-400';
                            if (voters.length > 0 && !allVoted) { resultLabel = 'EM VOTAÇÃO'; resultCls = 'bg-amber-100 text-amber-700'; }
                            else if (allVoted && favorCount > contraCount) { resultLabel = 'APROVADA'; resultCls = 'bg-emerald-100 text-emerald-700'; }
                            else if (allVoted && contraCount > favorCount) { resultLabel = 'REJEITADA'; resultCls = 'bg-red-100 text-red-700'; }
                            else if (allVoted) { resultLabel = 'EMPATE'; resultCls = 'bg-slate-100 text-slate-600'; }
                            return (
                              <div key={i} className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white font-bold italic" onClick={e => e.stopPropagation()}>
                                {/* Cabeçalho */}
                                <div className="p-5 flex justify-between items-start gap-4 border-b border-slate-50">
                                  <p className="text-sm text-slate-800 flex-1 leading-relaxed">"{d.title}"</p>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${resultCls}`}>{resultLabel}</span>
                                    {canEdit && <button onClick={e => { e.stopPropagation(); handleDeleteDelib(i); }} className="p-1.5 text-slate-200 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"><Trash2 size={15} /></button>}
                                  </div>
                                </div>
                                {/* Barra de progresso */}
                                {voters.length > 0 && (
                                  <div className="px-5 pt-3 pb-1">
                                    <div className="flex justify-between items-center mb-1.5">
                                      <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider not-italic">Progresso</span>
                                      <span className="text-[9px] font-bold text-slate-500 not-italic">{totalVoted} de {voters.length} {voters.length === 1 ? 'voto' : 'votos'}</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                                      <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${voters.length > 0 ? (favorCount / voters.length) * 100 : 0}%` }} />
                                      <div className="bg-red-500 transition-all duration-500" style={{ width: `${voters.length > 0 ? (contraCount / voters.length) * 100 : 0}%` }} />
                                      <div className="bg-slate-300 transition-all duration-500" style={{ width: `${voters.length > 0 ? (abstCount / voters.length) * 100 : 0}%` }} />
                                    </div>
                                  </div>
                                )}
                                {/* Painel de voto do usuário */}
                                {canUserVote && (
                                  <div className="mx-5 my-3 p-4 bg-amber-50 rounded-xl border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                      <span className="text-[9px] font-black uppercase text-amber-700 tracking-widest">Seu voto</span>
                                      {userVote && <p className="text-[9px] text-amber-600 font-normal not-italic mt-0.5">Registrado: <strong>{userVote}</strong> — clique em outro para alterar</p>}
                                      {!userVote && <p className="text-[9px] text-amber-500/70 font-normal not-italic mt-0.5">Selecione sua posição abaixo</p>}
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                      <button onClick={() => handleRegisterVote(i, 'Favor')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-bold uppercase transition-all shadow-sm ${userVote === 'Favor' ? 'bg-emerald-600 text-white ring-2 ring-emerald-300' : 'bg-white border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50'}`}><ThumbsUp size={12} /> Favor</button>
                                      <button onClick={() => handleRegisterVote(i, 'Contra')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-bold uppercase transition-all shadow-sm ${userVote === 'Contra' ? 'bg-red-600 text-white ring-2 ring-red-300' : 'bg-white border border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50'}`}><ThumbsDown size={12} /> Contra</button>
                                      <button onClick={() => handleRegisterVote(i, 'Abstenção')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-bold uppercase transition-all shadow-sm ${userVote === 'Abstenção' ? 'bg-slate-600 text-white ring-2 ring-slate-300' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400 hover:bg-slate-50'}`}><CircleSlash size={12} /> Abster</button>
                                    </div>
                                  </div>
                                )}
                                {/* Votantes + placar */}
                                <div className="p-5 border-t border-slate-50 flex flex-col sm:flex-row gap-5">
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider not-italic">Votantes ({voters.length})</span>
                                      {canEdit && (
                                        <div className="relative" onClick={e => e.stopPropagation()}>
                                          <button onClick={() => setEditingRespsKey(editingRespsKey === votersKey ? null : votersKey)} className="text-[9px] font-bold not-italic text-slate-300 hover:text-amber-500 transition-colors flex items-center gap-1"><Plus size={10} /> adicionar</button>
                                          {editingRespsKey === votersKey && (
                                            <div className="absolute top-6 right-0 z-30 bg-white border border-slate-200 rounded-lg shadow-2xl py-1 w-52 animate-in zoom-in-95">
                                              <p className="px-3 pt-2 pb-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Adicionar votante</p>
                                              {availableToAdd.length === 0
                                                ? <p className="px-3 py-2 text-[9px] text-slate-300 italic font-normal">Todos os membros já adicionados</p>
                                                : availableToAdd.map((p: any, pi: number) => (
                                                  <button key={pi} className="w-full text-left px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-2 not-italic"
                                                    onClick={() => { updateDelibVoters(i, [...voters, p.name]); setEditingRespsKey(null); }}>
                                                    <span className="w-5 h-5 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-[8px] font-black shrink-0">{p.name[0]}</span>{p.name}
                                                  </button>
                                                ))
                                              }
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {voters.length === 0 && <span className="text-[9px] text-slate-300 italic font-normal">Nenhum votante definido</span>}
                                      {voters.map((v: string) => {
                                        const vote = votes[v];
                                        return (
                                          <span key={v} className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full text-[9px] font-bold transition-all border ${vote === 'Favor' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : vote === 'Contra' ? 'bg-red-50 text-red-700 border-red-200' : vote === 'Abstenção' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-white text-slate-400 border-dashed border-slate-200'}`}>
                                            <span className="w-4 h-4 rounded-full bg-slate-700 text-white flex items-center justify-center text-[7px] font-black shrink-0">{v[0]}</span>
                                            {v}
                                            {vote === 'Favor' && <Check size={9} className="text-emerald-600 ml-0.5" />}
                                            {vote === 'Contra' && <X size={9} className="text-red-500 ml-0.5" />}
                                            {vote === 'Abstenção' && <MinusCircle size={9} className="text-slate-400 ml-0.5" />}
                                            {!vote && <span className="ml-0.5 text-[7px] text-slate-300 font-normal not-italic">pendente</span>}
                                            {canEdit && <button onClick={e => { e.stopPropagation(); updateDelibVoters(i, voters.filter(x => x !== v)); }} className="ml-0.5 text-slate-300 hover:text-red-500 transition-colors"><X size={8} /></button>}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  {voters.length > 0 && (
                                    <div className="flex sm:flex-col gap-2 flex-wrap">
                                      {[{ l: 'Favor', n: favorCount, cls: 'bg-emerald-50 text-emerald-700' }, { l: 'Contra', n: contraCount, cls: 'bg-red-50 text-red-700' }, { l: 'Abstenção', n: abstCount, cls: 'bg-slate-100 text-slate-500' }, ...(pendingCount > 0 ? [{ l: 'Pendente', n: pendingCount, cls: 'bg-amber-50 text-amber-600' }] : [])].map(s => (
                                        <div key={s.l} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${s.cls}`}>
                                          <span className="text-xl font-black leading-none">{s.n}</span>
                                          <span className="text-[8px] font-bold uppercase opacity-70 not-italic">{s.l}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Formulário nova deliberação */}
                        {canEdit && (
                          <div className="p-6 bg-amber-50 rounded-xl border border-amber-200 space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-amber-700 italic tracking-widest flex items-center gap-2"><ListChecks size={14} /> Nova Deliberação</h4>
                            <textarea placeholder="Descreva a proposição a ser deliberada..." className="w-full p-4 border border-amber-200 bg-white rounded-lg text-sm h-24 font-bold italic outline-none resize-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200" value={tmpDelib.title} onChange={e => setTmpDelib({ ...tmpDelib, title: e.target.value })} />
                            <div className="space-y-2">
                              <label className="text-[9px] font-bold uppercase text-amber-700 tracking-widest">Atribuir direito a voto</label>
                              {(() => {
                                const internalMembers = (currentMeeting.participants || []).filter((p: any) => !p.isExternal);
                                const available = internalMembers.filter((p: any) => !tmpDelib.voters.includes(p.name));
                                if (internalMembers.length === 0) {
                                  return (
                                    <div className="p-4 bg-white border border-dashed border-amber-300 rounded-lg flex items-center gap-3 text-amber-600">
                                      <UserCheck size={18} className="shrink-0 opacity-60" />
                                      <div>
                                        <p className="text-[10px] font-bold">Nenhum membro interno nesta reunião</p>
                                        <p className="text-[9px] font-normal not-italic mt-0.5">Adicione participantes na aba <strong>Informações</strong> antes de atribuir votantes.</p>
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <div className="p-3 bg-white border border-amber-200 rounded-lg min-h-[48px] flex flex-wrap gap-2 items-center">
                                    {tmpDelib.voters.map((v: string) => (
                                      <span key={v} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[9px] font-bold px-2 py-1 rounded-full">
                                        <span className="w-4 h-4 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-[7px] font-black shrink-0">{v[0]}</span>{v}
                                        <button onClick={() => setTmpDelib({ ...tmpDelib, voters: tmpDelib.voters.filter((x: string) => x !== v) })} className="text-slate-400 hover:text-red-500 ml-0.5"><X size={8} /></button>
                                      </span>
                                    ))}
                                    {available.length > 0 && (
                                      <select className="text-[9px] font-bold text-amber-600 bg-transparent outline-none cursor-pointer border border-dashed border-amber-300 rounded px-2 py-1 hover:border-amber-500 transition-colors" value="" onChange={e => { if (e.target.value) setTmpDelib({ ...tmpDelib, voters: [...tmpDelib.voters, e.target.value] }); }}>
                                        <option value="">+ adicionar votante</option>
                                        {available.map((p: any, pi: number) => <option key={pi} value={p.name}>{p.name}</option>)}
                                      </select>
                                    )}
                                    {available.length === 0 && tmpDelib.voters.length > 0 && (
                                      <span className="text-[8px] text-slate-300 italic font-normal">Todos os membros adicionados</span>
                                    )}
                                  </div>
                                );
                              })()}
                              <p className="text-[8px] text-amber-600/60 font-normal not-italic">Apenas membros internos podem votar. Convidados externos são excluídos automaticamente.</p>
                            </div>
                            <button onClick={() => { if (tmpDelib.title.trim()) { setCurrentMeeting({ ...currentMeeting, deliberacoes: [...(currentMeeting.deliberacoes || []), { ...tmpDelib, votes: {} }] }); setTmpDelib({ title: '', voters: [], votes: {} }); } }} className="w-full py-4 bg-slate-900 text-amber-500 rounded-lg font-bold uppercase text-[10px] tracking-widest shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"><Check size={16} /> Registrar Deliberação</button>
                          </div>
                        )}
                      </div>
                    )}

                    {tab === 'acoes' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-6">
                        <div className="space-y-3">
                          {(currentMeeting.acoes || []).map((a: any, i: any) => {
                            const meetingObsKey = `meeting-obs-${i}`;
                            const meetingRespsKey = `meeting-resp-${i}`;
                            const resps: string[] = a.resps?.length > 0 ? a.resps : (a.resp ? [a.resp] : []);
                            return (
                              <div key={a.id || i} className="p-4 bg-white rounded-lg border border-l-4 border-l-emerald-500 shadow-sm flex flex-col group font-bold italic" onClick={() => { if (editingRespsKey === meetingRespsKey) setEditingRespsKey(null); }}>
                                <div className="flex justify-between items-start w-full gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-800">{a.title}</p>
                                    {/* Responsáveis chips */}
                                    <div className="flex flex-wrap gap-1 mt-2 items-center" onClick={e => e.stopPropagation()}>
                                      {resps.length === 0 && <span className="text-[10px] text-slate-300 italic font-normal">Sem responsável</span>}
                                      {resps.map((r: string) => (
                                        <span key={r} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[9px] font-bold px-2 py-1 rounded-full">
                                          <span className="w-4 h-4 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-[8px] font-black shrink-0">{r[0]}</span>
                                          {r}
                                          {canEdit && <button className="text-slate-400 hover:text-red-500 ml-0.5" onClick={() => { const nr = resps.filter(x => x !== r); setCurrentMeeting({ ...currentMeeting, acoes: (currentMeeting.acoes || []).map((ac: any, idx: any) => idx === i ? { ...ac, resps: nr, resp: nr[0] || '' } : ac) }); }}><X size={8} /></button>}
                                        </span>
                                      ))}
                                      {canEdit && (
                                        <div className="relative">
                                          <button className="text-[9px] text-slate-300 hover:text-amber-500 font-normal not-italic flex items-center gap-1 transition-colors" onClick={e => { e.stopPropagation(); setEditingRespsKey(editingRespsKey === meetingRespsKey ? null : meetingRespsKey); }}>
                                            <Plus size={10} /> resp.
                                          </button>
                                          {editingRespsKey === meetingRespsKey && (
                                            <div className="absolute top-6 left-0 z-30 bg-white border border-slate-200 rounded-lg shadow-2xl py-1 w-48 animate-in zoom-in-95">
                                              <p className="px-3 pt-2 pb-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Adicionar responsável</p>
                                              {(currentMeeting.participants || []).filter((p: any) => !p.isExternal && !resps.includes(p.name)).map((p: any, pi: number) => (
                                                <button key={pi} className="w-full text-left px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-2"
                                                  onClick={e => { e.stopPropagation(); const nr = [...resps, p.name]; setCurrentMeeting({ ...currentMeeting, acoes: (currentMeeting.acoes || []).map((ac: any, idx: any) => idx === i ? { ...ac, resps: nr, resp: nr[0] || '' } : ac) }); setEditingRespsKey(null); }}>
                                                  <span className="w-5 h-5 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-[8px] font-black shrink-0">{p.name[0]}</span>
                                                  {p.name}
                                                </button>
                                              ))}
                                              {(currentMeeting.participants || []).filter((p: any) => !p.isExternal && !resps.includes(p.name)).length === 0 && (
                                                <p className="px-3 py-2 text-[9px] text-slate-300 italic">Todos já adicionados</p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 uppercase mt-1 tracking-widest">{a.date}</p>
                                  </div>
                                  {canEdit && <button onClick={() => setCurrentMeeting({ ...currentMeeting, acoes: (currentMeeting.acoes || []).filter((_: any, idx: any) => idx !== i) })} className="shrink-0"><Trash2 size={18} className="text-slate-200 hover:text-red-500" /></button>}
                                </div>
                                {/* OBS inline editável */}
                                {canEdit && editingObsKey === meetingObsKey ? (
                                  <textarea autoFocus rows={2}
                                    className="mt-2 w-full text-[10px] text-amber-700 bg-amber-50 border border-amber-300 rounded p-1.5 outline-none resize-none font-normal not-italic"
                                    value={obsInputValue}
                                    onChange={e => setObsInputValue(e.target.value)}
                                    onBlur={() => { setCurrentMeeting({ ...currentMeeting, acoes: (currentMeeting.acoes || []).map((ac: any, idx: any) => idx === i ? { ...ac, obs: obsInputValue } : ac) }); setEditingObsKey(null); }}
                                    onKeyDown={e => { if (e.key === 'Escape') setEditingObsKey(null); }}
                                    placeholder="Digite uma observação..."
                                  />
                                ) : a.obs ? (
                                  <p className={`mt-2 text-[10px] text-amber-700 bg-amber-50/50 p-2 rounded border border-amber-100/50 whitespace-pre-wrap font-normal not-italic ${canEdit ? 'cursor-pointer hover:border-amber-300 transition-colors' : ''}`}
                                    onClick={() => canEdit && (setEditingObsKey(meetingObsKey), setObsInputValue(a.obs || ''))}
                                    title={canEdit ? 'Clique para editar' : undefined}>OBS: {a.obs}</p>
                                ) : canEdit ? (
                                  <button className="mt-2 text-[9px] text-slate-300 hover:text-amber-500 font-normal not-italic flex items-center gap-1 transition-colors self-start"
                                    onClick={() => { setEditingObsKey(meetingObsKey); setObsInputValue(''); }}>
                                    <MessageSquare size={10} /> adicionar nota
                                  </button>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                        {canEdit && (
                          <div className="p-5 bg-slate-50 border border-dashed border-slate-300 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                            <div className="sm:col-span-5"><label className="text-[10px] font-bold text-slate-400 uppercase">Ação</label><input placeholder="Título" className="w-full p-3 border rounded-lg text-sm bg-white font-bold italic" value={tmpAcao.title} onChange={e => setTmpAcao({ ...tmpAcao, title: e.target.value })} /></div>
                            <div className="sm:col-span-4 space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Responsáveis</label>
                              <div className="p-2.5 border border-slate-200 rounded-lg bg-white min-h-[46px] flex flex-wrap gap-1.5 items-center">
                                {tmpAcao.resps.map(r => (
                                  <span key={r} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[9px] font-bold px-2 py-1 rounded-full">
                                    <span className="w-4 h-4 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-[8px] font-black shrink-0">{r[0]}</span>
                                    {r}
                                    <button onClick={() => setTmpAcao({ ...tmpAcao, resps: tmpAcao.resps.filter(x => x !== r) })} className="text-slate-400 hover:text-red-500 ml-0.5"><X size={8} /></button>
                                  </span>
                                ))}
                                <select className="text-[9px] font-bold text-slate-400 bg-transparent outline-none cursor-pointer" value="" onChange={e => { if (e.target.value && !tmpAcao.resps.includes(e.target.value)) setTmpAcao({ ...tmpAcao, resps: [...tmpAcao.resps, e.target.value] }); }}>
                                  <option value="">+ pessoa</option>
                                  {(currentMeeting.participants || []).filter((p: any) => !p.isExternal && !tmpAcao.resps.includes(p.name)).map((p: any, pi: number) => <option key={pi} value={p.name}>{p.name}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="sm:col-span-3"><label className="text-[10px] font-bold text-slate-400 uppercase">Prazo</label><input type="date" className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpAcao.date} onChange={e => setTmpAcao({ ...tmpAcao, date: e.target.value })} /></div>
                            <div className="sm:col-span-12"><label className="text-[10px] font-bold text-slate-400 uppercase">Observação (opcional)</label><input placeholder="Contexto ou detalhes da ação..." className="w-full p-3 border rounded-lg text-sm bg-white font-normal italic mt-1" value={tmpAcao.obs} onChange={e => setTmpAcao({ ...tmpAcao, obs: e.target.value })} /></div>
                            <div className="sm:col-span-12"><button onClick={() => { if (tmpAcao.title) { setCurrentMeeting({ ...currentMeeting, acoes: [...(currentMeeting.acoes || []), { ...tmpAcao, resp: tmpAcao.resps[0] || '', id: Date.now() }] }); setTmpAcao({ title: '', resps: [], resp: '', date: '', status: 'Pendente', obs: '' }); } }} className="w-full p-3 bg-emerald-600 text-white rounded-lg flex items-center justify-center shadow-md font-bold uppercase text-[10px] tracking-widest"><Plus size={18} className="mr-2" /> Adicionar Iniciativa</button></div>
                          </div>
                        )}
                      </div>
                    )}

                                        {tab === 'atas' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-8"><div className="flex justify-between items-center border-b border-slate-50 pb-4"><h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest">Atas Finais</h3>{canEdit && <button onClick={() => ataRef.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all"><Upload size={14} /> Carregar</button>}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{(currentMeeting.atas || []).map((ata: any, i: any) => (<div key={i} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center gap-4 group italic font-bold"><div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><FileCheck size={24} /></div><div className="flex-1 truncate text-sm">{ata.name}</div><button onClick={() => openAtaUrl(ata.url)} className="text-slate-300 hover:text-amber-600 transition-colors"><ExternalLink size={18} /></button></div>))}</div></div>
                    )}
                  </div>
                )
              )}

              {activeMenu === 'repositorio-atas' && (
                <div className="space-y-6 animate-in fade-in">

                  {/* Cabeçalho */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-3">
                        <Archive size={24} className="text-amber-600" /> Repositório de Atas
                      </h1>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {allAtas.length} {allAtas.length === 1 ? 'documento' : 'documentos'} em{' '}
                        {new Set(allAtas.map((a: any) => a.meetingId)).size} {new Set(allAtas.map((a: any) => a.meetingId)).size === 1 ? 'reunião' : 'reuniões'}
                      </p>
                    </div>
                    {/* Busca */}
                    <div className="relative w-full sm:w-80">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Buscar por nome ou reunião..."
                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 bg-white transition-all"
                        value={atasSearch}
                        onChange={e => setAtasSearch(e.target.value)}
                      />
                      {atasSearch && (
                        <button onClick={() => setAtasSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Estado vazio — sem atas */}
                  {allAtas.length === 0 && (
                    <div className="bg-white rounded-xl border border-dashed border-slate-200 py-24 flex flex-col items-center justify-center text-slate-300 shadow-sm">
                      <Archive size={52} className="mb-4 opacity-30" />
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Nenhuma ata publicada ainda</p>
                      <p className="text-[10px] font-normal text-slate-300 mt-2 not-italic">
                        Publique atas nas reuniões para que apareçam aqui.
                      </p>
                    </div>
                  )}

                  {/* Estado vazio — busca sem resultado */}
                  {allAtas.length > 0 && filteredAtas.length === 0 && (
                    <div className="bg-white rounded-xl border border-dashed border-slate-200 py-16 flex flex-col items-center justify-center text-slate-300 shadow-sm">
                      <Search size={36} className="mb-3 opacity-30" />
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Nenhum resultado para "{atasSearch}"</p>
                      <button onClick={() => setAtasSearch('')} className="mt-4 text-[10px] font-bold text-amber-600 hover:text-amber-700 uppercase tracking-widest transition-colors">
                        Limpar busca
                      </button>
                    </div>
                  )}

                  {/* Grid de cards */}
                  {filteredAtas.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredAtas.map((ata: any, i: number) => (
                        <div key={`${ata.meetingId}-${i}`}
                          className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md hover:border-amber-300 transition-all group">

                          {/* Ícone + nome do arquivo */}
                          <div className="flex items-start gap-3">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg shrink-0 group-hover:bg-amber-100 transition-colors">
                              <FileCheck size={22} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 leading-snug break-words line-clamp-2" title={ata.name}>
                                {ata.name}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                                {ata.uploadedAt
                                  ? new Date(ata.uploadedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                                  : 'Data não registrada'}
                              </p>
                            </div>
                          </div>

                          {/* Reunião de origem */}
                          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
                            <Calendar size={12} className="text-amber-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-slate-700 truncate italic">{ata.meetingTitle}</p>
                              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                                {ata.meetingDate
                                  ? new Date(ata.meetingDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                                  : 'Data n/d'}
                                {' '}•{' '}
                                <span className={`${ata.meetingStatus === 'Concluída' ? 'text-emerald-500' : ata.meetingStatus === 'Em Andamento' ? 'text-amber-500' : 'text-slate-400'}`}>
                                  {ata.meetingStatus}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-2 mt-auto">
                            <button
                              onClick={() => openAtaUrl(ata.url)}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
                            >
                              <ExternalLink size={13} /> Abrir
                            </button>
                            <button
                              onClick={() => {
                                const m = meetings.find((m: any) => m.id === ata.meetingId);
                                if (m) { setCurrentMeeting(m); setView('details'); setTab('atas'); setActiveMenu('reunioes'); }
                              }}
                              className="px-3 py-2.5 border border-slate-200 hover:border-amber-300 hover:text-amber-600 text-slate-400 rounded-lg text-[10px] transition-all"
                              title="Ver na reunião"
                            >
                              <ChevronRight size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeMenu === 'plano-acao' && (
                <div className="space-y-6 animate-in fade-in" onClick={() => { if (editingRespsKey) setEditingRespsKey(null); }}>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Plano Global</h1>
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200 w-full md:w-auto">
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200"><User size={14} className="text-amber-500" /><select className="text-[10px] font-bold uppercase outline-none bg-transparent cursor-pointer text-slate-600" value={filterResp} onChange={e => setFilterResp(e.target.value)}><option value="all">Responsável</option>{[...new Set(meetings.flatMap((m: any) => (m.acoes || []).flatMap((a: any) => a.resps?.length > 0 ? a.resps : (a.resp ? [a.resp] : []))))].filter(Boolean).map((r: any) => <option key={r} value={r}>{r}</option>)}</select></div>
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200"><Target size={14} className="text-amber-500" /><select className="text-[10px] font-bold uppercase outline-none bg-transparent cursor-pointer text-slate-600" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="all">Status</option><option value="Pendente">Pendente</option><option value="Em andamento">Em andamento</option><option value="Concluída">Concluída</option></select></div>
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200"><Building2 size={14} className="text-amber-500" /><select className="text-[10px] font-bold uppercase outline-none bg-transparent cursor-pointer text-slate-600" value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)}><option value="all">Origem (Reunião)</option>{meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[1100px] font-bold italic">
                      <thead className="bg-slate-900 text-[10px] font-bold uppercase text-amber-500 tracking-widest">
                        <tr><th className="px-6 py-4">Iniciativa</th><th className="px-5 py-4">Responsável(is)</th><th className="px-6 py-4">Origem</th><th className="px-6 py-4">Prazo</th><th className="px-6 py-4">Status</th>{canEdit && <th className="px-6 py-4 text-center">Ação</th>}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stats.allActions.length === 0 && (
                          <tr><td colSpan={canEdit ? 6 : 5} className="px-6 py-10 text-center text-slate-400 text-[10px] uppercase tracking-widest">Nenhuma ação registrada</td></tr>
                        )}
                        {stats.allActions.map((acao: any) => {
                          const acaoKey = `${acao.mId}-${acao.id}`;
                          const resps: string[] = acao.resps?.length > 0 ? acao.resps : (acao.resp ? [acao.resp] : []);
                          return (
                            <tr key={acaoKey} className="hover:bg-slate-50 transition-all align-top">
                              {/* INICIATIVA + OBS INLINE */}
                              <td className="px-6 py-4 text-slate-800 max-w-xs">
                                <p className="leading-snug">{acao.title}</p>
                                {canEdit && editingObsKey === acaoKey ? (
                                  <textarea
                                    autoFocus
                                    rows={2}
                                    className="mt-1.5 w-full text-[10px] text-amber-700 bg-amber-50 border border-amber-300 rounded p-1.5 outline-none resize-none font-normal not-italic"
                                    value={obsInputValue}
                                    onChange={e => setObsInputValue(e.target.value)}
                                    onBlur={() => { updateActionObsGlobal(acao.mId, acao.id, obsInputValue); setEditingObsKey(null); }}
                                    onKeyDown={e => { if (e.key === 'Escape') setEditingObsKey(null); }}
                                    placeholder="Digite uma observação..."
                                  />
                                ) : acao.obs ? (
                                  <p
                                    className={`mt-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1 font-normal not-italic whitespace-pre-wrap leading-relaxed ${canEdit ? 'cursor-pointer hover:border-amber-300 transition-colors' : ''}`}
                                    onClick={() => canEdit && (setEditingObsKey(acaoKey), setObsInputValue(acao.obs || ''))}
                                    title={canEdit ? 'Clique para editar' : undefined}
                                  >{acao.obs}</p>
                                ) : canEdit ? (
                                  <button
                                    className="mt-1 text-[9px] text-slate-300 hover:text-amber-500 font-normal not-italic flex items-center gap-1 transition-colors"
                                    onClick={() => { setEditingObsKey(acaoKey); setObsInputValue(''); }}
                                  ><MessageSquare size={10} /> adicionar nota</button>
                                ) : null}
                              </td>

                              {/* RESPONSÁVEIS — chips + dropdown */}
                              <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex flex-wrap gap-1">
                                    {resps.length === 0 && <span className="text-[10px] text-slate-300 italic font-normal">Sem responsável</span>}
                                    {resps.map((r: string) => (
                                      <span key={r} className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-bold px-2 py-1 rounded-full transition-colors">
                                        <span className="w-4 h-4 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-[8px] font-black shrink-0">{r[0]}</span>
                                        {r}
                                        {canEdit && (
                                          <button className="text-slate-400 hover:text-red-500 ml-0.5 transition-colors" onClick={() => updateActionRespsGlobal(acao.mId, acao.id, resps.filter(x => x !== r))}>
                                            <X size={8} />
                                          </button>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                  {canEdit && (
                                    <div className="relative">
                                      <button
                                        className="text-[9px] text-slate-400 hover:text-amber-600 font-normal not-italic flex items-center gap-1 transition-colors"
                                        onClick={e => { e.stopPropagation(); setEditingRespsKey(editingRespsKey === acaoKey ? null : acaoKey); }}
                                      ><Plus size={10} /> adicionar</button>
                                      {editingRespsKey === acaoKey && (
                                        <div className="absolute top-6 left-0 z-30 bg-white border border-slate-200 rounded-lg shadow-2xl py-1 w-52 animate-in zoom-in-95">
                                          <p className="px-3 pt-2 pb-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Adicionar responsável</p>
                                          {users.filter((u: any) => !resps.includes(u.name)).map((u: any) => (
                                            <button
                                              key={u.id}
                                              className="w-full text-left px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-2"
                                              onClick={e => { e.stopPropagation(); updateActionRespsGlobal(acao.mId, acao.id, [...resps, u.name]); setEditingRespsKey(null); }}
                                            >
                                              <span className="w-5 h-5 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-[8px] font-black shrink-0">{u.name[0]}</span>
                                              {u.name}
                                            </button>
                                          ))}
                                          {users.every((u: any) => resps.includes(u.name)) && (
                                            <p className="px-3 py-2 text-[9px] text-slate-300 italic">Todos já adicionados</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4 text-slate-400 text-[10px] uppercase tracking-widest">{acao.mTitle}</td>
                              <td className="px-6 py-4"><input type="date" className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-600" value={acao.date || ''} onChange={e => updateActionDateGlobal(acao.mId, acao.id, e.target.value)} disabled={!canEdit} /></td>
                              <td className="px-6 py-4 text-center"><select value={acao.status} onChange={e => updateActionStatusGlobal(acao.mId, acao.id, e.target.value)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-amber-50 text-amber-700 cursor-pointer" disabled={!canEdit}><option value="Pendente">Aguardando</option><option value="Em andamento">Execução</option><option value="Concluída">Finalizado</option></select></td>
                              {canEdit && <td className="px-6 py-4 text-center"><button onClick={() => deleteActionGlobal(acao.mId, acao.id)} className="text-slate-200 hover:text-red-600 transition-colors"><Trash2 size={16} /></button></td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* FORMULÁRIO — Nova Ação Global */}
                  {canEdit && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                      <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4"><Plus size={14} className="text-amber-600" /> Nova Iniciativa</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                        <div className="sm:col-span-4 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Título da Ação</label>
                          <input placeholder="Descreva a iniciativa..." className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-white font-bold italic outline-none focus:border-amber-500 transition-colors" value={tmpGlobalAcao.title} onChange={e => setTmpGlobalAcao({ ...tmpGlobalAcao, title: e.target.value })} />
                        </div>
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Reunião de Origem</label>
                          <select className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-white font-bold outline-none focus:border-amber-500 transition-colors" value={tmpGlobalAcao.meetingId} onChange={e => setTmpGlobalAcao({ ...tmpGlobalAcao, meetingId: e.target.value })}>
                            <option value="">Selecione a reunião...</option>
                            {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                          </select>
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Prazo</label>
                          <input type="date" className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-white font-bold outline-none focus:border-amber-500 transition-colors" value={tmpGlobalAcao.date} onChange={e => setTmpGlobalAcao({ ...tmpGlobalAcao, date: e.target.value })} />
                        </div>
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Responsáveis</label>
                          <div className="p-3 border border-slate-200 rounded-lg bg-white min-h-[46px] flex flex-wrap gap-1.5 items-center">
                            {tmpGlobalAcao.resps.map(r => (
                              <span key={r} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[9px] font-bold px-2 py-1 rounded-full">
                                <span className="w-4 h-4 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-[8px] font-black shrink-0">{r[0]}</span>
                                {r}
                                <button onClick={() => setTmpGlobalAcao({ ...tmpGlobalAcao, resps: tmpGlobalAcao.resps.filter(x => x !== r) })} className="text-slate-400 hover:text-red-500 ml-0.5"><X size={8} /></button>
                              </span>
                            ))}
                            <select className="text-[9px] font-bold text-slate-400 bg-transparent outline-none cursor-pointer" value="" onChange={e => { if (e.target.value && !tmpGlobalAcao.resps.includes(e.target.value)) setTmpGlobalAcao({ ...tmpGlobalAcao, resps: [...tmpGlobalAcao.resps, e.target.value] }); }}>
                              <option value="">+ pessoa</option>
                              {users.filter((u: any) => !tmpGlobalAcao.resps.includes(u.name)).map((u: any) => <option key={u.id} value={u.name}>{u.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="sm:col-span-9 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Observação (opcional)</label>
                          <input placeholder="Contexto, detalhes ou links relevantes..." className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-white font-normal italic outline-none focus:border-amber-500 transition-colors" value={tmpGlobalAcao.obs} onChange={e => setTmpGlobalAcao({ ...tmpGlobalAcao, obs: e.target.value })} />
                        </div>
                        <div className="sm:col-span-3">
                          <button onClick={saveGlobalAction} className="w-full p-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center justify-center gap-2 shadow-md font-bold uppercase text-[10px] tracking-widest transition-all">
                            <Plus size={16} /> Registrar Ação
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==================== SEÇÃO DE USUÁRIOS ==================== */}
              {activeMenu === 'usuarios' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">
                      {isSuper ? 'Contas de Clientes' : 'Conselheiros'}
                    </h1>
                  </div>

                  {/* PERFIL DA EMPRESA */}
                  {isAdm && (
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
                      <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-100 pb-4 flex items-center gap-2">
                        <Building2 size={16} className="text-amber-600" /> Perfil da Empresa
                      </h3>
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        {/* Preview da logo */}
                        <div className="shrink-0">
                          <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                            {clientProfileForm.logo_url
                              ? <img src={clientProfileForm.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                              : <div className="flex flex-col items-center gap-1 text-slate-300"><Camera size={28} /><span className="text-[9px] font-bold uppercase">Sem logo</span></div>
                            }
                          </div>
                          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                          <button onClick={() => logoRef.current?.click()} className="mt-2 w-28 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 border border-slate-200 rounded-lg hover:border-amber-400 hover:text-amber-600 transition-colors flex items-center justify-center gap-1">
                            <Upload size={11} /> Carregar logo
                          </button>
                        </div>
                        {/* Campos */}
                        <div className="flex-1 space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome da Empresa</label>
                            <input type="text" placeholder="Ex: RealFlex Indústria S.A." className="w-full p-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 transition-colors" value={clientProfileForm.name} onChange={e => setClientProfileForm(p => ({ ...p, name: e.target.value }))} />
                            <p className="text-[9px] text-slate-400 font-normal">Este nome aparece no cabeçalho e nos documentos gerados.</p>
                          </div>
                          {clientProfileForm.logo_url && (
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">URL da Logo</label>
                              <input type="text" readOnly className="w-full p-3 border border-slate-100 rounded-lg text-xs bg-slate-50 text-slate-400 outline-none cursor-default" value={clientProfileForm.logo_url} />
                            </div>
                          )}
                          <button onClick={saveClientProfile} disabled={savingClientProfile} className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-md disabled:opacity-50">
                            <Save size={14} /> {savingClientProfile ? 'Salvando...' : 'Salvar Perfil'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FORMULÁRIO DE CADASTRO */}
                  {isAdm && (
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                      <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-100 pb-4 flex items-center gap-2">
                        <UserPlus size={16} className="text-amber-600" /> Cadastrar Novo Membro
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome Completo</label>
                          <input type="text" placeholder="Nome do conselheiro" className="w-full p-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 transition-colors" value={newUserForm.name} onChange={e => setnewUserForm({ ...newUserForm, name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail Corporativo</label>
                          <input type="email" placeholder="email@empresa.com.br" className="w-full p-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 transition-colors" value={newUserForm.email} onChange={e => setnewUserForm({ ...newUserForm, email: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Senha Provisória</label>
                          <input type="password" placeholder="Mínimo 8 caracteres com letras e números" className="w-full p-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 transition-colors" value={newUserForm.password} onChange={e => setnewUserForm({ ...newUserForm, password: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Papel (Role)</label>
                          <select className="w-full p-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 transition-colors bg-white" value={newUserForm.role} onChange={e => setnewUserForm({ ...newUserForm, role: e.target.value })}>
                            <option value="Conselheiro">Conselheiro</option>
                            <option value="Secretário">Secretário</option>
                            <option value="Administrador">Administrador</option>
                            {isSuper && <option value="SuperAdmin">SuperAdmin</option>}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa (Client ID)</label>
                          {isSuper ? (
                            <input type="text" placeholder="Ex: EMPRESA_XYZ" className="w-full p-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 transition-colors" value={newUserForm.client_id} onChange={e => setnewUserForm({ ...newUserForm, client_id: e.target.value.toUpperCase() })} />
                          ) : (
                            <input type="text" className="w-full p-3 border border-slate-100 rounded-lg text-sm font-bold outline-none bg-slate-50 text-slate-400 cursor-not-allowed" value={currentUser.client_id} readOnly />
                          )}
                        </div>
                      </div>
                      <button disabled={loading} onClick={handleCreateUser} className="w-full sm:w-auto px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50">
                        <UserPlus size={16} /> {loading ? 'Cadastrando...' : 'Cadastrar Membro'}
                      </button>
                    </div>
                  )}

                  {/* TABELA DE MEMBROS */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[500px] font-bold italic">
                      <thead className="bg-slate-900 text-[10px] font-bold uppercase text-amber-500 tracking-widest">
                        <tr>
                          <th className="px-6 py-4">Membro</th>
                          <th className="px-6 py-4 text-center">Empresa</th>
                          <th className="px-6 py-4 text-center">Nível</th>
                          <th className="px-6 py-4 text-center">Gestão</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {users.map((u: any) => (
                          <tr key={u.id} className="hover:bg-slate-50 transition-all">
                            <td className="px-6 py-4">{u.name}<br /><span className="text-[9px] text-slate-300">{u.email}</span></td>
                            <td className="px-6 py-4 text-center text-[10px] text-amber-600 uppercase">{u.client_id}</td>
                            <td className="px-6 py-4 text-center text-[10px]">{u.role}</td>
                            <td className="px-6 py-4 text-center">
                              <button onClick={async () => {
                                if (window.confirm(`Remover ${u.name}?`)) {
                                  const { error } = await supabase.from('members').delete().eq('id', u.id);
                                  if (!error) { setUsers(users.filter((x: any) => x.id !== u.id)); addLog('Remoção', `Membro removido: ${u.name}`); }
                                }
                              }} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {/* ==================== FIM SEÇÃO DE USUÁRIOS ==================== */}

              {activeMenu === 'auditoria' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Auditoria</h1></div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"><table className="w-full text-left text-sm font-bold italic"><thead className="bg-slate-900 text-[10px] font-bold uppercase text-amber-500 tracking-widest"><tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Usuário</th><th className="px-6 py-4">Ação</th><th className="px-6 py-4">Detalhes</th></tr></thead><tbody className="divide-y divide-slate-100">{auditLogs.map((log, i) => (<tr key={log.id || i} className="hover:bg-slate-50 transition-all text-slate-600"><td className="px-6 py-4 text-[10px]">{new Date(log.log_date).toLocaleString()}</td><td className="px-6 py-4">{log.username}</td><td className="px-6 py-4 text-amber-600 uppercase text-[10px]">{log.action}</td><td className="px-6 py-4 text-xs">{log.details}</td></tr>))}</tbody></table></div>
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