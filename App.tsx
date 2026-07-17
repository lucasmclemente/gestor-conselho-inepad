import React, { useState, useRef, useMemo, useEffect } from 'react';
import { generateMeetingPDF } from './services/generateMeetingPDF';
import { generateAtaPDF } from './services/generateAtaPDF';
import { supabase } from './services/supabaseClient';
import { Estrategia } from './components/Estrategia';
import {
  LayoutDashboard, Calendar, CalendarPlus, CalendarClock, ChevronRight, UserPlus,
  Clock, CheckCircle2, AlertCircle, FileText, Send, X, Trash2,
  Upload, Save, Lock, Target, FileCheck, BarChart3,
  PieChart as PieIcon, LogIn, User, Key, LogOut, UserCheck,
  Mail, UserCog, Settings, Camera, UserCircle, History, Filter, MessageSquare, Download, ExternalLink, ListChecks, Plus, Edit2, Check, Menu, ChevronUp, ChevronDown, Play, Square, Timer, SkipForward, Building2, ChevronLeft, UserMinus, ThumbsUp, ThumbsDown, CircleSlash, MinusCircle, Archive, Search, PenLine, ShieldCheck, Scale, Monitor, MapPin, Gauge, TrendingUp, TrendingDown, Bell, Compass, Sparkles
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, ReferenceLine } from 'recharts';
import { PRIORITIES, PRIORITY_STYLES, PRIORITY_WEIGHT } from './constants';
import { deliberationResult } from './utils';
import { BoardplanMark, BoardplanLogo } from './components/Brand';
import { PublicVote } from './components/PublicVote';
import { PublicCollect } from './components/PublicCollect';
import { Login, RecoverPassword } from './components/Login';

const App = () => {
  const [voteToken] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get('votetoken'); } catch { return null; }
  });
  const [collectToken] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get('coleta'); } catch { return null; }
  });
  const [users, setUsers] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  // Detecta link de recuperação SINCRONAMENTE via URL hash — evita race condition com getSession()
  const [isRecovering, setIsRecovering] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    return params.get('type') === 'recovery';
  });
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('info');
  const [dashboardFilter, setDashboardFilter] = useState('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [filterResp, setFilterResp] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOrigin, setFilterOrigin] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterObjective, setFilterObjective] = useState('all'); // all | with | none | <objective_id>
  const [delibFilterResult, setDelibFilterResult] = useState('all');
  const [delibFilterOrigin, setDelibFilterOrigin] = useState('all');
  const [isExtraDelibOpen, setIsExtraDelibOpen] = useState(false);
  const [extraDelibForm, setExtraDelibForm] = useState({ title: '', voters: [] as string[] });
  const [extraCreating, setExtraCreating] = useState(false);
  const [votingDelibId, setVotingDelibId] = useState<number | null>(null);
  const [sendingVoteInvites, setSendingVoteInvites] = useState(false);
  const [pendingVote, setPendingVote] = useState<{ meetingId: string; delibId: number | null } | null>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const vmeet = p.get('vmeet');
      if (!vmeet) return null;
      const vd = p.get('vdelib');
      return { meetingId: vmeet, delibId: vd ? Number(vd) : null };
    } catch { return null; }
  });

  const [isConvocationOpen, setIsConvocationOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [notifyingMaterials, setNotifyingMaterials] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const ataRef = useRef<HTMLInputElement>(null);

  const blankMeeting = {
    title: '', status: 'Agendada', date: '', time: '', type: 'Híbrida', link: '', address: '',
    participants: [], pautas: [], materiais: [], deliberacoes: [], acoes: [], atas: []
  };
  const [currentMeeting, setCurrentMeeting] = useState<any>(blankMeeting);

  // Programação anual de reuniões em lote
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    baseTitle: 'Reunião Ordinária do Conselho',
    startDate: '', time: '09:00', type: 'Híbrida', link: '', address: '',
    freq: 'mensal', count: 12, sendInvites: true,
  });
  const [scheduleDates, setScheduleDates] = useState<string[]>([]);
  const [scheduleParticipants, setScheduleParticipants] = useState<any[]>([]);

  const [editingPart, setEditingPart] = useState<number | null>(null);
  const [editingPauta, setEditingPauta] = useState<number | null>(null);
  const [tmpPart, setTmpPart] = useState({ name: '', email: '', isExternal: false });
  const [tmpPauta, setTmpPauta] = useState({ title: '', resp: '', dur: '' });
  const [tmpAcao, setTmpAcao] = useState({ title: '', resps: [] as string[], resp: '', date: '', status: 'Pendente', obs: '', priority: 'Média' });
  const [tmpGlobalAcao, setTmpGlobalAcao] = useState({ title: '', resps: [] as string[], date: '', meetingId: '', obs: '', priority: 'Média' });
  const [tmpDelib, setTmpDelib] = useState({ title: '', voters: [] as string[], votes: {} as any });
  const [editingObsKey, setEditingObsKey] = useState<string | null>(null);
  const [obsInputValue, setObsInputValue] = useState('');
  const [editingRespsKey, setEditingRespsKey] = useState<string | null>(null);
  const [newUserForm, setnewUserForm] = useState({ name: '', email: '', role: 'Conselheiro', password: '', client_id: '' });
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [clientProfileForm, setClientProfileForm] = useState({ name: '', logo_url: '' });
  const [savingClientProfile, setSavingClientProfile] = useState(false);
  const [atasSearch, setAtasSearch] = useState('');
  const [clicksignLoading, setClicksignLoading] = useState(false);
  const [downloadingAta, setDownloadingAta] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  // SuperAdmin — gestão de clientes
  const [allClientsList, setAllClientsList] = useState<any[]>([]);
  const [managedClientId, setManagedClientId] = useState<string | null>(null);
  const [managedClientProfile, setManagedClientProfile] = useState<any>(null);
  const [managedClientForm, setManagedClientForm] = useState({ name: '', logo_url: '' });
  const [savingManagedClient, setSavingManagedClient] = useState(false);
  const managedLogoRef = useRef<HTMLInputElement>(null);
  const [newClientForm, setNewClientForm] = useState({ client_id: '', name: '' });
  const [creatingClient, setCreatingClient] = useState(false);
  const [deletingClient, setDeletingClient] = useState(false);

  // Perfil Assistente — gestão de materiais via Edge Function (sem acesso direto às reuniões)
  const [assistantMeetings, setAssistantMeetings] = useState<any[]>([]);
  const [assistantSelectedId, setAssistantSelectedId] = useState<string | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const assistantFileRef = useRef<HTMLInputElement>(null);

  const [activePautaIndex, setActivePautaIndex] = useState<number | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const currentMeetingRef = useRef<any>(null);
  const [noteAutoSaved, setNoteAutoSaved] = useState(false);
  // Ata com IA: sobe a transcrição do Teams/Meet e rascunha a discussão de cada pauta
  const transcriptRef = useRef<HTMLInputElement>(null);
  const [draftingMinutes, setDraftingMinutes] = useState(false);
  // Secretário multi-cliente: cliente em que o usuário está atuando + lista para o seletor
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [clientSwitchList, setClientSwitchList] = useState<any[]>([]);
  // SuperAdmin: "Consolidado Geral" (agrega todos os clientes) vs. um cliente específico
  const [superViewAll, setSuperViewAll] = useState(true);
  const [secModalUser, setSecModalUser] = useState<any>(null);
  const [secModalSelected, setSecModalSelected] = useState<string[]>([]);
  const [secModalSaving, setSecModalSaving] = useState(false);

  // Indicadores & Gatilhos (semáforos)
  const [indicatorStatuses, setIndicatorStatuses] = useState<any[]>([]);
  const [openTriggerEvents, setOpenTriggerEvents] = useState<any[]>([]);
  const [indicatorsList, setIndicatorsList] = useState<any[]>([]);
  const [triggersList, setTriggersList] = useState<any[]>([]);
  const [indicatorSeries, setIndicatorSeries] = useState<Record<string, any[]>>({});
  const [readingsList, setReadingsList] = useState<any[]>([]);
  const [targetsList, setTargetsList] = useState<any[]>([]);
  const [fcaList, setFcaList] = useState<any[]>([]);
  const [fcaModal, setFcaModal] = useState<any>(null);
  const [fcaSaving, setFcaSaving] = useState(false);
  const [fcaSuggesting, setFcaSuggesting] = useState(false);
  // Plano de Ação: 5W2H + vínculo a objetivo + Kanban
  const [strategyObjectives, setStrategyObjectives] = useState<any[]>([]);
  // Dashboard estratégico (add-on): perspectivas BSC + OKR (para os blocos da home)
  const [perspectivesList, setPerspectivesList] = useState<any[]>([]);
  const [okrKrs, setOkrKrs] = useState<any[]>([]);
  const [okrCheckins, setOkrCheckins] = useState<any[]>([]);
  const [actionModal, setActionModal] = useState<any>(null);
  const [actionModalSaving, setActionModalSaving] = useState(false);
  const [planoView, setPlanoView] = useState<'tabela' | 'kanban'>('tabela');
  const [farolView, setFarolView] = useState<'cards' | 'grid'>('cards');
  const [detailInd, setDetailInd] = useState<any>(null);
  const [govSettings, setGovSettings] = useState<any>({ active_scenario: 'Base', reeval_frequency: 'weekly' });
  // Alimentação em lote: grade mensal + importação de planilha
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchPeriod, setBatchPeriod] = useState('');
  const [batchValues, setBatchValues] = useState<Record<string, string>>({});
  const [batchTargets, setBatchTargets] = useState<Record<string, string>>({});
  const [batchSaving, setBatchSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const indCsvRef = useRef<HTMLInputElement>(null);
  // Link de coleta (controller do cliente preenche sem login)
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [collectPeriod, setCollectPeriod] = useState('');
  const [collectUrl, setCollectUrl] = useState('');
  const [collectMinting, setCollectMinting] = useState(false);
  const [collectCopied, setCollectCopied] = useState(false);
  // Metas do ano (grade indicador × 12 meses)
  const [yearMetasOpen, setYearMetasOpen] = useState(false);
  const [yearMetasYear, setYearMetasYear] = useState<number>(new Date().getFullYear());
  const [yearMetasVals, setYearMetasVals] = useState<Record<string, string>>({});
  const [yearMetasSaving, setYearMetasSaving] = useState(false);
  const [indModal, setIndModal] = useState<any>(null);
  const [indSaving, setIndSaving] = useState(false);
  const [readingModal, setReadingModal] = useState<any>(null);
  const [readingForm, setReadingForm] = useState({ period: '', value: '', source: '' });
  const [readingSaving, setReadingSaving] = useState(false);
  const [trigModal, setTrigModal] = useState<any>(null);
  const [trigForm, setTrigForm] = useState<any>({ name: '', operator: 'lt', threshold_value: '', threshold_value_secondary: '', severity: 'attention', scenario: 'Base', create_action_on_breach: true, notify_on_breach: true, assignee_member_id: '' });
  const [trigSaving, setTrigSaving] = useState(false);

  const isSuper = currentUser?.role === 'SuperAdmin';
  const isAdm = currentUser?.role === 'Administrador' || isSuper;
  const isSec = currentUser?.role === 'Secretário';
  const canEdit = isAdm || isSec;
  const isAssistant = currentUser?.role === 'Assistente';
  const isController = currentUser?.role === 'Controller';
  // Controller: só lança o realizado dos indicadores (não altera metas nem cadastra indicadores)
  const canLancar = canEdit || isController;
  // Valor sentinela do seletor para o SuperAdmin ver tudo consolidado
  const SUPER_ALL = '__ALL__';
  // Verdadeiro quando o SuperAdmin está na visão consolidada (agrega todos os clientes)
  const superAll = isSuper && superViewAll;
  // Troca de cliente pelo seletor do topo (secretário multi-empresa ou SuperAdmin)
  const handleClientSwitch = (val: string) => {
    if (isSuper && val === SUPER_ALL) { setSuperViewAll(true); return; }
    if (isSuper) setSuperViewAll(false);
    setActiveClientId(val);
  };
  // Add-on "Planejamento Estratégico": libera os menus Estratégia + Indicadores (por cliente)
  const strategyEnabled = !!clientProfile?.strategy_enabled;
  const SCENARIOS = ['Otimista', 'Base', 'Conservador', 'Trágico'];
  const FREQ_OPTS: [string, string][] = [['off', 'Desligada'], ['daily', 'Diária'], ['weekly', 'Semanal'], ['monthly', 'Mensal']];
  // Membros do cliente atual (SuperAdmin enxerga todos; aqui escopamos ao próprio cliente)
  const clientMembers = (users || []).filter((u: any) => {
    const cid = activeClientId || currentUser?.client_id;
    return u.client_id === cid || (Array.isArray(u.secretary_clients) && u.secretary_clients.includes(cid));
  });

  // --- LOGICA DE SESSÃO ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const isRecoveryLink = params.get('type') === 'recovery';

    // Limpa o hash para não reprocessar em refresh
    if (isRecoveryLink) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      // Não faz login automático se for link de recuperação (isRecovering já está true pelo lazy init)
      if (session && !isRecoveryLink) fetchMemberProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setIsRecovering(true);
        return;
      }
      // Sem guard isRecoveryLink aqui — o render prioriza isRecovering (checado antes de currentUser)
      // Isso garante que o login normal funciona depois do reset de senha
      if (session) fetchMemberProfile(session.user.id);
      else { setCurrentUser(null); setIsRecovering(false); setActiveClientId(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchMemberProfile = async (userId: string) => {
    // Lê os claims de segurança (role/client_id/secretary_clients) do app_metadata,
    // que só o service_role grava — impede autopromoção via updateUser.
    // O nome (exibição) continua no user_metadata, editável pelo próprio usuário.
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    const appMeta = (user as any)?.app_metadata;
    const userMeta = user?.user_metadata;
    let profile: any = null;
    if (appMeta?.role && appMeta?.client_id) {
      profile = {
        id: userId,
        name: userMeta?.name || user?.email || '',
        email: user?.email ?? '',
        role: appMeta.role,
        client_id: appMeta.client_id,
        secretary_clients: Array.isArray(appMeta.secretary_clients) ? appMeta.secretary_clients : []
      };
    } else {
      // Fallback para tabela members (compatibilidade com usuários sem metadata)
      const { data } = await supabase.from('members').select('id, name, email, role, client_id, secretary_clients').eq('id', userId).single();
      if (data) profile = { ...data, secretary_clients: data.secretary_clients || [] };
    }
    if (!profile) return;
    // Bloqueia o acesso se a conta da empresa estiver inativa (SuperAdmin nunca é bloqueado)
    if (profile.role !== 'SuperAdmin') {
      const { data: cli } = await supabase.from('clients').select('active').eq('client_id', profile.client_id).maybeSingle();
      if (cli && cli.active === false) {
        await supabase.auth.signOut();
        setCurrentUser(null);
        alert('Acesso indisponível: a conta da sua empresa está inativa. Entre em contato com o suporte da INEPAD.');
        return;
      }
    }
    setCurrentUser(profile);
  };

  // Define o cliente ativo no login (cliente "casa"); mantém a escolha durante a sessão
  useEffect(() => { if (currentUser && !activeClientId) setActiveClientId(currentUser.client_id); }, [currentUser, activeClientId]);
  // (Re)carrega os dados sempre que o cliente ativo muda (login ou troca de cliente)
  useEffect(() => { if (currentUser && activeClientId) { setDetailInd(null); fetchInitialData(); } /* eslint-disable-next-line */ }, [activeClientId, superViewAll]);
  // Add-on desligado: não permite ficar em Estratégia/Indicadores (ex.: ao trocar de cliente)
  useEffect(() => {
    if (!strategyEnabled && !isController && (activeMenu === 'estrategia' || activeMenu === 'indicadores')) setActiveMenu('dashboard');
    if (!strategyEnabled && filterObjective !== 'all') setFilterObjective('all');
    /* eslint-disable-next-line */
  }, [strategyEnabled, activeMenu]);
  // Monta as opções do seletor de cliente do topo
  useEffect(() => {
    if (!currentUser) { setClientSwitchList([]); return; }
    // SuperAdmin: "Consolidado Geral" + todos os clientes conhecidos
    if (isSuper) {
      const opts = [{ client_id: SUPER_ALL, name: 'Consolidado Geral' },
        ...allClientsList.map((c: any) => ({ client_id: c.client_id, name: c.name || c.client_id }))];
      setClientSwitchList(opts);
      return;
    }
    // Secretário/Admin/Conselheiro multi-empresa: cliente casa + secretary_clients
    const sec = currentUser?.secretary_clients || [];
    if (sec.length === 0) { setClientSwitchList([]); return; }
    const ids = [...new Set([currentUser.client_id, ...sec])];
    supabase.from('clients').select('client_id, name').in('client_id', ids).then(({ data }) => {
      setClientSwitchList(ids.map((id: string) => (data || []).find((c: any) => c.client_id === id) || { client_id: id, name: id }));
    });
  }, [currentUser, isSuper, allClientsList]);

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

  // Mantém uma referência sempre atualizada da reunião (para o autosave evitar estado obsoleto)
  useEffect(() => { currentMeetingRef.current = currentMeeting; }, [currentMeeting]);

  // Salvamento automático das notas da pauta durante a sessão (ata em tempo real)
  useEffect(() => {
    if (!isSessionActive || !editingObsKey?.startsWith('pauta-notes-')) return;
    const id = currentMeetingRef.current?.id;
    if (!id) return;
    const idx = parseInt(editingObsKey.slice('pauta-notes-'.length), 10);
    if (Number.isNaN(idx)) return;
    setNoteAutoSaved(false);
    const handle = setTimeout(async () => {
      const cm = currentMeetingRef.current;
      const pautas = [...(cm.pautas || [])];
      if (!pautas[idx] || pautas[idx].notes === obsInputValue) { setNoteAutoSaved(true); return; }
      pautas[idx] = { ...pautas[idx], notes: obsInputValue };
      const updated = { ...cm, pautas };
      setCurrentMeeting(updated);
      setMeetings(prev => prev.map(m => m.id === id ? updated : m));
      try { await supabase.from('meetings').update({ pautas }).eq('id', id); setNoteAutoSaved(true); } catch { /* tenta no próximo */ }
    }, 2000);
    return () => clearTimeout(handle);
  }, [obsInputValue, editingObsKey, isSessionActive]);

  // ----- Ata com IA: transcrição (Teams/Meet) → discussão de cada pauta -----
  // Limpa .vtt/.srt: remove cabeçalho, numeração de cue, marcas de tempo e ids do Teams.
  const cleanTranscript = (raw: string): string => {
    const out: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      if (/^WEBVTT/i.test(t)) continue;
      if (/^NOTE\b/i.test(t)) continue;
      if (/^\d+$/.test(t)) continue;                        // numeração do cue
      if (t.includes('-->')) continue;                      // 00:00:01.000 --> 00:00:04.000
      if (/^[0-9a-f-]{8,}(\/\d+-\d+)?$/i.test(t)) continue; // id de cue (Teams)
      // <v Maria Andrade>texto</v>  →  "Maria Andrade: texto"  (o Teams marca quem falou assim)
      const falado = t.replace(/<v\s+([^>]+?)>(.*?)<\/v>/gi, '$1: $2').replace(/<\/?[^>]+>/g, '').trim();
      if (falado) out.push(falado);
    }
    // Colapsa repetições consecutivas (legendas costumam repetir a linha anterior)
    return out.filter((l, i) => l !== out[i - 1]).join('\n');
  };

  const handleTranscriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = ''; // permite reenviar o mesmo arquivo
    if (!file || !currentMeeting?.id) return;
    if (!(currentMeeting.pautas || []).length) return alert('Monte a ordem do dia antes de rascunhar as discussões.');
    if (/\.(docx?|pdf|zip)$/i.test(file.name)) {
      return alert('Este formato não é lido (o texto vem compactado).\n\nNo Teams ou no Meet, baixe a transcrição como .vtt ou .txt e envie esse arquivo.');
    }

    const transcript = cleanTranscript(await file.text());
    if (transcript.length < 200) return alert('A transcrição parece vazia ou curta demais. Envie o arquivo .vtt ou .txt gerado pelo Teams/Meet.');

    const jaPreenchidas = (currentMeeting.pautas || []).filter((p: any) => (p.notes || '').trim()).length;
    if (jaPreenchidas > 0 && !window.confirm(`${jaPreenchidas} item(ns) já têm discussão escrita e serão substituídos pelo rascunho da IA.\n\nContinuar?`)) return;

    setDraftingMinutes(true);
    try {
      const { data, error } = await supabase.functions.invoke('draft-minutes', {
        body: { meetingId: currentMeeting.id, transcript },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const notas: string[] = data.notas || [];
      // Só preenche em tela — nada é gravado até a secretária clicar em Salvar
      setCurrentMeeting((prev: any) => ({
        ...prev,
        pautas: (prev.pautas || []).map((p: any, i: number) => (notas[i] ? { ...p, notes: notas[i] } : p)),
      }));
      addLog('Ata (IA)', `Rascunho de discussões gerado: ${data.preenchidas}/${data.total} item(ns).`);
      if (data.preenchidas === 0) {
        if (data.debug) console.warn('draft-minutes — diagnóstico:', data.debug);
        alert(`⚠️ A IA não encontrou, na transcrição, discussão sobre nenhum dos ${data.total} itens da ordem do dia.\n\nCausas prováveis:\n• O arquivo não é a transcrição desta reunião\n• A transcrição saiu vazia ou ilegível (use o .vtt ou .txt do Teams/Meet — .docx não funciona)\n\nNada foi alterado.`);
        return;
      }
      alert(`✅ Rascunho pronto — ${data.preenchidas} de ${data.total} item(ns) preenchido(s).\n\nRevise e ajuste os textos e clique em SALVAR.\nNada foi gravado ainda.`);
    } catch (err: any) {
      alert('Erro ao rascunhar a ata: ' + (err?.message || err));
    } finally {
      setDraftingMinutes(false);
    }
  };

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
    // Cliente em que o usuário está atuando (seletor do secretário multi-cliente; senão, o próprio)
    const cid = activeClientId || currentUser.client_id;
    try {
      // Assistente: sem acesso a reuniões/membros/logs — só perfil do cliente + materiais via Edge Function
      if (isAssistant) {
        const { data: cli } = await supabase.from('clients').select('*').eq('client_id', cid).maybeSingle();
        if (cli) { setClientProfile(cli); setClientProfileForm({ name: cli.name || '', logo_url: cli.logo_url || '' }); }
        else { setClientProfileForm({ name: cid, logo_url: '' }); }
        setActiveMenu('materiais-assistente');
        await loadAssistantMeetings();
        setLoading(false);
        return;
      }
      if (isController) setActiveMenu('indicadores');
      const memberCols = 'id, name, email, role, client_id, created_at, secretary_clients';
      let mQuery = supabase.from('meetings').select('*');
      let lQuery = supabase.from('audit_logs').select('*');
      // Filtra por cliente exceto quando o SuperAdmin está na visão "Consolidado Geral"
      if (!superAll) {
        mQuery = mQuery.eq('client_id', cid);
        lQuery = lQuery.eq('client_id', cid);
      }
      // Membros: consolidado (Super) vê todos; demais veem os do cliente ativo + conselheiros
      // vinculados a ele (secretary_clients contém o cliente) — para inclusão como votantes
      const usersPromise = superAll
        ? supabase.from('members').select(memberCols).order('name')
        : Promise.all([
            supabase.from('members').select(memberCols).eq('client_id', cid),
            // secretary_clients é jsonb: o filtro precisa ser JSON (cs.["INEPAD"]),
            // não literal de array Postgres (cs.{INEPAD}) — este dava 400.
            supabase.from('members').select(memberCols).contains('secretary_clients', JSON.stringify([cid])),
          ]).then(([a, b]: any) => {
            const map = new Map<string, any>();
            [...(a.data || []), ...(b.data || [])].forEach((m: any) => map.set(m.id, m));
            return { data: Array.from(map.values()).sort((x: any, y: any) => (x.name || '').localeCompare(y.name || '')) };
          });
      const baseQueries = [
        mQuery.order('created_at', { ascending: false }),
        usersPromise,
        lQuery.order('log_date', { ascending: false }).limit(50),
        supabase.from('clients').select('*').eq('client_id', cid).maybeSingle()
      ] as const;
      const [mRes, uRes, lRes, cRes] = await Promise.all(baseQueries);
      if (mRes.data) setMeetings(mRes.data);
      if (uRes.data) setUsers(uRes.data);
      if (lRes.data) setAuditLogs(lRes.data);
      if (cRes.data) {
        setClientProfile(cRes.data);
        setClientProfileForm({ name: cRes.data.name || '', logo_url: cRes.data.logo_url || '' });
      } else {
        setClientProfile(null);
        setClientProfileForm({ name: cid, logo_url: '' });
      }
      if (isSuper) {
        const [allClientsRes, allMembersRes] = await Promise.all([
          supabase.from('clients').select('*'),
          supabase.from('members').select('client_id')
        ]);
        const clientsWithProfile: any[] = allClientsRes.data || [];
        const knownIds = new Set(clientsWithProfile.map((c: any) => c.client_id));
        (allMembersRes.data || []).forEach((m: any) => knownIds.add(m.client_id));
        const fullList = Array.from(knownIds).map(id => {
          return clientsWithProfile.find((c: any) => c.client_id === id)
            || { client_id: id, name: id, logo_url: null, clicksign_enabled: false };
        }).sort((a: any, b: any) => a.client_id.localeCompare(b.client_id));
        setAllClientsList(fullList);
      }
      // Indicadores & Gatilhos do cliente ativo (semáforos + alertas + cadastros + séries)
      const [indStatusRes, indEventsRes, indListRes, trigListRes, readingsRes, govRes, targetsRes, fcaRes, objsRes, perspRes, krRes, ckRes] = await Promise.all([
        supabase.from('indicator_current_status').select('*').eq('client_id', cid).order('breach_level', { ascending: false }),
        supabase.from('trigger_events').select('*, indicators(name, unit), triggers(name, indicators(name, unit))').eq('client_id', cid).eq('status', 'open').order('fired_at', { ascending: false }),
        supabase.from('indicators').select('*').eq('client_id', cid).order('name'),
        supabase.from('triggers').select('*').eq('client_id', cid),
        supabase.from('indicator_readings').select('id, indicator_id, period, value, source').eq('client_id', cid).order('period', { ascending: true }),
        supabase.from('governance_settings').select('*').eq('client_id', cid).maybeSingle(),
        supabase.from('indicator_targets').select('indicator_id, period, target_value').eq('client_id', cid),
        supabase.from('fca').select('*').eq('client_id', cid).order('created_at', { ascending: false }),
        supabase.from('objectives').select('id, name, perspective_id').eq('client_id', cid).eq('active', true).order('position'),
        supabase.from('perspectives').select('id, name, position').eq('client_id', cid).order('position'),
        supabase.from('key_results').select('id, okr_objective_id, indicator_id, start_value, target_value, current_value').eq('client_id', cid),
        supabase.from('key_result_checkins').select('key_result_id, confidence, created_at').eq('client_id', cid).order('created_at', { ascending: false }),
      ]) as any;
      setStrategyObjectives(objsRes?.data || []);
      setPerspectivesList(perspRes?.data || []);
      setOkrKrs(krRes?.data || []);
      setOkrCheckins(ckRes?.data || []);
      setIndicatorStatuses(indStatusRes.data || []);
      setOpenTriggerEvents(indEventsRes.data || []);
      setIndicatorsList(indListRes.data || []);
      setTriggersList(trigListRes.data || []);
      setReadingsList(readingsRes.data || []);
      setIndicatorSeries(buildSeriesMap(readingsRes.data || []));
      setGovSettings(govRes?.data || { active_scenario: 'Base', reeval_frequency: 'weekly' });
      setTargetsList(targetsRes.data || []);
      setFcaList(fcaRes.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const addLog = async (action: string, details: string) => {
    const log = { username: currentUser?.name || 'Sistema', action, details, client_id: activeClientId || currentUser?.client_id };
    const { data } = await supabase.from('audit_logs').insert([log]).select();
    if (data) setAuditLogs(prev => [data[0], ...prev]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'materiais' | 'atas') => {
    if (!canEdit) return;
    if (type === 'materiais' && (currentMeeting.atas || []).length > 0) { if (e.target) e.target.value = ''; return alert('Materiais bloqueados: a ata desta reunião já foi publicada.'); }
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${activeClientId || currentUser.client_id}/${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `${type}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('meeting-files').upload(filePath, file);
      if (uploadError) throw uploadError; // aborta antes de salvar registro órfão
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

  // Notifica os participantes de que os materiais (subsídios) da reunião estão disponíveis
  const notifyMaterials = async () => {
    if (!canEdit) return;
    const mats = currentMeeting.materiais || [];
    if (mats.length === 0) return alert('Adicione ao menos um material antes de notificar.');
    if (!currentMeeting.id) return alert('Salve a reunião antes de notificar os participantes.');
    const internos = (currentMeeting.participants || []).filter((p: any) => !p.isExternal);
    const emails = internos.map((p: any) => p.email).filter((e: string) => e);
    if (emails.length === 0) return alert('Nenhum participante interno com e-mail para notificar.');
    if (!window.confirm(`Enviar notificação de materiais a ${emails.length} participante(s)?`)) return;
    setNotifyingMaterials(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-materials-notification', {
        body: { meetingData: currentMeeting, recipients: emails, organizer: { name: currentUser.name, email: currentUser.email } },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      addLog('Materiais', `Notificação de materiais enviada a ${data.sent || emails.length} participante(s) — ${currentMeeting.title}`);
      alert(`✅ Notificação de materiais enviada a ${data.sent || emails.length} participante(s).`);
    } catch (e: any) { alert('Erro ao notificar: ' + (e?.message || e)); }
    finally { setNotifyingMaterials(false); }
  };

  // Exclui um material — permitido só enquanto a ata não foi publicada
  const deleteMaterial = async (index: number) => {
    if (!canEdit) return;
    if ((currentMeeting.atas || []).length > 0) return alert('Materiais bloqueados: a ata desta reunião já foi publicada.');
    const mat = (currentMeeting.materiais || [])[index];
    if (!mat) return;
    if (!window.confirm(`Excluir o material "${mat.name}"?`)) return;
    const updated = (currentMeeting.materiais || []).filter((_: any, i: number) => i !== index);
    try {
      // Remove o arquivo do Storage (best-effort — extrai o caminho da URL assinada)
      try {
        const m = String(mat.url || '').match(/\/object\/sign\/meeting-files\/([^?]+)/);
        if (m && m[1]) await supabase.storage.from('meeting-files').remove([decodeURIComponent(m[1])]);
      } catch { /* ignora falha de storage */ }
      if (currentMeeting.id) {
        const { data: saved, error } = await supabase.from('meetings').update({ materiais: updated }).eq('id', currentMeeting.id).select().single();
        if (error) throw error;
        setCurrentMeeting(saved);
        setMeetings(prev => prev.map(m => m.id === currentMeeting.id ? saved : m));
      } else {
        setCurrentMeeting((prev: any) => ({ ...prev, materiais: updated }));
      }
      addLog('Materiais', `Material removido: ${mat.name} — ${currentMeeting.title}`);
    } catch (e: any) { alert('Erro ao excluir material: ' + (e?.message || e)); }
  };

  // Gera uma RAE (Reunião de Análise Estratégica) com pauta automática
  const generateRAE = async () => {
    if (!canEdit) return;
    const cid = activeClientId || currentUser.client_id;
    const now = new Date();
    const mesAno = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const P = (title: string) => ({ title, resp: '', dur: 10, realDur: 0, completed: false });
    const objFarol = (objId: string) => {
      const inds = indicatorsList.filter((i: any) => i.objective_id === objId);
      if (!inds.length) return 0;
      return Math.max(...inds.map((i: any) => (indicatorStatuses.find((s: any) => s.indicator_id === i.id)?.breach_level) || 0));
    };
    const pautas: any[] = [P('Abertura e leitura do painel estratégico')];
    // Objetivos
    const objAlert = strategyObjectives.filter((o: any) => objFarol(o.id) > 0);
    pautas.push(P('— OBJETIVOS ESTRATÉGICOS —'));
    objAlert.length === 0 ? pautas.push(P('✅ Nenhum objetivo em alerta'))
      : objAlert.forEach((o: any) => pautas.push(P(`${objFarol(o.id) === 2 ? '🔴' : '🟡'} Objetivo em alerta: ${o.name}`)));
    // Indicadores
    const indAlert = indicatorStatuses.filter((s: any) => (s.breach_level || 0) > 0);
    pautas.push(P('— INDICADORES —'));
    indAlert.length === 0 ? pautas.push(P('✅ Todos os indicadores no alvo'))
      : indAlert.forEach((s: any) => pautas.push(P(`${s.breach_level === 2 ? '🔴' : '🟡'} Indicador fora da meta: ${s.name} (realizado ${s.current_value ?? '—'})`)));
    // Ações atrasadas
    const lateActions = meetings.flatMap((m: any) => (m.acoes || [])).filter((a: any) => a.status !== 'Concluída' && a.date && a.date < today);
    pautas.push(P('— PLANO DE AÇÃO —'));
    lateActions.length === 0 ? pautas.push(P('✅ Sem ações atrasadas'))
      : lateActions.forEach((a: any) => pautas.push(P(`⏰ Ação atrasada: ${a.title} (venceu ${new Date(a.date + 'T00:00:00').toLocaleDateString('pt-BR')})`)));
    // OKRs em risco
    try {
      const [{ data: krs }, { data: cks }] = await Promise.all([
        supabase.from('key_results').select('id, name').eq('client_id', cid),
        supabase.from('key_result_checkins').select('key_result_id, confidence').eq('client_id', cid).order('created_at', { ascending: false }),
      ]) as any;
      const latest: Record<string, string> = {};
      (cks || []).forEach((c: any) => { if (!latest[c.key_result_id]) latest[c.key_result_id] = c.confidence; });
      const riskKrs = (krs || []).filter((k: any) => latest[k.id] === 'red');
      pautas.push(P('— OKRs —'));
      riskKrs.length === 0 ? pautas.push(P('✅ Sem OKRs em risco'))
        : riskKrs.forEach((k: any) => pautas.push(P(`🎯 OKR em risco: ${k.name}`)));
    } catch (_) { /* segue sem OKR */ }
    pautas.push(P('Encaminhamentos e próximos passos'));

    const internos = clientMembers.filter((u: any) => u.email).map((u: any) => ({ name: u.name, email: u.email, isExternal: false }));
    const row = { title: `RAE — ${mesAno}`, status: 'Agendada', type: 'RAE', date: today, time: '09:00', link: '', address: '', participants: internos, pautas, materiais: [], deliberacoes: [], acoes: [], atas: [], client_id: cid };
    const { data, error } = await supabase.from('meetings').insert([row]).select().single();
    if (error) { alert('Erro ao gerar RAE: ' + error.message); return; }
    setMeetings((prev: any) => [data, ...prev]);
    addLog('RAE', `Reunião de Análise Estratégica gerada (${mesAno}).`);
    setCurrentMeeting(data); setView('details'); setTab('pauta'); setActiveMenu('reunioes');
  };

  const saveMeeting = async () => {
    if (!canEdit) return;
    if (!currentMeeting.title) return alert("O título é obrigatório.");
    const meetingData = {
      ...currentMeeting,
      client_id: currentMeeting.client_id || activeClientId || currentUser.client_id,
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

  // ── Programação anual de reuniões ──────────────────────────────────────────
  const FREQ_MONTHS: Record<string, number> = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6 };

  // Soma N meses a uma data 'YYYY-MM-DD', mantendo o dia (com clamp no fim do mês)
  const addMonths = (dateStr: string, n: number): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const target = new Date(y, (m - 1) + n, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(d, lastDay));
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
  };

  const formatMonthYear = (dateStr: string): string => {
    if (!dateStr) return '';
    const dt = new Date(dateStr + 'T00:00:00');
    const mes = dt.toLocaleDateString('pt-BR', { month: 'long' });
    return `${mes.charAt(0).toUpperCase() + mes.slice(1)}/${dt.getFullYear()}`;
  };

  const openScheduleModal = () => {
    if (!canEdit) return;
    const internos = (users || []).filter((u: any) => u.email).map((u: any) => ({ name: u.name, email: u.email, isExternal: false }));
    setScheduleParticipants(internos);
    setScheduleForm({ baseTitle: 'Reunião Ordinária do Conselho', startDate: '', time: '09:00', type: 'Híbrida', link: '', address: '', freq: 'mensal', count: 12, sendInvites: true });
    setScheduleDates([]);
    setIsScheduleOpen(true);
  };

  // Gera a prévia de datas a partir da data inicial + frequência + quantidade
  const generateScheduleDates = () => {
    if (!scheduleForm.startDate) return alert('Informe a data da primeira reunião.');
    const step = FREQ_MONTHS[scheduleForm.freq] || 1;
    const qtd = Math.max(1, Math.min(24, Number(scheduleForm.count) || 1));
    const dates = Array.from({ length: qtd }, (_, i) => addMonths(scheduleForm.startDate, step * i));
    setScheduleDates(dates);
  };

  const scheduleYear = async () => {
    if (!canEdit) return;
    const dates = scheduleDates.filter(Boolean);
    if (dates.length === 0) return alert('Gere ao menos uma data antes de confirmar.');
    if (!scheduleForm.baseTitle.trim()) return alert('Informe o título base das reuniões.');
    setIsScheduling(true);
    try {
      const rows = dates.map((d) => ({
        title: `${scheduleForm.baseTitle.trim()} — ${formatMonthYear(d)}`,
        status: 'Agendada',
        date: d,
        time: scheduleForm.time || null,
        type: scheduleForm.type,
        link: scheduleForm.link,
        address: scheduleForm.address,
        participants: scheduleParticipants,
        pautas: [], materiais: [], deliberacoes: [], acoes: [], atas: [],
        client_id: activeClientId || currentUser.client_id,
      }));
      const { data, error } = await supabase.from('meetings').insert(rows).select();
      if (error) throw error;
      const created = data || [];
      setMeetings((prev) => [...created, ...prev]);
      addLog('Programação Anual', `${created.length} reuniões programadas.`);

      if (scheduleForm.sendInvites) {
        const recipients = scheduleParticipants.map((p: any) => p.email).filter(Boolean);
        if (recipients.length > 0) {
          try {
            await supabase.functions.invoke('send-calendar-invites', {
              body: { meetings: created, recipients, clientName: clientProfile?.name || activeClientId || currentUser.client_id, organizer: { name: currentUser.name, email: currentUser.email } },
            });
            addLog('Convites Calendário', `Convites de calendário enviados a ${recipients.length} participante(s).`);
          } catch (e: any) {
            alert('Reuniões criadas, mas houve erro ao enviar os convites de calendário: ' + (e?.message || e));
          }
        }
      }
      alert(`✅ ${created.length} reuniões programadas!` + (scheduleForm.sendInvites ? ' Convites de calendário enviados aos participantes.' : ''));
      setIsScheduleOpen(false);
    } catch (e: any) {
      alert('Erro ao programar reuniões: ' + (e?.message || e));
    } finally {
      setIsScheduling(false);
    }
  };

  const saveGlobalAction = async () => {
    if (!canEdit) return;
    if (!tmpGlobalAcao.title || !tmpGlobalAcao.meetingId) return alert("Título e Reunião de Origem são obrigatórios.");
    const targetMeeting = meetings.find(m => m.id === tmpGlobalAcao.meetingId);
    if (!targetMeeting) return;
    const newAction = { id: Date.now(), title: tmpGlobalAcao.title, resps: tmpGlobalAcao.resps, resp: tmpGlobalAcao.resps[0] || '', date: tmpGlobalAcao.date, obs: tmpGlobalAcao.obs, status: 'Pendente', priority: tmpGlobalAcao.priority || 'Média' };
    const updatedActions = [...(targetMeeting.acoes || []), newAction];
    const { error } = await supabase.from('meetings').update({ acoes: updatedActions }).eq('id', targetMeeting.id);
    if (!error) {
      setMeetings(prev => prev.map(m => m.id === targetMeeting.id ? { ...m, acoes: updatedActions } : m));
      setTmpGlobalAcao({ title: '', resps: [], date: '', meetingId: '', obs: '', priority: 'Média' });
      alert("Ação registrada!");
    }
  };

  const updateActionPriorityGlobal = async (meetingId: string, actionId: string | number, newPriority: string) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).map((a: any) => a.id === actionId ? { ...a, priority: newPriority } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (!error) setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
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

  // Atualiza campos arbitrários de uma ação (5W2H, objetivo, status via Kanban…)
  const updateActionFields = async (meetingId: string, actionId: string | number, patch: any) => {
    if (!canEdit) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const newAcoes = (meeting.acoes || []).map((a: any) => a.id === actionId ? { ...a, ...patch } : a);
    const { error } = await supabase.from('meetings').update({ acoes: newAcoes }).eq('id', meetingId);
    if (error) { alert('Erro ao salvar: ' + error.message); return false; }
    setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, acoes: newAcoes } : m));
    return true;
  };
  const openActionModal = (acao: any) => {
    if (!canEdit) return;
    setActionModal({ mId: acao.mId, id: acao.id, title: acao.title || '', why: acao.why || '', where: acao.where || '', how: acao.how || '', how_much: acao.how_much || '', objective_id: acao.objective_id || '', obs: acao.obs || '' });
  };
  const saveActionModal = async () => {
    if (!actionModal) return;
    if (!actionModal.title?.trim()) return alert('O título da ação é obrigatório.');
    setActionModalSaving(true);
    const ok = await updateActionFields(actionModal.mId, actionModal.id, {
      title: actionModal.title.trim(), why: actionModal.why?.trim() || '', where: actionModal.where?.trim() || '',
      how: actionModal.how?.trim() || '', how_much: actionModal.how_much?.trim() || '', objective_id: actionModal.objective_id || '', obs: actionModal.obs?.trim() || '',
    });
    setActionModalSaving(false);
    if (ok) { addLog('Plano de Ação', `Ação detalhada (5W2H): ${actionModal.title}`); setActionModal(null); }
  };
  const objectiveName = (id: string) => strategyObjectives.find((o: any) => o.id === id)?.name || '';

  // --- CADASTRO DE NOVO MEMBRO (via Edge Function segura) ---
  // CORREÇÃO FINAL: verifica diretamente no banco se o membro foi criado,
  // ignorando o código de retorno HTTP da Edge Function
  const handleCreateUser = async () => {
    const clientId = isSuper ? newUserForm.client_id : (activeClientId || currentUser.client_id);
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

      // Chama a Edge Function (a confirmação real é feita no banco logo abaixo)
      const { data: fnData, error: fnError } = await supabase.functions.invoke('create-user', {
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
        .maybeSingle();

      if (!membroVerificado) {
        // Não criado — extrai o motivo real do retorno da Edge Function
        let fnErrMsg: string = fnData?.error || '';
        if (!fnErrMsg && fnError) {
          try { const b = await (fnError as any).context?.json?.(); fnErrMsg = b?.error || fnError.message || ''; }
          catch { fnErrMsg = fnError.message || ''; }
        }
        const low = (fnErrMsg || '').toLowerCase();
        if (low.includes('registered') || low.includes('already') || low.includes('exist') || low.includes('duplicate') || low.includes('duplicad')) {
          throw new Error('Já existe um usuário cadastrado com este e-mail.');
        }
        throw new Error(fnErrMsg || 'Não foi possível confirmar o cadastro. Tente novamente.');
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

  // Altera o perfil (papel) de um membro — Adm/SuperAdmin (atualiza Auth + members)
  const updateMemberRole = async (u: any, newRole: string) => {
    if (newRole === u.role) return;
    if (!window.confirm(`Alterar o perfil de ${u.name} para "${newRole}"?\n\nEle precisará sair e entrar novamente para o novo perfil passar a valer.`)) return;
    const { data, error } = await supabase.functions.invoke('update-member-role', { body: { userId: u.id, newRole } });
    if (error || data?.error) { alert('Erro ao alterar perfil: ' + (error?.message || data?.error)); return; }
    setUsers(prev => prev.map((x: any) => x.id === u.id ? { ...x, role: newRole } : x));
    addLog('Configuração', `Perfil de ${u.name} alterado para ${newRole}`);
    alert(`✅ Perfil de ${u.name} alterado para "${newRole}".\n\nLembre-o de sair e entrar novamente para o novo acesso valer.`);
  };

  // Secretário multi-cliente: abre/salva a atribuição de clientes (apenas SuperAdmin)
  const openSecModal = (u: any) => {
    if (!isSuper) return;
    setSecModalUser(u);
    setSecModalSelected(Array.isArray(u.secretary_clients) ? u.secretary_clients : []);
  };
  const saveSecModal = async () => {
    if (!secModalUser) return;
    setSecModalSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-secretary-clients', { body: { userId: secModalUser.id, clientIds: secModalSelected } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setUsers(prev => prev.map((x: any) => x.id === secModalUser.id ? { ...x, secretary_clients: data.secretary_clients } : x));
      addLog('Configuração', `Clientes de ${secModalUser.name} (${secModalUser.role}): ${data.secretary_clients.join(', ') || '(nenhum)'}`);
      alert(`✅ Clientes atualizados para ${secModalUser.name}.\n\nEle precisará sair e entrar novamente para o acesso valer.`);
      setSecModalUser(null);
    } catch (e: any) {
      alert('Erro ao salvar: ' + (e?.message || e));
    } finally {
      setSecModalSaving(false);
    }
  };

  // Indicadores: marcar um alerta de gatilho como resolvido
  const resolveTriggerEvent = async (eventId: string) => {
    const { error } = await supabase.from('trigger_events')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: currentUser?.id })
      .eq('id', eventId);
    if (error) { alert('Erro ao resolver alerta: ' + error.message); return; }
    setOpenTriggerEvents(prev => prev.filter((e: any) => e.id !== eventId));
    addLog('Indicadores', 'Alerta de gatilho marcado como resolvido.');
  };

  // Monta { indicator_id: [{period, value}, ...] } ordenado por competência (asc)
  const buildSeriesMap = (rows: any[]): Record<string, any[]> => {
    const map: Record<string, any[]> = {};
    (rows || []).forEach((r: any) => {
      (map[r.indicator_id] ||= []).push({ period: r.period, value: Number(r.value) });
    });
    return map;
  };

  // Recarrega só os dados de indicadores (semáforos, alertas, cadastros, séries) do cliente ativo
  const reloadIndicators = async () => {
    const cid = activeClientId || currentUser.client_id;
    const [st, ev, ind, tg, rd, gov, tgt, fca] = await Promise.all([
      supabase.from('indicator_current_status').select('*').eq('client_id', cid).order('breach_level', { ascending: false }),
      supabase.from('trigger_events').select('*, indicators(name, unit), triggers(name, indicators(name, unit))').eq('client_id', cid).eq('status', 'open').order('fired_at', { ascending: false }),
      supabase.from('indicators').select('*').eq('client_id', cid).order('name'),
      supabase.from('triggers').select('*').eq('client_id', cid),
      supabase.from('indicator_readings').select('id, indicator_id, period, value, source').eq('client_id', cid).order('period', { ascending: true }),
      supabase.from('governance_settings').select('*').eq('client_id', cid).maybeSingle(),
      supabase.from('indicator_targets').select('indicator_id, period, target_value').eq('client_id', cid),
      supabase.from('fca').select('*').eq('client_id', cid).order('created_at', { ascending: false }),
    ]) as any;
    setIndicatorStatuses(st.data || []);
    setOpenTriggerEvents(ev.data || []);
    setIndicatorsList(ind.data || []);
    setTriggersList(tg.data || []);
    setReadingsList(rd.data || []);
    setIndicatorSeries(buildSeriesMap(rd.data || []));
    setGovSettings(gov?.data || { active_scenario: 'Base', reeval_frequency: 'weekly' });
    setTargetsList(tgt.data || []);
    setFcaList(fca.data || []);
  };

  // Salva configuração de governança (cenário ativo / frequência do cron) do cliente ativo
  const saveGovSetting = async (patch: any) => {
    if (!canEdit) return;
    const cid = activeClientId || currentUser.client_id;
    const next = { ...govSettings, ...patch };
    setGovSettings(next);
    const { error } = await supabase.from('governance_settings').upsert([{ client_id: cid, active_scenario: next.active_scenario || 'Base', reeval_frequency: next.reeval_frequency || 'weekly', updated_at: new Date().toISOString() }], { onConflict: 'client_id' });
    if (error) { alert('Erro ao salvar configuração: ' + error.message); return; }
    addLog('Indicadores', `Configuração: cenário ativo=${next.active_scenario}, reavaliação=${next.reeval_frequency}`);
    if (patch.active_scenario) await reloadIndicators(); // recolore o semáforo conforme o cenário
  };

  // ----- CRUD de Indicadores -----
  const openIndModal = (ind?: any) => {
    if (!canEdit) return;
    setIndModal(ind
      ? { id: ind.id, name: ind.name || '', unit: ind.unit || '', description: ind.description || '', direction: ind.direction || 'higher_is_better', category: ind.category || '', level: ind.level || '', responsible_member_id: ind.responsible_member_id || '' }
      : { name: '', unit: '', description: '', direction: 'higher_is_better', category: '', level: '', responsible_member_id: '' });
  };
  const saveIndicator = async () => {
    if (!indModal?.name?.trim()) return alert('Informe o nome do indicador.');
    setIndSaving(true);
    try {
      const cid = activeClientId || currentUser.client_id;
      const payload = { name: indModal.name.trim(), unit: indModal.unit?.trim() || null, description: indModal.description?.trim() || null, direction: indModal.direction, category: indModal.category?.trim() || null, level: indModal.level || null, responsible_member_id: indModal.responsible_member_id || null };
      const { error } = indModal.id
        ? await supabase.from('indicators').update(payload).eq('id', indModal.id)
        : await supabase.from('indicators').insert([{ ...payload, client_id: cid }]);
      if (error) throw new Error(error.message);
      addLog('Indicadores', `${indModal.id ? 'Indicador atualizado' : 'Indicador criado'}: ${payload.name}`);
      setIndModal(null);
      await reloadIndicators();
    } catch (e: any) { alert('Erro ao salvar indicador: ' + (e?.message || e)); }
    finally { setIndSaving(false); }
  };
  const deleteIndicator = async (ind: any) => {
    if (!canEdit) return;
    if (!window.confirm(`Excluir o indicador "${ind.name}"? Isso remove também suas leituras, gatilhos e alertas.`)) return;
    const { error } = await supabase.from('indicators').delete().eq('id', ind.indicator_id || ind.id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    addLog('Indicadores', `Indicador excluído: ${ind.name}`);
    await reloadIndicators();
  };

  // ----- Registrar leitura (dispara avaliação de gatilhos) -----
  const openReadingModal = (ind: any) => {
    if (!canEdit) return;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setReadingForm({ period: ym, value: '', source: '' });
    setReadingModal(ind);
  };
  const saveReading = async () => {
    if (!readingModal) return;
    if (!readingForm.period) return alert('Informe a competência (mês).');
    if (readingForm.value === '' || isNaN(Number(readingForm.value))) return alert('Informe um valor numérico.');
    setReadingSaving(true);
    try {
      const cid = activeClientId || currentUser.client_id;
      const indId = readingModal.indicator_id || readingModal.id;
      const periodDate = `${readingForm.period}-01`;
      const { data: reading, error } = await supabase.from('indicator_readings')
        .upsert([{ client_id: cid, indicator_id: indId, period: periodDate, value: Number(readingForm.value), source: readingForm.source?.trim() || null }], { onConflict: 'indicator_id,period' })
        .select('id').single();
      if (error) throw new Error(error.message);
      addLog('Indicadores', `Leitura registrada: ${readingModal.name} = ${readingForm.value} (${readingForm.period})`);
      // Dispara avaliação determinística no servidor (cria alertas/ações/e-mail se romper)
      const { data: evalRes } = await supabase.functions.invoke('evaluate-triggers', { body: { indicator_reading_id: reading.id } });
      setReadingModal(null);
      await fetchInitialData(); // atualiza semáforos, alertas e ações geradas no Plano de Ação
      const fired = evalRes?.fired?.length || 0;
      if (fired > 0) alert(`⚠ Leitura registrada. ${fired} gatilho(s) disparado(s) — alerta(s) e ação(ões) gerada(s) no Plano de Ação.`);
    } catch (e: any) { alert('Erro ao registrar leitura: ' + (e?.message || e)); }
    finally { setReadingSaving(false); }
  };
  // Editar uma leitura existente: reabre o modal pré-preenchido (upsert por competência)
  const openReadingEdit = (ind: any, r: any) => {
    if (!canEdit) return;
    setReadingForm({ period: String(r.period).slice(0, 7), value: String(r.value), source: r.source || '' });
    setReadingModal(ind);
  };
  const deleteReading = async (r: any) => {
    if (!canEdit) return;
    if (!window.confirm(`Excluir a leitura de ${String(r.period).slice(0, 7)} (${r.value})?`)) return;
    const { error } = await supabase.from('indicator_readings').delete().eq('id', r.id);
    if (error) { alert('Erro ao excluir leitura: ' + error.message); return; }
    addLog('Indicadores', `Leitura excluída (${String(r.period).slice(0, 7)}).`);
    await reloadIndicators();
  };

  // ----- FCA (Ficha de Controle Analítico: Fato → Causa → Ação) -----
  const ensureIndicatorsContainer = async () => {
    const cid = activeClientId || currentUser.client_id;
    const found = meetings.find((m: any) => m.type === 'Indicadores' && m.client_id === cid);
    if (found) return found;
    const { data, error } = await supabase.from('meetings').insert([{ title: 'Gatilhos de Indicadores', status: 'Indicadores', type: 'Indicadores', date: null, time: null, link: '', address: '', participants: [], pautas: [], materiais: [], deliberacoes: [], acoes: [], atas: [], client_id: cid }]).select().single();
    if (error) { alert('Erro ao preparar o Plano de Ação: ' + error.message); return null; }
    setMeetings((prev: any) => [data, ...prev]);
    return data;
  };
  const openFca = (ind: any, period?: string) => {
    if (!canEdit) return;
    const now = new Date();
    const ym = period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setFcaModal({ indicator: ind, period: ym, fact: '', cause: '', action_text: '', createAction: true });
  };
  const saveFca = async () => {
    if (!fcaModal) return;
    if (!fcaModal.fact?.trim()) return alert('Descreva o fato (o que aconteceu).');
    setFcaSaving(true);
    try {
      const cid = activeClientId || currentUser.client_id;
      const indId = fcaModal.indicator.indicator_id || fcaModal.indicator.id;
      let actionId: string | null = null;
      // Cria a ação (contramedida) no Plano de Ação, se marcado e preenchido
      if (fcaModal.createAction && fcaModal.action_text?.trim()) {
        const container = await ensureIndicatorsContainer();
        if (container) {
          const aId = Date.now() + Math.floor(Math.random() * 1000);
          const action = { id: aId, title: fcaModal.action_text.trim(), resps: [], resp: '', date: '', obs: `FCA — ${fcaModal.indicator.name} (${fcaModal.period}). Fato: ${fcaModal.fact.trim()}${fcaModal.cause?.trim() ? ` · Causa: ${fcaModal.cause.trim()}` : ''}.`, status: 'Pendente', priority: 'Importante', fromFca: true };
          const acoes = [...(container.acoes || []), action];
          await supabase.from('meetings').update({ acoes }).eq('id', container.id);
          setMeetings((prev: any) => prev.map((m: any) => m.id === container.id ? { ...container, acoes } : m));
          actionId = String(aId);
        }
      }
      const { error } = await supabase.from('fca').insert([{ client_id: cid, indicator_id: indId, period: `${fcaModal.period}-01`, fact: fcaModal.fact.trim(), cause: fcaModal.cause?.trim() || null, action_text: fcaModal.action_text?.trim() || null, action_id: actionId }]);
      if (error) throw new Error(error.message);
      addLog('Indicadores', `FCA registrada: ${fcaModal.indicator.name} (${fcaModal.period})`);
      setFcaModal(null);
      await reloadIndicators();
    } catch (e: any) { alert('Erro ao salvar FCA: ' + (e?.message || e)); }
    finally { setFcaSaving(false); }
  };
  const suggestFcaAction = async () => {
    if (!fcaModal) return;
    const ind = fcaModal.indicator;
    const t = targetsList.find((x: any) => x.indicator_id === (ind.indicator_id || ind.id) && String(x.period).slice(0, 7) === fcaModal.period);
    setFcaSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-action', { body: { indicatorName: ind.name, value: ind.current_value, meta: t?.target_value, unit: ind.unit, direction: ind.direction, fact: fcaModal.fact, cause: fcaModal.cause } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      const txt = [data.title, data.how].filter(Boolean).join(' — ');
      setFcaModal((prev: any) => ({ ...prev, action_text: txt || prev.action_text, cause: prev.cause?.trim() ? prev.cause : (data.why || '') }));
    } catch (e: any) { alert('Erro na sugestão de IA: ' + (e?.message || e)); }
    finally { setFcaSuggesting(false); }
  };
  const deleteFca = async (f: any) => {
    if (!canEdit) return;
    if (!window.confirm('Excluir esta análise (FCA)?')) return;
    const { error } = await supabase.from('fca').delete().eq('id', f.id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    await reloadIndicators();
  };

  // Grava leituras em lote (upsert por competência) e avalia os gatilhos de cada uma
  const commitReadings = async (items: { indicator_id: string; period: string; value: number; source?: string }[]) => {
    const cid = activeClientId || currentUser.client_id;
    const ids: string[] = [];
    for (const it of items) {
      const { data, error } = await supabase.from('indicator_readings')
        .upsert([{ client_id: cid, indicator_id: it.indicator_id, period: it.period, value: it.value, source: it.source || null }], { onConflict: 'indicator_id,period' })
        .select('id').single();
      if (!error && data) ids.push(data.id);
    }
    const results = await Promise.all(ids.map(id => supabase.functions.invoke('evaluate-triggers', { body: { indicator_reading_id: id } }).then((r: any) => r.data).catch(() => null)));
    const fired = results.reduce((s: number, r: any) => s + (r?.fired?.length || 0), 0);
    return { ok: ids.length, fired };
  };

  // ----- Grade de lançamento mensal -----
  const fillBatchForPeriod = (period: string) => {
    const prefill: Record<string, string> = {};
    readingsList.filter((r: any) => String(r.period).slice(0, 7) === period).forEach((r: any) => { prefill[r.indicator_id] = String(r.value); });
    setBatchValues(prefill);
    const prefillT: Record<string, string> = {};
    targetsList.filter((t: any) => String(t.period).slice(0, 7) === period).forEach((t: any) => { prefillT[t.indicator_id] = String(t.target_value); });
    setBatchTargets(prefillT);
  };
  const openBatch = () => {
    if (!canEdit) return;
    if (indicatorsList.length === 0) return alert('Cadastre ao menos um indicador antes de lançar o mês.');
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setBatchPeriod(ym);
    fillBatchForPeriod(ym);
    setBatchOpen(true);
  };
  const saveBatch = async () => {
    if (!batchPeriod) return alert('Escolha a competência (mês).');
    const cid = activeClientId || currentUser.client_id;
    const period = `${batchPeriod}-01`;
    const items = indicatorsList
      .filter((ind: any) => { const v = batchValues[ind.id]; return v !== undefined && v !== '' && !isNaN(Number(v)); })
      .map((ind: any) => ({ indicator_id: ind.id, period, value: Number(batchValues[ind.id]) }));
    const targetRows = canEdit ? indicatorsList
      .filter((ind: any) => { const t = batchTargets[ind.id]; return t !== undefined && t !== '' && !isNaN(Number(t)); })
      .map((ind: any) => ({ client_id: cid, indicator_id: ind.id, period, target_value: Number(batchTargets[ind.id]) })) : [];
    if (items.length === 0 && targetRows.length === 0) return alert('Preencha ao menos um valor ou meta.');
    setBatchSaving(true);
    try {
      if (targetRows.length > 0) await supabase.from('indicator_targets').upsert(targetRows, { onConflict: 'indicator_id,period' });
      const { ok, fired } = items.length > 0 ? await commitReadings(items) : { ok: 0, fired: 0 };
      addLog('Indicadores', `Lançamento mensal (${batchPeriod}): ${ok} leitura(s), ${targetRows.length} meta(s).`);
      setBatchOpen(false);
      await fetchInitialData();
      alert(`✅ ${batchPeriod}: ${ok} leitura(s) e ${targetRows.length} meta(s) salvas.` + (fired > 0 ? `\n⚠ ${fired} gatilho(s) disparado(s).` : ''));
    } catch (e: any) { alert('Erro no lançamento: ' + (e?.message || e)); }
    finally { setBatchSaving(false); }
  };

  // ----- Metas do ano (grade indicador × 12 meses) -----
  const YM_MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const fillYearMetas = (year: number) => {
    const pre: Record<string, string> = {};
    targetsList.filter((t: any) => String(t.period).slice(0, 4) === String(year)).forEach((t: any) => { pre[`${t.indicator_id}|${String(t.period).slice(5, 7)}`] = String(t.target_value); });
    setYearMetasVals(pre);
  };
  const openYearMetas = () => {
    if (!canEdit) return;
    if (indicatorsList.length === 0) return alert('Cadastre ao menos um indicador antes de definir metas.');
    const y = new Date().getFullYear();
    setYearMetasYear(y); fillYearMetas(y); setYearMetasOpen(true);
  };
  const changeYearMetas = (delta: number) => { const y = yearMetasYear + delta; setYearMetasYear(y); fillYearMetas(y); };
  const applyRowAll = (indId: string) => {
    const first = YM_MONTHS.map(m => yearMetasVals[`${indId}|${m}`]).find(v => v !== undefined && v !== '');
    if (first === undefined) return alert('Preencha um mês primeiro para replicar nos demais.');
    setYearMetasVals(prev => { const n = { ...prev }; YM_MONTHS.forEach(m => { n[`${indId}|${m}`] = first; }); return n; });
  };
  const saveYearMetas = async () => {
    const cid = activeClientId || currentUser.client_id;
    const rows: any[] = [];
    indicatorsList.forEach((ind: any) => YM_MONTHS.forEach(m => {
      const v = yearMetasVals[`${ind.id}|${m}`];
      if (v !== undefined && v !== '' && !isNaN(Number(v))) rows.push({ client_id: cid, indicator_id: ind.id, period: `${yearMetasYear}-${m}-01`, target_value: Number(v) });
    }));
    if (rows.length === 0) return alert('Preencha ao menos uma meta.');
    setYearMetasSaving(true);
    try {
      await supabase.from('indicator_targets').upsert(rows, { onConflict: 'indicator_id,period' });
      addLog('Indicadores', `Metas do ano ${yearMetasYear}: ${rows.length} meta(s) salvas.`);
      setYearMetasOpen(false);
      await reloadIndicators();
      alert(`✅ ${rows.length} meta(s) salvas para ${yearMetasYear}.`);
    } catch (e: any) { alert('Erro ao salvar metas: ' + (e?.message || e)); }
    finally { setYearMetasSaving(false); }
  };

  // ----- Importação de planilha (CSV) -----
  const normName = (s: any) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const parseNum = (raw: any) => { let s = String(raw).trim(); if (s === '') return NaN; if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return Number(s); };
  const parsePeriod = (raw: any) => {
    const s = String(raw).trim(); let m;
    if ((m = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/))) return `${m[1]}-${m[2]}-01`;
    if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return `${m[2]}-${m[1].padStart(2, '0')}-01`;
    if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) return `${m[3]}-${m[2]}-01`;
    return null;
  };
  const parseCsv = (text: string) => {
    const delim = (text.split('\n')[0] || '').includes(';') ? ';' : ',';
    const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim() !== '');
    return lines.map(line => {
      const cells: string[] = []; let cur = ''; let q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (c === delim && !q) { cells.push(cur); cur = ''; }
        else cur += c;
      }
      cells.push(cur);
      return cells.map(x => x.trim());
    });
  };
  const openImport = () => { if (!canEdit) return; setImportRows([]); setImportOpen(true); };
  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ''));
        if (rows.length < 2) { alert('Planilha vazia ou sem dados.'); return; }
        const header = rows[0].map(normName);
        let ci = header.findIndex(h => h.includes('indicad'));
        let cp = header.findIndex(h => /compet|mes|per|data/.test(h));
        let cv = header.findIndex(h => /valor|value/.test(h));
        let cf = header.findIndex(h => /fonte|source/.test(h));
        // Sem cabeçalho reconhecido → assume ordem indicador, competência, valor, fonte
        const hasHeader = ci >= 0 && cp >= 0 && cv >= 0;
        if (!hasHeader) { ci = 0; cp = 1; cv = 2; cf = 3; }
        const dataRows = hasHeader ? rows.slice(1) : rows;
        const byName = new Map(indicatorsList.map((i: any) => [normName(i.name), i]));
        const parsed = dataRows.map((r: any) => {
          const name = r[ci] || '';
          const ind = byName.get(normName(name));
          const period = parsePeriod(r[cp]);
          const value = parseNum(r[cv]);
          const source = cf >= 0 ? (r[cf] || '') : '';
          let reason = '';
          if (!name) reason = 'linha sem indicador';
          else if (!ind) reason = 'indicador não encontrado';
          else if (!period) reason = 'competência inválida';
          else if (isNaN(value)) reason = 'valor inválido';
          return { name, indicator: ind, period, value, source, ok: !reason, reason };
        });
        setImportRows(parsed);
      } catch (err: any) { alert('Erro ao ler a planilha: ' + (err?.message || err)); }
      finally { if (indCsvRef.current) indCsvRef.current.value = ''; }
    };
    reader.readAsText(file, 'utf-8');
  };
  const runImport = async () => {
    const valid = importRows.filter((r: any) => r.ok);
    if (valid.length === 0) return alert('Nenhuma linha válida para importar.');
    setImporting(true);
    try {
      const items = valid.map((r: any) => ({ indicator_id: r.indicator.id, period: r.period, value: r.value, source: r.source }));
      const { ok, fired } = await commitReadings(items);
      addLog('Indicadores', `Importação de planilha: ${ok} leitura(s).`);
      setImportOpen(false);
      await fetchInitialData();
      alert(`✅ ${ok} leitura(s) importada(s).` + (fired > 0 ? `\n⚠ ${fired} gatilho(s) disparado(s).` : ''));
    } catch (e: any) { alert('Erro na importação: ' + (e?.message || e)); }
    finally { setImporting(false); }
  };
  // ----- Link de coleta (token) -----
  const openCollect = () => {
    if (!canEdit) return;
    const now = new Date();
    setCollectPeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    setCollectUrl(''); setCollectCopied(false);
    setCollectModalOpen(true);
  };
  const genCollectLink = async () => {
    if (!collectPeriod) return alert('Escolha a competência (mês).');
    setCollectMinting(true); setCollectUrl(''); setCollectCopied(false);
    try {
      const cid = activeClientId || currentUser.client_id;
      const { data, error } = await supabase.functions.invoke('collect-readings', { body: { action: 'mint', client_id: cid, period: collectPeriod } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setCollectUrl(`${window.location.origin}?coleta=${data.token}`);
      addLog('Indicadores', `Link de coleta gerado (${collectPeriod}).`);
    } catch (e: any) { alert('Erro ao gerar o link: ' + (e?.message || e)); }
    finally { setCollectMinting(false); }
  };
  const copyCollectUrl = async () => {
    try { await navigator.clipboard.writeText(collectUrl); setCollectCopied(true); setTimeout(() => setCollectCopied(false), 2000); } catch { /* ignore */ }
  };
  const downloadTemplate = () => {
    const rows = ['indicador;competencia;valor;fonte'];
    indicatorsList.forEach((i: any) => rows.push(`${i.name};2026-06;;`));
    if (indicatorsList.length === 0) rows.push('Margem EBITDA;2026-06;12,4;Controladoria');
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'modelo_indicadores.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ----- CRUD de Gatilhos -----
  const openTrigModal = (ind: any) => {
    if (!canEdit) return;
    setTrigForm({ name: '', operator: 'lt', threshold_value: '', threshold_value_secondary: '', severity: 'attention', scenario: govSettings.active_scenario || 'Base', create_action_on_breach: true, notify_on_breach: true, assignee_member_id: '' });
    setTrigModal(ind);
  };
  const saveTrigger = async () => {
    if (!trigModal) return;
    if (!trigForm.name?.trim()) return alert('Dê um nome ao gatilho.');
    if (trigForm.threshold_value === '' || isNaN(Number(trigForm.threshold_value))) return alert('Informe o limite (valor numérico).');
    const isRange = trigForm.operator === 'outside' || trigForm.operator === 'inside';
    if (isRange && (trigForm.threshold_value_secondary === '' || isNaN(Number(trigForm.threshold_value_secondary)))) return alert('Faixas (dentro/fora) exigem o segundo limite.');
    setTrigSaving(true);
    try {
      const cid = activeClientId || currentUser.client_id;
      const indId = trigModal.indicator_id || trigModal.id;
      const { error } = await supabase.from('triggers').insert([{
        client_id: cid, indicator_id: indId, name: trigForm.name.trim(),
        operator: trigForm.operator, threshold_value: Number(trigForm.threshold_value),
        threshold_value_secondary: isRange ? Number(trigForm.threshold_value_secondary) : null,
        severity: trigForm.severity, scenario: trigForm.scenario || 'Base',
        create_action_on_breach: trigForm.create_action_on_breach,
        notify_on_breach: trigForm.notify_on_breach, assignee_member_id: trigForm.assignee_member_id || null,
      }]);
      if (error) throw new Error(error.message);
      addLog('Indicadores', `Gatilho criado: ${trigForm.name} [${trigForm.scenario}] (${trigModal.name})`);
      setTrigForm({ name: '', operator: 'lt', threshold_value: '', threshold_value_secondary: '', severity: 'attention', scenario: trigForm.scenario || 'Base', create_action_on_breach: true, notify_on_breach: true, assignee_member_id: '' });
      await reloadIndicators();
    } catch (e: any) { alert('Erro ao criar gatilho: ' + (e?.message || e)); }
    finally { setTrigSaving(false); }
  };
  const deleteTrigger = async (t: any) => {
    if (!canEdit) return;
    if (!window.confirm(`Excluir o gatilho "${t.name}"?`)) return;
    const { error } = await supabase.from('triggers').delete().eq('id', t.id);
    if (error) { alert('Erro ao excluir gatilho: ' + error.message); return; }
    addLog('Indicadores', `Gatilho excluído: ${t.name}`);
    await reloadIndicators();
  };

  // --- PERFIL DA EMPRESA ---
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop();
    const fileName = `${activeClientId || currentUser.client_id}/logo.${ext}`;
    const { error: upError } = await supabase.storage.from('client-logos').upload(fileName, file, { upsert: true });
    if (upError) { alert('Erro no upload: ' + upError.message); return; }
    const { data: urlData } = supabase.storage.from('client-logos').getPublicUrl(fileName);
    // ?v=timestamp fura o cache do navegador — sem isso, reenviar com a mesma extensão
    // mantém a URL igual e a imagem antiga continua aparecendo.
    setClientProfileForm(prev => ({ ...prev, logo_url: `${urlData.publicUrl}?v=${Date.now()}` }));
  };

  const saveClientProfile = async () => {
    setSavingClientProfile(true);
    const payload = { client_id: activeClientId || currentUser.client_id, name: clientProfileForm.name, logo_url: clientProfileForm.logo_url };
    const { data, error } = await supabase.from('clients').upsert(payload, { onConflict: 'client_id' }).select().single();
    if (error) { alert('Erro ao salvar perfil: ' + error.message); }
    else { setClientProfile(data); addLog('Configuração', `Perfil da empresa atualizado: ${data.name}`); alert('✅ Perfil salvo com sucesso!'); }
    setSavingClientProfile(false);
  };

  // --- GESTÃO DE CLIENTES (SuperAdmin) ---
  const selectClientForManagement = async (clientId: string) => {
    if (managedClientId === clientId) {
      setManagedClientId(null); setManagedClientProfile(null);
      setManagedClientForm({ name: '', logo_url: '' }); return;
    }
    setManagedClientId(clientId);
    const { data } = await supabase.from('clients').select('*').eq('client_id', clientId).maybeSingle();
    setManagedClientProfile(data || null);
    setManagedClientForm({ name: data?.name || clientId, logo_url: data?.logo_url || '' });
  };

  const saveManagedClientProfile = async () => {
    if (!managedClientId) return;
    setSavingManagedClient(true);
    const payload = {
      client_id: managedClientId,
      name: managedClientForm.name || managedClientId,
      logo_url: managedClientForm.logo_url || '',
      clicksign_enabled: managedClientProfile?.clicksign_enabled ?? false
    };
    const { data, error } = await supabase.from('clients').upsert(payload, { onConflict: 'client_id' }).select().single();
    if (error) { alert('Erro ao salvar: ' + error.message); }
    else {
      setManagedClientProfile(data);
      setAllClientsList(prev => prev.map((c: any) => c.client_id === managedClientId ? data : c));
      addLog('Configuração', `Perfil do cliente ${managedClientId} atualizado: ${data.name}`);
      alert('✅ Perfil salvo com sucesso!');
    }
    setSavingManagedClient(false);
  };

  const toggleManagedClickSign = async () => {
    if (!managedClientId) return;
    const newVal = !managedClientProfile?.clicksign_enabled;
    const payload = {
      client_id: managedClientId,
      name: managedClientForm.name || managedClientId,
      logo_url: managedClientForm.logo_url || '',
      clicksign_enabled: newVal
    };
    const { data, error } = await supabase.from('clients').upsert(payload, { onConflict: 'client_id' }).select().single();
    if (!error && data) {
      setManagedClientProfile(data);
      setAllClientsList(prev => prev.map((c: any) => c.client_id === managedClientId ? data : c));
      addLog('Configuração', `ClickSign ${newVal ? 'ativado' : 'desativado'} para ${managedClientId}`);
    }
  };

  const toggleManagedStrategy = async () => {
    if (!managedClientId) return;
    const newVal = !managedClientProfile?.strategy_enabled;
    const payload = {
      client_id: managedClientId,
      name: managedClientForm.name || managedClientId,
      logo_url: managedClientForm.logo_url || '',
      strategy_enabled: newVal
    };
    const { data, error } = await supabase.from('clients').upsert(payload, { onConflict: 'client_id' }).select().single();
    if (!error && data) {
      setManagedClientProfile(data);
      setAllClientsList(prev => prev.map((c: any) => c.client_id === managedClientId ? data : c));
      addLog('Configuração', `Planejamento Estratégico ${newVal ? 'ativado' : 'desativado'} para ${managedClientId}`);
    }
  };

  // Cria um novo cliente (tenant) — apenas SuperAdmin
  const createClient = async () => {
    if (!isSuper) return;
    const cid = newClientForm.client_id.trim().toUpperCase();
    const name = newClientForm.name.trim();
    if (!cid) return alert('Informe o identificador (Client ID).');
    if (!/^[A-Z0-9_]+$/.test(cid)) return alert('O Client ID deve conter apenas letras, números e _ (sem espaços ou acentos).');
    if (allClientsList.some((c: any) => c.client_id === cid)) return alert(`Já existe um cliente com o identificador "${cid}".`);
    setCreatingClient(true);
    const payload = { client_id: cid, name: name || cid, logo_url: '', clicksign_enabled: false };
    const { data, error } = await supabase.from('clients').insert(payload).select().single();
    if (error) { alert('Erro ao criar cliente: ' + error.message); setCreatingClient(false); return; }
    setAllClientsList(prev => [...prev, data].sort((a: any, b: any) => (a.name || a.client_id).localeCompare(b.name || b.client_id)));
    addLog('Cadastro', `Cliente criado: ${cid}`);
    setNewClientForm({ client_id: '', name: '' });
    setCreatingClient(false);
    alert(`✅ Cliente "${data.name}" criado!\n\nAgora clique no cliente acima para adicionar a logo e o ClickSign, e cadastre o Administrador dele em "Cadastrar Novo Membro".`);
    selectClientForManagement(cid);
  };

  // Ativa/inativa a conta da empresa (reversível) — apenas SuperAdmin
  const toggleManagedActive = async () => {
    if (!managedClientId) return;
    const newVal = !(managedClientProfile?.active ?? true);
    if (!newVal && !window.confirm(`Inativar a conta de "${managedClientForm.name || managedClientId}"?\n\nOs usuários dessa empresa não conseguirão mais acessar o sistema (os dados são preservados e você pode reativar a qualquer momento).`)) return;
    const payload = {
      client_id: managedClientId,
      name: managedClientForm.name || managedClientId,
      logo_url: managedClientForm.logo_url || '',
      clicksign_enabled: managedClientProfile?.clicksign_enabled ?? false,
      active: newVal,
    };
    const { data, error } = await supabase.from('clients').upsert(payload, { onConflict: 'client_id' }).select().single();
    if (!error && data) {
      setManagedClientProfile(data);
      setAllClientsList(prev => prev.map((c: any) => c.client_id === managedClientId ? data : c));
      addLog('Configuração', `Cliente ${managedClientId} ${newVal ? 'reativado' : 'inativado'}`);
    } else if (error) { alert('Erro: ' + error.message); }
  };

  // Exclui DEFINITIVAMENTE a empresa e todos os seus dados/logins — apenas SuperAdmin
  const deleteClientAccount = async () => {
    if (!managedClientId) return;
    if (managedClientId === currentUser.client_id) return alert('Você não pode excluir a própria empresa.');
    const typed = window.prompt(`ATENÇÃO — AÇÃO IRREVERSÍVEL.\n\nIsto apaga DEFINITIVAMENTE a empresa "${managedClientForm.name || managedClientId}", incluindo todas as reuniões, atas e os logins dos membros.\n\nDigite o identificador "${managedClientId}" para confirmar:`);
    if (typed == null) return;
    if (typed.trim().toUpperCase() !== managedClientId.toUpperCase()) return alert('Identificador não confere. Exclusão cancelada.');
    setDeletingClient(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-client', { body: { client_id: managedClientId } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const deletedId = managedClientId;
      setAllClientsList(prev => prev.filter((c: any) => c.client_id !== deletedId));
      setUsers(prev => prev.filter((u: any) => u.client_id !== deletedId));
      setManagedClientId(null); setManagedClientProfile(null); setManagedClientForm({ name: '', logo_url: '' });
      addLog('Exclusão', `Empresa excluída: ${deletedId}`);
      alert(`✅ Empresa excluída.` + (data?.summary ? `\n${data.summary}` : ''));
    } catch (e: any) {
      alert('Erro ao excluir: ' + (e?.message || e));
    } finally {
      setDeletingClient(false);
    }
  };

  // --- PERFIL ASSISTENTE: materiais via Edge Function ---
  const loadAssistantMeetings = async () => {
    setAssistantLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('assistant-materials', { body: { action: 'list' } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setAssistantMeetings(data?.meetings || []);
    } catch (e: any) {
      console.error('Erro ao carregar materiais:', e?.message || e);
    } finally {
      setAssistantLoading(false);
    }
  };

  const assistantUploadMaterial = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !assistantSelectedId) return;
    setAssistantLoading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `materiais/${currentUser.client_id}/${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('meeting-files').upload(path, file);
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage.from('meeting-files').createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signErr) throw signErr;
      const { data, error } = await supabase.functions.invoke('assistant-materials', {
        body: { action: 'add', meetingId: assistantSelectedId, material: { name: file.name, url: signed.signedUrl, path } },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      await loadAssistantMeetings();
      addLog('Upload', `Material enviado (assistente): ${file.name}`);
      alert('✅ Material enviado!');
    } catch (e: any) {
      alert('Erro ao enviar material: ' + (e?.message || e));
    } finally {
      setAssistantLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const assistantDeleteMaterial = async (meetingId: string, material: any) => {
    if (!window.confirm(`Remover o material "${material.name}"?`)) return;
    setAssistantLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('assistant-materials', {
        body: { action: 'delete', meetingId, path: material.path, url: material.url },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      await loadAssistantMeetings();
      addLog('Exclusão', `Material removido (assistente): ${material.name}`);
    } catch (e: any) {
      alert('Erro ao remover material: ' + (e?.message || e));
    } finally {
      setAssistantLoading(false);
    }
  };

  const handleManagedLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !managedClientId) return;
    const ext = file.name.split('.').pop();
    const fileName = `${managedClientId}/logo.${ext}`;
    const { error: upError } = await supabase.storage.from('client-logos').upload(fileName, file, { upsert: true });
    if (upError) { alert('Erro no upload: ' + upError.message); return; }
    const { data: urlData } = supabase.storage.from('client-logos').getPublicUrl(fileName);
    // ?v=timestamp fura o cache (reenvio com a mesma extensão manteria a URL igual)
    setManagedClientForm(prev => ({ ...prev, logo_url: `${urlData.publicUrl}?v=${Date.now()}` }));
  };

  // Retorna o nome do votante que corresponde ao usuário atual (por nome ou por email)
  const resolveVoterName = (voters: string[]): string | null => {
    if (voters.includes(currentUser?.name)) return currentUser.name;
    const match = (currentMeeting.participants || []).find(
      (p: any) => p.email === currentUser?.email && voters.includes(p.name)
    );
    return match?.name ?? null;
  };

  // Versão genérica (para deliberações extraordinárias — usa os participantes informados)
  const resolveVoterNameIn = (participants: any[], voters: string[]): string | null => {
    if (voters.includes(currentUser?.name)) return currentUser.name;
    const match = (participants || []).find((p: any) => p.email === currentUser?.email && voters.includes(p.name));
    return match?.name ?? null;
  };

  // ─── DELIBERAÇÕES EXTRAORDINÁRIAS (fora de reunião) ───
  const isExtraContainer = (m: any) => m?.type === 'Extraordinária';
  const findExtraContainer = () => meetings.find((m: any) => isExtraContainer(m) && m.client_id === (activeClientId || currentUser?.client_id));

  // Garante o contêiner (reunião oculta) que guarda as deliberações extraordinárias do cliente
  const ensureExtraContainer = async () => {
    const internos = clientMembers.filter((u: any) => u.email).map((u: any) => ({ name: u.name, email: u.email, isExternal: false }));
    let container = findExtraContainer();
    if (container) {
      if (JSON.stringify(container.participants || []) !== JSON.stringify(internos)) {
        await supabase.from('meetings').update({ participants: internos }).eq('id', container.id);
        container = { ...container, participants: internos };
        setMeetings((prev: any) => prev.map((m: any) => m.id === container!.id ? container : m));
      }
      return container;
    }
    const row = {
      title: 'Deliberações Extraordinárias', status: 'Extraordinária', type: 'Extraordinária',
      date: null, time: null, link: '', address: '',
      participants: internos, pautas: [], materiais: [], deliberacoes: [], acoes: [], atas: [],
      client_id: activeClientId || currentUser.client_id,
    };
    const { data, error } = await supabase.from('meetings').insert([row]).select();
    if (error) { alert('Erro ao preparar a área de deliberações extraordinárias: ' + error.message); return null; }
    setMeetings((prev: any) => [data[0], ...prev]);
    return data[0];
  };

  const openExtraDelibModal = () => {
    if (!canEdit) return;
    setExtraDelibForm({ title: '', voters: clientMembers.map((u: any) => u.name) });
    setIsExtraDelibOpen(true);
  };

  const createExtraDeliberation = async () => {
    if (!canEdit) return;
    if (!extraDelibForm.title.trim()) return alert('Informe o título da deliberação.');
    if (extraDelibForm.voters.length === 0) return alert('Selecione ao menos um conselheiro votante.');
    setExtraCreating(true);
    try {
      const container = await ensureExtraContainer();
      if (!container) return;
      const newDelib = { id: Date.now(), title: extraDelibForm.title.trim(), voters: extraDelibForm.voters, votes: {}, extra: true };
      const newDelibs = [...(container.deliberacoes || []), newDelib];
      const { error } = await supabase.from('meetings').update({ deliberacoes: newDelibs }).eq('id', container.id);
      if (error) throw new Error(error.message);
      setMeetings((prev: any) => prev.map((m: any) => m.id === container.id ? { ...container, deliberacoes: newDelibs } : m));
      addLog('Deliberação', `Deliberação extraordinária criada: ${newDelib.title}`);
      setExtraDelibForm({ title: '', voters: [] });
      setIsExtraDelibOpen(false);
      setVotingDelibId(newDelib.id);
    } catch (e: any) {
      alert('Erro ao criar deliberação: ' + (e?.message || e));
    } finally {
      setExtraCreating(false);
    }
  };

  // Voto em deliberação extraordinária — via Edge Function segura (qualquer votante elegível)
  const handleExtraVote = async (delibId: number, voteType: 'Favor' | 'Contra' | 'Abstenção') => {
    const container = findExtraContainer();
    if (!container) return;
    const { data, error } = await supabase.functions.invoke('register-vote', {
      body: { meetingId: container.id, delibId, voteType },
    });
    if (error || data?.error) { alert('Erro ao registrar voto: ' + (error?.message || data?.error)); return; }
    setMeetings((prev: any) => prev.map((m: any) => m.id === container.id ? { ...container, deliberacoes: data.deliberacoes, ...(data.acoes ? { acoes: data.acoes } : {}) } : m));
    addLog('Votação', `Voto "${voteType}" (extraordinária)`);
    if (data.generatedAction) alert('✅ Deliberação aprovada! Uma ação foi criada no Plano de Ação.');
  };

  const updateExtraDelibVoters = async (delibId: number, newVoters: string[]) => {
    if (!canEdit) return;
    const container = findExtraContainer();
    if (!container) return;
    const newDelibs = (container.deliberacoes || []).map((d: any) => d.id === delibId ? { ...d, voters: newVoters } : d);
    const { error } = await supabase.from('meetings').update({ deliberacoes: newDelibs }).eq('id', container.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setMeetings((prev: any) => prev.map((m: any) => m.id === container.id ? { ...container, deliberacoes: newDelibs } : m));
  };

  const deleteExtraDeliberation = async (delibId: number) => {
    if (!canEdit) return;
    if (!window.confirm('Excluir esta deliberação extraordinária?')) return;
    const container = findExtraContainer();
    if (!container) return;
    const newDelibs = (container.deliberacoes || []).filter((d: any) => d.id !== delibId);
    const { error } = await supabase.from('meetings').update({ deliberacoes: newDelibs }).eq('id', container.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setMeetings((prev: any) => prev.map((m: any) => m.id === container.id ? { ...container, deliberacoes: newDelibs } : m));
    setVotingDelibId(null);
    addLog('Exclusão', 'Deliberação extraordinária removida.');
  };

  // Envia convite de voto por e-mail (magic link) aos votantes — reuniões e extraordinárias
  const sendVoteInvitationsCore = async (meetingId: string, ident: { delibId?: number; delibIndex?: number }) => {
    if (!meetingId) { alert('Salve a reunião antes de enviar convites de voto.'); return; }
    setSendingVoteInvites(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-vote-invitations', {
        body: { meetingId, ...ident, appOrigin: window.location.origin },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      addLog('Convite de Voto', `Convites de voto por e-mail enviados (${data.sent}).`);
      let msg = `✅ ${data.sent} convite(s) de voto enviado(s) por e-mail.`;
      if (data.skipped?.length) msg += `\n\nSem e-mail cadastrado (não enviados): ${data.skipped.join(', ')}`;
      alert(msg);
    } catch (e: any) {
      alert('Erro ao enviar convites: ' + (e?.message || e));
    } finally {
      setSendingVoteInvites(false);
    }
  };
  // Atalho para o modal de deliberação extraordinária
  const sendVoteInvitations = (delibId: number) => {
    const container = findExtraContainer();
    if (container) sendVoteInvitationsCore(container.id, { delibId });
  };

  // Deep-link: ao chegar via magic link (?vmeet=&vdelib=), abre a votação quando os dados carregarem
  useEffect(() => {
    if (!pendingVote || !currentUser) return;
    const meeting = meetings.find((m: any) => m.id === pendingVote.meetingId);
    if (!meeting) return; // aguarda o carregamento das reuniões
    if (isExtraContainer(meeting)) {
      setActiveMenu('deliberacoes');
      if (pendingVote.delibId != null) setVotingDelibId(pendingVote.delibId);
    } else {
      setCurrentMeeting(meeting);
      setView('details');
      setTab('delib');
      setActiveMenu('reunioes');
    }
    setPendingVote(null);
    try { window.history.replaceState({}, '', window.location.pathname); } catch { /* ignore */ }
  }, [pendingVote, currentUser, meetings]);

  // --- LÓGICA DE VOTAÇÃO ---
  const handleRegisterVote = async (delibIndex: number, voteType: 'Favor' | 'Contra' | 'Abstenção') => {
    if (!currentMeeting.id) { alert('Salve a reunião antes de registrar votos.'); return; }
    const delibTitle = (currentMeeting.deliberacoes || [])[delibIndex]?.title || '';
    // Voto registrado via Edge Function segura (permite voto individual de qualquer votante elegível)
    const { data, error } = await supabase.functions.invoke('register-vote', {
      body: { meetingId: currentMeeting.id, delibIndex, voteType },
    });
    if (error || data?.error) { alert('Erro ao registrar voto: ' + (error?.message || data?.error)); return; }
    const updatedMeeting = { ...currentMeeting, deliberacoes: data.deliberacoes, ...(data.acoes ? { acoes: data.acoes } : {}) };
    setCurrentMeeting(updatedMeeting);
    setMeetings((prev: any) => prev.map((m: any) => m.id === currentMeeting.id ? updatedMeeting : m));
    addLog('Votação', `Voto "${voteType}" em: ${delibTitle}`);
    if (data.generatedAction) {
      alert(`✅ Deliberação aprovada!\n\nUma ação foi criada automaticamente no Plano de Ação:\n"${delibTitle}"`);
    }
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
    const allA = filteredM.flatMap(m => (m.acoes || []).map((a: any) => ({ ...a, mTitle: m.title, mId: m.id, mDate: m.date })))
      .filter(a => filterResp === 'all' || (a.resps?.length > 0 ? a.resps.includes(filterResp) : a.resp === filterResp))
      .filter(a => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'Atrasada') return a.status !== 'Concluída' && a.date && new Date(a.date) < today;
        return a.status === filterStatus;
      })
      .filter(a => (filterOrigin === 'all' || a.mId === filterOrigin))
      .filter(a => (filterPriority === 'all' || (a.priority || 'Média') === filterPriority))
      .filter(a => {
        if (filterObjective === 'all') return true;
        if (filterObjective === 'with') return !!a.objective_id;
        if (filterObjective === 'none') return !a.objective_id;
        return a.objective_id === filterObjective;
      })
      // Ordena por prioridade (Urgente primeiro), depois pelo prazo mais próximo
      .sort((a, b) => (PRIORITY_WEIGHT[a.priority || 'Média'] - PRIORITY_WEIGHT[b.priority || 'Média']) || ((a.date || '9999').localeCompare(b.date || '9999')));
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
  }, [meetings, dashboardFilter, filterResp, filterStatus, filterOrigin, filterPriority, filterObjective, strategyObjectives]);

  // Estatísticas exclusivas do Dashboard — dependem apenas do filtro de reunião
  // (não herdam os filtros de Responsável/Status/Origem do Plano de Ação)
  const dashStats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const filteredM = dashboardFilter === 'all' ? meetings : meetings.filter(m => m.id === dashboardFilter);
    const allA = filteredM.flatMap(m => (m.acoes || []).map((a: any) => ({ ...a, mTitle: m.title, mId: m.id, mDate: m.date })));
    const isOverdue = (a: any) => a.status !== 'Concluída' && a.date && new Date(a.date) < today;
    const totalActions = allA.length;
    const concluidas = allA.filter(a => a.status === 'Concluída').length;
    const atrasadas = allA.filter(isOverdue).length;
    const emAndamento = allA.filter(a => a.status === 'Em andamento' && !isOverdue(a)).length;
    const pendentes = allA.filter(a => a.status === 'Pendente' && !isOverdue(a)).length;
    const pct = totalActions ? Math.round((concluidas / totalActions) * 100) : 0;
    const fmtDate = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'S/D';
    return {
      concluidas, totalActions, pct, atrasadas,
      delibs: filteredM.flatMap(m => m.deliberacoes || []).length,
      atas: filteredM.reduce((acc, m) => acc + (m.atas?.length || 0), 0),
      pieData: [
        { name: 'Concluída', value: concluidas, color: '#059669' },
        { name: 'Em Andamento', value: emAndamento, color: '#d97706' },
        { name: 'Pendente', value: pendentes, color: '#94a3b8' },
        { name: 'Atrasada', value: atrasadas, color: '#be123c' },
      ].filter(d => d.value > 0),
      barData: filteredM.slice(0, 6).map(m => ({ name: fmtDate(m.date), 'Pautas': m.pautas?.length || 0, 'Ações': m.acoes?.length || 0 })),
      // Pendências em aberto, atrasadas primeiro, depois pelo prazo mais próximo
      topActions: allA.filter(a => a.status !== 'Concluída').sort((a, b) => {
        const ao = isOverdue(a) ? 0 : 1, bo = isOverdue(b) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return (a.date || '9999').localeCompare(b.date || '9999');
      }),
    };
  }, [meetings, dashboardFilter]);

  // Estatísticas do add-on (camada estratégica da home): farol, OKR e objetivos por perspectiva
  const strategyStats = useMemo(() => {
    // Farol dos indicadores (realizado × meta)
    const farol = { verde: 0, amarelo: 0, vermelho: 0 };
    indicatorStatuses.forEach((s: any) => { const b = s.breach_level || 0; if (b >= 2) farol.vermelho++; else if (b === 1) farol.amarelo++; else farol.verde++; });
    const indTotal = indicatorStatuses.length;

    // Farol de um objetivo = pior farol dos indicadores vinculados (-1 = sem indicador)
    const stMap: Record<string, any> = {}; indicatorStatuses.forEach((s: any) => { stMap[s.indicator_id] = s; });
    const objFarol = (objId: string) => {
      const inds = indicatorsList.filter((i: any) => i.objective_id === objId);
      if (!inds.length) return -1;
      return Math.max(...inds.map((i: any) => (stMap[i.id]?.breach_level) || 0));
    };
    const perspRows = perspectivesList.map((p: any) => {
      const objs = strategyObjectives.filter((o: any) => o.perspective_id === p.id);
      let verde = 0, amarelo = 0, vermelho = 0;
      objs.forEach((o: any) => { const f = objFarol(o.id); if (f >= 2) vermelho++; else if (f === 1) amarelo++; else verde++; });
      return { id: p.id, name: p.name, total: objs.length, verde, amarelo, vermelho };
    }).filter((r: any) => r.total > 0);
    const objTotal = strategyObjectives.length;
    const objNoAlvo = strategyObjectives.filter((o: any) => objFarol(o.id) <= 0).length;

    // OKR do ciclo — progresso médio + confiança do último check-in
    const curMap: Record<string, any> = {}; indicatorStatuses.forEach((s: any) => { curMap[s.indicator_id] = s.current_value; });
    const krCurrent = (kr: any): number | null => kr.indicator_id ? (curMap[kr.indicator_id] != null ? Number(curMap[kr.indicator_id]) : null) : (kr.current_value != null ? Number(kr.current_value) : null);
    const krProgress = (kr: any): number => { const cur = krCurrent(kr); if (cur == null) return 0; const s = Number(kr.start_value ?? 0), t = Number(kr.target_value); if (t === s) return cur >= t ? 1 : 0; return Math.max(0, (cur - s) / (t - s)); };
    const latestConf: Record<string, string> = {}; okrCheckins.forEach((c: any) => { if (!latestConf[c.key_result_id]) latestConf[c.key_result_id] = c.confidence; });
    const krCount = okrKrs.length;
    const okrAvg = krCount ? Math.round(okrKrs.reduce((a: number, k: any) => a + Math.min(1, krProgress(k)), 0) / krCount * 100) : 0;
    const okrRisco = okrKrs.filter((k: any) => latestConf[k.id] === 'red').length;
    const okrRitmo = okrKrs.filter((k: any) => latestConf[k.id] === 'green').length;

    return {
      farol, indTotal, emAlerta: farol.amarelo + farol.vermelho, hasInd: indTotal > 0,
      perspRows, objTotal, objNoAlvo, hasObj: objTotal > 0,
      okrAvg, okrRisco, okrRitmo, krCount, hasOkr: krCount > 0,
    };
  }, [indicatorStatuses, indicatorsList, strategyObjectives, perspectivesList, okrKrs, okrCheckins]);

  // Próximas reuniões programadas (futuras, ainda não concluídas) — previsão na dashboard
  const upcomingMeetings = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return meetings
      .filter((m: any) => m.date && m.status !== 'Concluída' && new Date(m.date + 'T00:00:00') >= today)
      .sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));
  }, [meetings]);

  // Consolidado de deliberações de todas as reuniões — área de acompanhamento
  const delibStats = useMemo(() => {
    const all = meetings.flatMap((m: any) => (m.deliberacoes || []).map((d: any, idx: number) => {
      const r = deliberationResult(d);
      return { ...d, mTitle: m.title, mId: m.id, mDate: m.date, idx, extra: m.type === 'Extraordinária', delibId: d.id, ...r };
    }));
    const counts = {
      total: all.length,
      aprovadas: all.filter((d: any) => d.label === 'APROVADA').length,
      rejeitadas: all.filter((d: any) => d.label === 'REJEITADA').length,
      emVotacao: all.filter((d: any) => d.label === 'EM VOTAÇÃO').length,
    };
    const filtered = all
      .filter((d: any) => delibFilterResult === 'all' || d.label === delibFilterResult)
      .filter((d: any) => delibFilterOrigin === 'all' || d.mId === delibFilterOrigin)
      // Em votação primeiro (precisam de atenção), depois por data mais recente
      .sort((a: any, b: any) => {
        const aw = a.label === 'EM VOTAÇÃO' ? 0 : 1, bw = b.label === 'EM VOTAÇÃO' ? 0 : 1;
        if (aw !== bw) return aw - bw;
        return (b.mDate || '').localeCompare(a.mDate || '');
      });
    return { ...counts, list: filtered };
  }, [meetings, delibFilterResult, delibFilterOrigin]);

  // Verifica status da assinatura no ClickSign e atualiza a ata manualmente
  const handleCheckSignature = async (ataIndex: number) => {
    if (!currentMeeting.id) return;
    const ata = (currentMeeting.atas || [])[ataIndex];
    if (!ata?.clicksign_key) return;
    setClicksignLoading(true);
    try {
      const CLICKSIGN_BASE = 'https://sandbox.clicksign.com/api/v1'; // usa env na edge fn
      const { data, error } = await supabase.functions.invoke('clicksign-check', {
        body: { meetingId: currentMeeting.id, ataIndex, clicksign_key: ata.clicksign_key }
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.signed) {
        // Atualiza o estado local imediatamente com os dados retornados pela edge function
        if (data?.updatedAtas) {
          const localUpdated = { ...currentMeeting, atas: data.updatedAtas };
          setCurrentMeeting(localUpdated);
          setMeetings(prev => prev.map(m => m.id === currentMeeting.id ? localUpdated : m));
        }
        // Re-fetch do banco para garantir consistência
        const { data: saved } = await supabase.from('meetings').select('*').eq('id', currentMeeting.id).single();
        if (saved) { setCurrentMeeting(saved); setMeetings(prev => prev.map(m => m.id === currentMeeting.id ? saved : m)); }
        if (data?.pdfUpdated) {
          alert('✅ Ata assinada! O documento foi atualizado com a versão assinada pelo ClickSign.');
        } else {
          alert('✅ Ata marcada como assinada. O PDF assinado não estava disponível ainda — tente novamente em alguns minutos.');
        }
      } else {
        const pending = data?.pending != null ? `\n${data.pending} de ${data.total} assinatura(s) pendente(s).` : '';
        alert(`Status atual: ${data?.status ?? 'aguardando assinaturas'}${pending}`);
      }
    } catch (err: any) {
      alert('Erro ao verificar: ' + err.message);
    } finally {
      setClicksignLoading(false);
    }
  };

  // Envia ata para assinatura digital via ClickSign
  const handleSendToClickSign = async (ataIndex: number) => {
    if (!currentMeeting.id) return;
    const ata = (currentMeeting.atas || [])[ataIndex];
    if (!ata) return;
    const internalParticipants = (currentMeeting.participants || []).filter((p: any) => !p.isExternal && p.email);
    if (internalParticipants.length === 0) { alert('Nenhum participante interno com e-mail cadastrado para assinar.'); return; }
    if (!window.confirm(`Enviar "${ata.name}" para assinatura digital de ${internalParticipants.length} participante(s) via ClickSign?`)) return;
    setClicksignLoading(true);
    try {
      // Gera URL fresca do arquivo
      const match = ata.url.match(/\/(?:sign|public)\/meeting-files\/(.+?)(?:\?|$)/);
      if (!match) throw new Error('Não foi possível localizar o arquivo da ata no servidor.');
      const { data: freshUrl, error: urlErr } = await supabase.storage.from('meeting-files').createSignedUrl(match[1], 300);
      if (urlErr || !freshUrl?.signedUrl) throw new Error('Erro ao gerar link do arquivo.');
      const { data, error } = await supabase.functions.invoke('clicksign-flow', {
        body: {
          meetingId: currentMeeting.id,
          ataUrl: freshUrl.signedUrl,
          ataName: ata.name,
          meetingTitle: currentMeeting.title,
          meetingDate: currentMeeting.date,
          participants: internalParticipants.map((p: any) => ({ name: p.name, email: p.email })),
        }
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const updatedAtas = (currentMeeting.atas || []).map((a: any, i: number) =>
        i === ataIndex ? { ...a, clicksign_key: data.clicksign_key, clicksign_status: 'pending', clicksign_sent_at: new Date().toISOString() } : a
      );
      const { data: saved, error: saveErr } = await supabase.from('meetings').update({ atas: updatedAtas }).eq('id', currentMeeting.id).select().single();
      if (saveErr) throw saveErr;
      setCurrentMeeting(saved);
      setMeetings(prev => prev.map(m => m.id === currentMeeting.id ? saved : m));
      addLog('Assinatura Digital', `Ata enviada ao ClickSign: ${ata.name}`);
      alert('✅ Ata enviada para assinatura! Os participantes receberão um e-mail do ClickSign para assinar.');
    } catch (err: any) {
      alert('Erro ao enviar para assinatura: ' + err.message);
    } finally {
      setClicksignLoading(false);
    }
  };

  // Remove uma ata da reunião e salva no banco
  const handleDeleteAta = async (meetingId: string, ataIndex: number, ataName: string) => {
    if (!isAdm) return;
    if (!window.confirm(`Deseja excluir a ata "${ataName}"? Esta ação não pode ser desfeita.`)) return;
    const meeting = meetings.find(m => m.id === meetingId) || currentMeeting;
    const newAtas = (meeting.atas || []).filter((_: any, i: number) => i !== ataIndex);
    const { data: saved, error } = await supabase
      .from('meetings')
      .update({ atas: newAtas })
      .eq('id', meetingId)
      .select()
      .single();
    if (error) { alert('Erro ao excluir ata: ' + error.message); return; }
    setMeetings(prev => prev.map(m => m.id === meetingId ? saved : m));
    if (currentMeeting.id === meetingId) setCurrentMeeting(saved);
    addLog('Exclusão', `Ata removida: ${ataName}`);
  };

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

  // Baixa a ata do repositório com marca d'água (nome/e-mail/data-hora de quem baixou)
  const downloadAtaWatermarked = async (ata: any) => {
    const sourceUrl = (ata.clicksign_status === 'signed' && ata.clicksign_signed_url) ? ata.clicksign_signed_url : ata.url;
    if (!sourceUrl) { alert('Arquivo da ata indisponível.'); return; }
    setDownloadingAta(true);
    try {
      const { data, error } = await supabase.functions.invoke('download-ata', { body: { url: sourceUrl } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      const bytes = Uint8Array.from(atob(data.pdf_base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = (ata.name || 'ata').toLowerCase().endsWith('.pdf') ? ata.name : `${ata.name || 'ata'}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 8000);
      addLog('Download', `Ata baixada com marca d'água: ${ata.name}`);
    } catch (e: any) {
      alert('Erro ao baixar a ata: ' + (e?.message || e));
    } finally {
      setDownloadingAta(false);
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
              await supabase.functions.invoke('send-invitation', { body: { meetingData: currentMeeting, recipients: emails, organizer: { name: currentUser.name, email: currentUser.email } } });
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

  // ── Voto por e-mail (página pública, sem login) ──
  if (voteToken) {
    return <PublicVote token={voteToken} />;
  }

  // ── Coleta de indicadores (página pública, sem login) ──
  if (collectToken) {
    return <PublicCollect token={collectToken} />;
  }

  // ── Tela de definição de nova senha (após clicar no link do e-mail de recuperação) ──
  if (isRecovering) {
    return <RecoverPassword onDone={() => setIsRecovering(false)} />;
  }

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden text-slate-800">
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-slate-300 flex flex-col shadow-xl transition-all duration-300 md:relative transform ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'} ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}`}>
        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="absolute -right-3 top-20 bg-amber-600 text-white rounded-full p-1 shadow-md hidden md:block z-[60] hover:bg-amber-700 transition-colors">
          {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <div className={`flex flex-col border-b border-white/5 bg-slate-900/40 transition-all duration-300 ${isSidebarCollapsed ? 'items-center py-5 px-2' : 'p-6 gap-3'}`}>
          {isSidebarCollapsed ? (
            <BoardplanMark size={34} variant="full" tone="dark" />
          ) : (
            <>
              <BoardplanLogo tone="dark" height={34} />
              {(clientProfile?.logo_url || clientProfile?.name || activeClientId || currentUser?.client_id) && (
                <div className="flex items-center pt-3 border-t border-white/5">
                  {clientProfile?.logo_url
                    ? <img src={clientProfile.logo_url} alt={clientProfile.name || 'Logo'} className="w-auto h-12 max-w-[180px] object-contain object-left opacity-90" style={{ mixBlendMode: 'lighten' }} />
                    : <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 truncate">{clientProfile?.name || activeClientId || currentUser?.client_id}</span>}
                </div>
              )}
            </>
          )}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 text-[10px] font-bold uppercase tracking-widest">
          {(isAssistant ? [
            { id: 'materiais-assistente', icon: <Upload size={18} />, label: 'Materiais' },
          ] : isController ? (strategyEnabled ? [
            { id: 'indicadores', icon: <Gauge size={18} />, label: 'Indicadores' },
          ] : []) : [
            { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
            { id: 'reunioes', icon: <Calendar size={18} />, label: 'Conselho', action: () => setView('list') },
            { id: 'plano-acao', icon: <ListChecks size={18} />, label: 'Plano de Ação' },
            { id: 'deliberacoes', icon: <Scale size={18} />, label: 'Deliberações' },
            { id: 'indicadores', icon: <Gauge size={18} />, label: 'Indicadores', addon: true },
            { id: 'estrategia', icon: <Compass size={18} />, label: 'Estratégia', addon: true },
            { id: 'repositorio-atas', icon: <Archive size={18} />, label: 'Repositório de Atas' },
            { id: 'usuarios', icon: <UserCog size={18} />, label: isSuper ? 'Contas de Clientes' : 'Membros', adm: true },
            { id: 'auditoria', icon: <History size={18} />, label: 'Auditoria', adm: true }
          ]).map((item: any) => (
            (!item.adm || isAdm) && (!item.addon || strategyEnabled) && (
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
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">INEPAD Governança e Sucessão • {isSuper ? (superViewAll ? 'GESTÃO MASTER' : `GESTÃO MASTER · ${clientProfile?.name || activeClientId}`) : (clientProfile?.name || activeClientId || currentUser.client_id)}</h2>
            {clientSwitchList.length > 1 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <Building2 size={14} className="text-amber-600 shrink-0" />
                <select value={isSuper && superViewAll ? SUPER_ALL : (activeClientId || '')} onChange={e => handleClientSwitch(e.target.value)} className="text-[10px] font-bold uppercase tracking-widest bg-transparent outline-none cursor-pointer text-amber-700 max-w-[180px]">
                  {clientSwitchList.map((c: any) => <option key={c.client_id} value={c.client_id}>{c.name || c.client_id}</option>)}
                </select>
              </div>
            )}
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
              {activeMenu === 'materiais-assistente' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Materiais das Reuniões</h1>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Envie e gerencie os documentos de apoio</p>
                    </div>
                    <button onClick={loadAssistantMeetings} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1"><History size={12} /> Atualizar</button>
                  </div>

                  {assistantLoading && assistantMeetings.length === 0 ? (
                    <div className="text-center text-amber-600 font-bold uppercase animate-pulse py-10">Carregando...</div>
                  ) : assistantMeetings.length === 0 ? (
                    <div className="bg-white p-10 rounded-xl border border-slate-200 text-center text-slate-400 text-[10px] uppercase tracking-widest">Nenhuma reunião disponível</div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-1 space-y-2">
                        {assistantMeetings.map((m: any) => (
                          <button key={m.id} onClick={() => setAssistantSelectedId(m.id)} className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between gap-2 ${assistantSelectedId === m.id ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-amber-300'}`}>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800 italic truncate">{m.title}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.date || 'Sem data'} • {(m.materiais || []).length} doc(s)</p>
                            </div>
                            <ChevronRight size={16} className={`shrink-0 ${assistantSelectedId === m.id ? 'text-amber-500' : 'text-slate-300'}`} />
                          </button>
                        ))}
                      </div>
                      <div className="lg:col-span-2">
                        {!assistantSelectedId ? (
                          <div className="bg-white p-10 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-[10px] uppercase tracking-widest h-full flex items-center justify-center">Selecione uma reunião para ver e enviar materiais</div>
                        ) : (() => {
                          const sel = assistantMeetings.find((m: any) => m.id === assistantSelectedId);
                          const mats = sel?.materiais || [];
                          return (
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                              <div className="flex justify-between items-center border-b border-slate-50 pb-4 gap-3">
                                <h3 className="text-xs font-bold uppercase text-slate-600 tracking-widest truncate">{sel?.title}</h3>
                                <button onClick={() => assistantFileRef.current?.click()} disabled={assistantLoading} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all shadow-md disabled:opacity-50 shrink-0"><Upload size={14} /> {assistantLoading ? 'Enviando...' : 'Enviar material'}</button>
                              </div>
                              {mats.length === 0 ? (
                                <div className="text-center text-slate-400 text-[10px] uppercase tracking-widest py-8">Nenhum material enviado ainda</div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {mats.map((m: any, i: number) => {
                                    const mine = m.uploadedBy === currentUser.id;
                                    return (
                                      <div key={i} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center gap-3 group">
                                        <FileText size={20} className="text-amber-600 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold italic truncate">{m.name}</p>
                                          <p className="text-[9px] text-slate-400 uppercase tracking-widest truncate">{m.uploadedByName ? `por ${m.uploadedByName}` : 'documento'}</p>
                                        </div>
                                        <a href={m.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-amber-600 shrink-0"><ExternalLink size={14} /></a>
                                        {mine && <button onClick={() => assistantDeleteMaterial(sel.id, m)} className="text-slate-200 hover:text-red-500 shrink-0" title="Remover (enviado por você)"><Trash2 size={15} /></button>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <p className="text-[9px] text-slate-400 not-italic">Você só pode remover materiais enviados por você.</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeMenu === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Painel de Governança · {superAll ? 'Consolidado Geral' : (clientProfile?.name || activeClientId || currentUser.client_id)}</h1>
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-slate-200 w-full sm:w-auto shadow-sm">
                      <Filter size={16} className="text-amber-500" /><select className="text-xs font-bold uppercase outline-none bg-transparent w-full cursor-pointer text-slate-600" value={dashboardFilter} onChange={e => setDashboardFilter(e.target.value)}>
                        <option value="all">Consolidado Geral</option>
                        {meetings.map(m => <option key={m.id} value={m.id}>{m.title}{m.date ? ` — ${new Date(m.date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Concluídas — barra de progresso + atalho ao Plano de Ação concluído */}
                    <button onClick={() => { setFilterStatus('Concluída'); setFilterResp('all'); setFilterOrigin('all'); setActiveMenu('plano-acao'); }} className="group bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 text-left transition-all hover:shadow-md hover:border-amber-300">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-amber-100 text-amber-600"><CheckCircle2 /></div>
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">Concluídas <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" /></p>
                          <p className="text-2xl font-bold text-slate-800 mt-1">{dashStats.concluidas}<span className="text-base font-bold text-slate-300">/{dashStats.totalActions}</span></p>
                        </div>
                      </div>
                      <div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${dashStats.pct}%` }} /></div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{dashStats.pct}% do plano concluído</p>
                      </div>
                    </button>

                    {/* Deliberações — informativo */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 transition-all hover:shadow-md">
                      <div className="p-3 rounded-lg bg-slate-100 text-slate-500"><FileText /></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deliberações</p><p className="text-2xl font-bold text-slate-800 mt-1">{dashStats.delibs}</p></div>
                    </div>

                    {/* Atas na Nuvem — atalho ao repositório de atas */}
                    <button onClick={() => setActiveMenu('repositorio-atas')} className="group bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 text-left transition-all hover:shadow-md hover:border-amber-300">
                      <div className="p-3 rounded-lg bg-amber-100 text-amber-600"><FileCheck /></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">Atas na Nuvem <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" /></p><p className="text-2xl font-bold text-slate-800 mt-1">{dashStats.atas}</p></div>
                    </button>

                    {/* Em Atraso — atalho ao Plano de Ação filtrado por atrasadas */}
                    <button onClick={() => { setFilterStatus('Atrasada'); setFilterResp('all'); setFilterOrigin('all'); setActiveMenu('plano-acao'); }} className={`group bg-white p-6 rounded-xl border shadow-sm flex items-start gap-4 text-left transition-all hover:shadow-md ${dashStats.atrasadas > 0 ? 'border-red-200 hover:border-red-300' : 'border-slate-200 hover:border-amber-300'}`}>
                      <div className={`p-3 rounded-lg ${dashStats.atrasadas > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}><AlertCircle /></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">Em Atraso <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" /></p><p className={`text-2xl font-bold mt-1 ${dashStats.atrasadas > 0 ? 'text-red-600' : 'text-slate-800'}`}>{dashStats.atrasadas}</p></div>
                    </button>

                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Status das Ações */}
                    <div className="bg-slate-900 p-6 rounded-xl shadow-xl flex flex-col h-[340px]"><h3 className="text-xs font-bold uppercase text-amber-500 mb-4 tracking-widest italic">Status das Ações</h3><div className="flex-1 min-h-0">
                      {dashStats.totalActions === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center gap-2"><ListChecks size={28} className="text-slate-600" /><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nenhuma ação registrada ainda</p></div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dashStats.pieData} innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>{dashStats.pieData.map((e, i) => (<Cell key={i} fill={e.color} stroke="none" />))}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} /></PieChart></ResponsiveContainer>
                      )}
                    </div></div>
                    {/* Próximas reuniões */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[340px]">
                      <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center shrink-0">
                        <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest italic flex items-center gap-2"><CalendarClock size={16} className="text-amber-600" /> Próximas Reuniões</h3>
                        {canEdit && (<button onClick={openScheduleModal} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors"><CalendarPlus size={12} /> Programar Ano</button>)}
                      </div>
                      {upcomingMeetings.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center"><CalendarClock size={28} className="text-slate-200 mb-2" /><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nenhuma reunião programada{canEdit ? ' — use "Programar Ano"' : ''}</p></div>
                      ) : (
                        <div className="p-3 flex flex-col gap-2 overflow-y-auto">
                          {upcomingMeetings.slice(0, 4).map((m: any) => {
                            const dt = new Date(m.date + 'T00:00:00');
                            const dias = Math.ceil((dt.getTime() - new Date(new Date().setHours(0, 0, 0, 0)).getTime()) / 86400000);
                            const isRae = m.type === 'RAE';
                            return (
                              <button key={m.id} onClick={() => { setCurrentMeeting(m); setView('details'); setTab('info'); setActiveMenu('reunioes'); }} className="group flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:border-amber-400 hover:shadow-sm transition-all text-left">
                                <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-lg text-white shrink-0 ${isRae ? 'bg-amber-800' : 'bg-slate-900'}`}>
                                  <span className="text-base font-bold leading-none">{String(dt.getDate()).padStart(2, '0')}</span>
                                  <span className="text-[8px] font-bold uppercase text-amber-400 tracking-wider">{dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[13px] font-bold text-slate-800 italic truncate group-hover:text-amber-600 transition-colors">{m.title}{isRae && strategyEnabled && <span className="ml-1.5 text-[8px] font-bold uppercase not-italic text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 align-middle">estratégica</span>}</p>
                                  <p className="text-[10px] text-slate-400">{dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `Em ${dias} dias`}{m.type ? ` · ${m.type}` : ''}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                      <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest italic flex items-center gap-2"><ListChecks size={16} className="text-amber-600" /> Pendências Prioritárias</h3>
                      <button onClick={() => { setFilterStatus('all'); setFilterResp('all'); setFilterOrigin('all'); setActiveMenu('plano-acao'); }} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors">Ver todas <ChevronRight size={12} /></button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm font-bold italic">
                        <thead className="bg-slate-900 text-[10px] font-bold uppercase text-amber-500 tracking-widest">
                          <tr><th className="px-6 py-4">Iniciativa</th><th className="px-6 py-4">Responsável</th><th className="px-6 py-4">Origem</th><th className="px-6 py-4 text-center">Status</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dashStats.topActions.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 uppercase text-[10px]">Nenhuma pendência em aberto 🎉</td></tr>
                          ) : (
                            dashStats.topActions.slice(0, 5).map((acao: any) => {
                              const isLate = acao.status !== 'Concluída' && acao.date && new Date(acao.date) < new Date(new Date().setHours(0, 0, 0, 0));
                              const resp = acao.resps?.length > 0 ? acao.resps.join(', ') : (acao.resp || 'N/D');
                              return (
                                <tr key={`${acao.mId}-${acao.id}`} className={`hover:bg-slate-50 transition-all border-l-4 ${isLate ? 'border-l-red-500' : 'border-l-transparent hover:border-l-amber-500'}`}>
                                  <td className="px-6 py-4 text-slate-800">{acao.title}</td>
                                  <td className="px-6 py-4 text-slate-600">{resp}</td>
                                  <td className="px-6 py-4">
                                    <p className="text-slate-500 text-[10px] uppercase tracking-widest leading-snug">{acao.mTitle}</p>
                                    {acao.mDate && <p className="text-[10px] text-slate-400 font-normal not-italic mt-1 flex items-center gap-1"><Calendar size={11} className="text-amber-500" />{new Date(acao.mDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[9px] uppercase font-bold ${isLate ? 'bg-red-100 text-red-700' : acao.status === 'Em andamento' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{isLate ? 'Atrasada' : acao.status}</span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ===================== CAMADA ESTRATÉGICA (add-on) ===================== */}
                  {strategyEnabled && (
                    <div className="space-y-6 pt-2 animate-in fade-in">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700 italic flex items-center gap-2"><Compass size={15} /> Camada Estratégica</span>
                        <span className="flex-1 h-px bg-slate-200" />
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded px-2 py-0.5 uppercase tracking-wider">Add-on ativo</span>
                      </div>

                      {!strategyStats.hasInd && !strategyStats.hasObj && !strategyStats.hasOkr ? (
                        <div className="bg-white p-8 rounded-xl border border-dashed border-slate-200 text-center">
                          <Compass size={28} className="text-slate-200 mx-auto mb-2" />
                          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Comece pelo módulo Estratégia — cadastre objetivos, indicadores e OKRs para ver os painéis aqui</p>
                          {canEdit && <button onClick={() => setActiveMenu('estrategia')} className="mt-3 text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700">Ir para Estratégia →</button>}
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Farol dos indicadores */}
                            {strategyStats.hasInd && (
                              <button onClick={() => setActiveMenu('indicadores')} className="group bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-left hover:shadow-md hover:border-amber-300 transition-all">
                                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest italic mb-4 flex items-center gap-2">Farol dos Indicadores <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" /></h3>
                                <div className="flex items-center gap-5">
                                  {(() => {
                                    const t = strategyStats.indTotal || 1, f = strategyStats.farol;
                                    const pv = f.verde / t * 100, pa = f.amarelo / t * 100, pr = f.vermelho / t * 100;
                                    return (
                                      <svg width="92" height="92" viewBox="0 0 88 88" className="shrink-0">
                                        <g transform="rotate(-90 44 44)" fill="none" strokeWidth="12">
                                          <circle cx="44" cy="44" r="32" stroke="#eef2f6" pathLength={100} />
                                          {pv > 0 && <circle cx="44" cy="44" r="32" stroke="#10b981" pathLength={100} strokeDasharray={`${pv} ${100 - pv}`} strokeDashoffset={0} />}
                                          {pa > 0 && <circle cx="44" cy="44" r="32" stroke="#f59e0b" pathLength={100} strokeDasharray={`${pa} ${100 - pa}`} strokeDashoffset={-pv} />}
                                          {pr > 0 && <circle cx="44" cy="44" r="32" stroke="#ef4444" pathLength={100} strokeDasharray={`${pr} ${100 - pr}`} strokeDashoffset={-(pv + pa)} />}
                                        </g>
                                        <text x="44" y="41" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">{strategyStats.indTotal}</text>
                                        <text x="44" y="55" textAnchor="middle" fontSize="9" fill="#94a3b8">indic.</text>
                                      </svg>
                                    );
                                  })()}
                                  <div className="flex flex-col gap-2 text-[13px] flex-1">
                                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> No alvo <b className="ml-auto text-slate-800">{strategyStats.farol.verde}</b></div>
                                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Atenção <b className="ml-auto text-slate-800">{strategyStats.farol.amarelo}</b></div>
                                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Crítico <b className="ml-auto text-slate-800">{strategyStats.farol.vermelho}</b></div>
                                  </div>
                                </div>
                              </button>
                            )}
                            {/* OKRs do ciclo */}
                            {strategyStats.hasOkr && (
                              <button onClick={() => setActiveMenu('estrategia')} className="group bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-left hover:shadow-md hover:border-amber-300 transition-all">
                                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest italic mb-3 flex items-center gap-2">OKRs do Ciclo <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" /></h3>
                                <div className="flex items-baseline gap-2"><span className="text-3xl font-bold text-slate-800">{strategyStats.okrAvg}%</span><span className="text-xs text-slate-400">progresso médio · {strategyStats.krCount} KR{strategyStats.krCount !== 1 ? 's' : ''}</span></div>
                                <div className="h-1.5 bg-slate-100 rounded-full my-3 overflow-hidden"><div className="h-full bg-amber-600 rounded-full transition-all" style={{ width: `${strategyStats.okrAvg}%` }} /></div>
                                <div className="flex gap-2 text-[11px]">
                                  <span className="flex-1 text-center bg-emerald-50 text-emerald-700 rounded-lg py-1.5 font-bold">{strategyStats.okrRitmo} no ritmo</span>
                                  <span className="flex-1 text-center bg-amber-50 text-amber-700 rounded-lg py-1.5 font-bold">{strategyStats.okrRisco} em risco</span>
                                </div>
                              </button>
                            )}
                          </div>

                          {/* Objetivos por perspectiva (BSC) */}
                          {strategyStats.hasObj && strategyStats.perspRows.length > 0 && (
                            <button onClick={() => setActiveMenu('estrategia')} className="group w-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-left hover:shadow-md hover:border-amber-300 transition-all">
                              <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest italic flex items-center gap-2">Objetivos por Perspectiva (BSC) <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" /></h3>
                                <span className="text-[11px] text-slate-400 font-bold">{strategyStats.objNoAlvo}/{strategyStats.objTotal} no alvo</span>
                              </div>
                              <div className="flex flex-col gap-3">
                                {strategyStats.perspRows.map((r: any) => {
                                  const t = r.total || 1;
                                  return (
                                    <div key={r.id} className="grid items-center gap-3" style={{ gridTemplateColumns: '130px 1fr 44px' }}>
                                      <span className="text-[13px] font-bold text-slate-800 italic truncate">{r.name}</span>
                                      <span className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
                                        {r.verde > 0 && <span style={{ width: `${r.verde / t * 100}%`, background: '#10b981' }} />}
                                        {r.amarelo > 0 && <span style={{ width: `${r.amarelo / t * 100}%`, background: '#f59e0b' }} />}
                                        {r.vermelho > 0 && <span style={{ width: `${r.vermelho / t * 100}%`, background: '#ef4444' }} />}
                                      </span>
                                      <span className="text-[11px] text-slate-400 text-right tabular-nums">{r.verde}/{r.total}</span>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex gap-4 mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> no alvo</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-500" /> atenção</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-500" /> crítico</span>
                              </div>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeMenu === 'reunioes' && (
                view === 'list' ? (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">Conselho Deliberativo</h1>{canEdit && (<div className="flex items-center gap-3 flex-wrap">{strategyEnabled && <button onClick={generateRAE} className="border border-amber-300 text-amber-700 hover:bg-amber-50 px-4 py-3 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all tracking-widest" title="Reunião de Análise Estratégica com pauta automática"><Compass size={15} /> Gerar RAE</button>}<button onClick={openScheduleModal} className="bg-slate-900 hover:bg-slate-800 text-amber-500 px-5 py-3 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all shadow-md tracking-widest"><CalendarPlus size={16} /> Programar Ano</button><button onClick={() => { setCurrentMeeting(blankMeeting); setView('details'); setTab('info'); }} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all shadow-md tracking-widest">+ Nova Reunião</button></div>)}</div>
                    <div className="grid gap-4">{meetings.filter((m: any) => !isExtraContainer(m) && m.type !== 'Indicadores').map((m) => (<div key={m.id} onClick={() => { setCurrentMeeting(m); setView('details'); setTab('info'); }} className="bg-white p-6 rounded-xl border border-slate-200 flex justify-between items-center group cursor-pointer hover:border-amber-500 hover:shadow-md transition-all shadow-sm"><div className="flex items-center gap-4"><div className="p-3 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-amber-100 group-hover:text-amber-700 transition-all"><Calendar size={24} /></div><div><h3 className="font-bold text-lg text-slate-800 group-hover:text-amber-600 transition-all italic">{m.title}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.status} • {m.date || 'DATA N/D'}</p></div></div><div className="flex items-center gap-3">{canEdit && (<button onClick={(e) => { e.stopPropagation(); deleteMeeting(m.id, m.title); }} className="p-3 text-slate-200 hover:text-red-600 rounded-lg"><Trash2 size={20} /></button>)}<ChevronRight size={20} className="text-slate-300 group-hover:text-amber-500 transition-all" /></div></div>))}</div>
                  </div>
                ) : (
                  <div className="animate-in fade-in duration-300 pb-20">
                    <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-10"><button onClick={() => setView('list')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><ChevronRight className="rotate-180" size={20} /> Voltar</button><div className="flex items-center gap-2">{currentMeeting.id && (<button onClick={() => generateMeetingPDF(currentMeeting, clientProfile?.name || activeClientId || currentUser?.client_id || 'INEPAD')} className="border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-amber-400 hover:text-amber-600 px-4 py-2.5 rounded-lg font-bold text-xs uppercase shadow-sm flex items-center gap-2 transition-all"><Download size={15} /> Exportar PDF</button>)}{currentMeeting.id && (<button onClick={() => generateAtaPDF(currentMeeting, clientProfile?.name || activeClientId || currentUser.client_id, clientProfile?.logo_url).catch((e: any) => alert('Erro ao gerar ata: ' + e.message))} className="border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400 px-4 py-2.5 rounded-lg font-bold text-xs uppercase shadow-sm flex items-center gap-2 transition-all"><FileText size={15} /> Gerar Ata</button>)}{canEdit && (<button onClick={saveMeeting} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase shadow-sm flex items-center gap-2 transition-all"><Save size={16} className="text-amber-500" /> Salvar</button>)}</div></div>
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
                                      {p.present !== false && currentMeeting.type === 'Híbrida' && (p.online
                                        ? <span className="inline-flex items-center gap-0.5 text-[8px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded uppercase ml-2 border border-sky-200 not-italic"><Monitor size={9} /> Online</span>
                                        : <span className="inline-flex items-center gap-0.5 text-[8px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded uppercase ml-2 border border-emerald-200 not-italic"><MapPin size={9} /> Presencial</span>)}
                                    </p>
                                    <p className="text-[10px] text-slate-400 italic">{p.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {canEdit && p.present !== false && currentMeeting.type === 'Híbrida' && (
                                    <button
                                      onClick={() => {
                                        const newParts = (currentMeeting.participants || []).map((pt: any, idx: any) => idx === i ? { ...pt, online: !pt.online } : pt);
                                        setCurrentMeeting({ ...currentMeeting, participants: newParts });
                                      }}
                                      className={`p-2 rounded-lg transition-all ${p.online ? 'text-sky-500 hover:bg-sky-100' : 'text-slate-300 hover:text-sky-500 hover:bg-sky-50'}`}
                                      title={p.online ? 'Marcar como presencial' : 'Marcar como online'}
                                    >
                                      {p.online ? <Monitor size={15} /> : <MapPin size={15} />}
                                    </button>
                                  )}
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
                        <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-6 h-fit">
                          <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-50 pb-4">Logística</h3>
                          <div className="space-y-4">
                            <div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Data</label><input type="date" value={currentMeeting.date || ''} className="w-full p-3 border rounded-lg text-sm font-bold" onChange={e => setCurrentMeeting({ ...currentMeeting, date: e.target.value })} readOnly={!canEdit} /></div>
                            <div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Horário</label><input type="time" value={currentMeeting.time || ''} className="w-full p-3 border rounded-lg text-sm font-bold" onChange={e => setCurrentMeeting({ ...currentMeeting, time: e.target.value })} readOnly={!canEdit} /></div>
                            <div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Tipo</label><select value={currentMeeting.type || 'Híbrida'} className="w-full p-3 border rounded-lg text-sm font-bold bg-white outline-none" onChange={e => { const t = e.target.value; setCurrentMeeting({ ...currentMeeting, type: t, link: t === 'Presencial' ? '' : currentMeeting.link, address: t === 'Online' ? '' : currentMeeting.address }); }} disabled={!canEdit}><option>Híbrida</option><option>Presencial</option><option>Online</option></select></div>
                            {(currentMeeting.type === 'Online' || currentMeeting.type === 'Híbrida') && (
                              <div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Link da reunião</label><input type="text" value={currentMeeting.link || ''} placeholder="https://meet..." className="w-full p-3 border rounded-lg text-sm font-bold" onChange={e => setCurrentMeeting({ ...currentMeeting, link: e.target.value })} readOnly={!canEdit} /></div>
                            )}
                            {(currentMeeting.type === 'Presencial' || currentMeeting.type === 'Híbrida') && (
                              <div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Endereço</label><input type="text" value={currentMeeting.address || ''} placeholder="Local da reunião" className="w-full p-3 border rounded-lg text-sm font-bold" onChange={e => setCurrentMeeting({ ...currentMeeting, address: e.target.value })} readOnly={!canEdit} /></div>
                            )}
                          </div>
                        </div>
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
                        {canEdit && (currentMeeting.pautas || []).length > 0 && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/60 border border-amber-200 rounded-xl px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-amber-800 uppercase tracking-widest flex items-center gap-1.5"><Sparkles size={13} /> Rascunhar discussões com IA</p>
                              <p className="text-[11px] text-amber-700/80 mt-0.5 leading-snug">Envie a transcrição gerada pelo Teams ou Meet (.vtt ou .txt). A IA preenche a discussão de cada item — você revisa e salva.</p>
                            </div>
                            <button
                              onClick={() => transcriptRef.current?.click()}
                              disabled={draftingMinutes}
                              className="shrink-0 bg-slate-900 hover:bg-slate-800 text-amber-500 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
                            >
                              {draftingMinutes ? 'Analisando…' : <><Upload size={14} /> Enviar transcrição</>}
                            </button>
                          </div>
                        )}
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
                              <div className="px-4 pb-3 border-t border-slate-50 bg-white" onClick={e => e.stopPropagation()}>
                                  {canEdit && editingObsKey === `pauta-notes-${i}` ? (
                                    <>
                                    <textarea
                                      autoFocus
                                      rows={3}
                                      className="mt-2 w-full text-[10px] text-slate-700 bg-white border border-slate-200 rounded-lg p-2 outline-none resize-none font-normal not-italic focus:border-amber-400 focus:ring-1 focus:ring-amber-100"
                                      value={obsInputValue}
                                      onChange={e => { setObsInputValue(e.target.value); setNoteAutoSaved(false); }}
                                      onBlur={async () => {
                                        const newPautas = [...(currentMeeting.pautas || [])];
                                        newPautas[i] = { ...newPautas[i], notes: obsInputValue };
                                        const updated = { ...currentMeeting, pautas: newPautas };
                                        setCurrentMeeting(updated);
                                        setEditingObsKey(null);
                                        // Salva automaticamente ao concluir a nota (persiste no banco)
                                        if (currentMeeting.id) {
                                          try { await supabase.from('meetings').update({ pautas: newPautas }).eq('id', currentMeeting.id); setMeetings(prev => prev.map(m => m.id === currentMeeting.id ? updated : m)); } catch { /* salva no próximo */ }
                                        }
                                      }}
                                      onKeyDown={e => { if (e.key === 'Escape') setEditingObsKey(null); }}
                                      placeholder="Registre os pontos discutidos nesta pauta..."
                                    />
                                    {isSessionActive && <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-slate-300">{noteAutoSaved ? <span className="text-emerald-500">✓ Salvo automaticamente</span> : 'Salva automaticamente enquanto você digita…'}</p>}
                                    </>
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
                        <div className="flex justify-between items-center mb-4 gap-2 flex-wrap"><h3 className="text-xs font-bold uppercase text-slate-600 tracking-widest flex items-center gap-2">Documentos <span className="bg-red-50 text-red-500 text-[8px] px-2 py-0.5 rounded-full border border-red-100">Somente Internos</span>{(currentMeeting.atas || []).length > 0 && <span className="bg-slate-100 text-slate-500 text-[8px] px-2 py-0.5 rounded-full border border-slate-200 inline-flex items-center gap-1"><Lock size={9} /> Bloqueado após a ata</span>}</h3>{canEdit && (currentMeeting.atas || []).length === 0 && <div className="flex items-center gap-2">{(currentMeeting.materiais || []).length > 0 && <button onClick={notifyMaterials} disabled={notifyingMaterials} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"><Bell size={14} /> {notifyingMaterials ? 'Enviando...' : 'Notificar participantes'}</button>}<button onClick={() => fileRef.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all"><Upload size={14} /> Upload</button></div>}</div>
                        {(currentMeeting.materiais || []).length === 0 ? <p className="text-[11px] text-slate-400 italic">Nenhum material anexado.</p> : <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{(currentMeeting.materiais || []).map((m: any, i: any) => (<div key={i} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center gap-3 relative group"><FileText size={20} className="text-amber-600" /><div className="flex-1 truncate text-xs font-bold italic">{m.name}</div><a href={m.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-amber-600" title="Abrir"><ExternalLink size={14} /></a>{canEdit && (currentMeeting.atas || []).length === 0 && <button onClick={() => deleteMaterial(i)} className="text-slate-300 hover:text-red-600 transition-colors" title="Excluir material"><Trash2 size={14} /></button>}</div>))}</div>}
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
                                    {canEdit && currentMeeting.id && voters.length > 0 && <button onClick={e => { e.stopPropagation(); sendVoteInvitationsCore(currentMeeting.id, { delibIndex: i }); }} disabled={sendingVoteInvites} className="p-1.5 text-slate-300 hover:text-amber-600 transition-colors rounded-lg hover:bg-amber-50 disabled:opacity-50" title="Convidar votantes por e-mail"><Mail size={15} /></button>}
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
                                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                    <select value={a.priority || 'Média'} onChange={e => setCurrentMeeting({ ...currentMeeting, acoes: (currentMeeting.acoes || []).map((ac: any, idx: any) => idx === i ? { ...ac, priority: e.target.value } : ac) })} className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase cursor-pointer border not-italic ${PRIORITY_STYLES[a.priority || 'Média']}`} disabled={!canEdit}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select>
                                    {canEdit && <button onClick={() => setCurrentMeeting({ ...currentMeeting, acoes: (currentMeeting.acoes || []).filter((_: any, idx: any) => idx !== i) })} className="shrink-0"><Trash2 size={18} className="text-slate-200 hover:text-red-500" /></button>}
                                  </div>
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
                            <div className="sm:col-span-4"><label className="text-[10px] font-bold text-slate-400 uppercase">Ação</label><input placeholder="Título" className="w-full p-3 border rounded-lg text-sm bg-white font-bold italic" value={tmpAcao.title} onChange={e => setTmpAcao({ ...tmpAcao, title: e.target.value })} /></div>
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
                            <div className="sm:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase">Prazo</label><input type="date" className="w-full p-3 border rounded-lg text-sm bg-white font-bold" value={tmpAcao.date} onChange={e => setTmpAcao({ ...tmpAcao, date: e.target.value })} /></div>
                            <div className="sm:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase">Prioridade</label><select className={`w-full p-3 border rounded-lg text-sm font-bold outline-none ${PRIORITY_STYLES[tmpAcao.priority || 'Média']}`} value={tmpAcao.priority} onChange={e => setTmpAcao({ ...tmpAcao, priority: e.target.value })}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                            <div className="sm:col-span-12"><label className="text-[10px] font-bold text-slate-400 uppercase">Observação (opcional)</label><input placeholder="Contexto ou detalhes da ação..." className="w-full p-3 border rounded-lg text-sm bg-white font-normal italic mt-1" value={tmpAcao.obs} onChange={e => setTmpAcao({ ...tmpAcao, obs: e.target.value })} /></div>
                            <div className="sm:col-span-12"><button onClick={() => { if (tmpAcao.title) { setCurrentMeeting({ ...currentMeeting, acoes: [...(currentMeeting.acoes || []), { ...tmpAcao, resp: tmpAcao.resps[0] || '', id: Date.now() }] }); setTmpAcao({ title: '', resps: [], resp: '', date: '', status: 'Pendente', obs: '', priority: 'Média' }); } }} className="w-full p-3 bg-emerald-600 text-white rounded-lg flex items-center justify-center shadow-md font-bold uppercase text-[10px] tracking-widest"><Plus size={18} className="mr-2" /> Adicionar Iniciativa</button></div>
                          </div>
                        )}
                      </div>
                    )}

                                        {tab === 'atas' && (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in space-y-8"><div className="flex justify-between items-center border-b border-slate-50 pb-4"><h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest">Atas Finais</h3>{canEdit && <button onClick={() => ataRef.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all"><Upload size={14} /> Carregar</button>}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{(currentMeeting.atas || []).map((ata: any, i: any) => (
  <div key={i} className="bg-white border border-slate-200 rounded-xl overflow-hidden group font-bold italic hover:border-amber-200 transition-all">
    <div className="p-4 flex items-center gap-3">
      <div className="p-3 bg-amber-50 text-amber-600 rounded-lg shrink-0"><FileCheck size={22} /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{ata.name}</p>
        {ata.clicksign_status === 'signed' && <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full mt-1 not-italic"><ShieldCheck size={9} /> Assinada Digitalmente</span>}
        {ata.clicksign_status === 'pending' && <span className="inline-flex items-center gap-1 text-[9px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full mt-1 not-italic"><Clock size={9} /> Aguardando Assinaturas</span>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => openAtaUrl(ata.clicksign_status === 'signed' && ata.clicksign_signed_url ? ata.clicksign_signed_url : ata.url)} className="text-slate-300 hover:text-amber-600 transition-colors" title="Abrir"><ExternalLink size={17} /></button>
        {isAdm && <button onClick={() => handleDeleteAta(currentMeeting.id, i, ata.name)} className="text-slate-200 hover:text-red-500 transition-colors" title="Excluir ata"><Trash2 size={16} /></button>}
      </div>
    </div>
    {clientProfile?.clicksign_enabled && canEdit && !ata.clicksign_key && (
      <div className="px-4 pb-4 border-t border-slate-50 pt-3">
        <button disabled={clicksignLoading} onClick={() => handleSendToClickSign(i)} className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm disabled:opacity-50">
          <PenLine size={13} /> {clicksignLoading ? 'Enviando...' : 'Enviar para Assinatura Digital'}
        </button>
      </div>
    )}
    {ata.clicksign_status === 'pending' && canEdit && (
      <div className="px-4 pb-4 border-t border-slate-50 pt-3">
        <button disabled={clicksignLoading} onClick={() => handleCheckSignature(i)} className="w-full flex items-center justify-center gap-2 py-2 border border-amber-200 text-amber-600 hover:bg-amber-50 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50">
          <ShieldCheck size={13} /> {clicksignLoading ? 'Verificando...' : 'Verificar Status da Assinatura'}
        </button>
      </div>
    )}
  </div>
))}</div></div>
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
                              {ata.clicksign_status === 'signed' && <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full mt-1.5 font-bold not-italic"><ShieldCheck size={9} /> Assinada Digitalmente</span>}
                              {ata.clicksign_status === 'pending' && <span className="inline-flex items-center gap-1 text-[9px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full mt-1.5 font-bold not-italic"><Clock size={9} /> Aguardando Assinaturas</span>}
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
                              onClick={() => downloadAtaWatermarked(ata)}
                              disabled={downloadingAta}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm disabled:opacity-60"
                              title="Baixar com marca d'água (nome, e-mail, data e hora)"
                            >
                              <Download size={13} /> {downloadingAta ? 'Baixando...' : 'Baixar'}
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
                            {isAdm && (
                              <button
                                onClick={() => {
                                  const m = meetings.find((m: any) => m.id === ata.meetingId);
                                  if (!m) return;
                                  const ataIdx = (m.atas || []).findIndex((a: any) => a.url === ata.url);
                                  if (ataIdx !== -1) handleDeleteAta(ata.meetingId, ataIdx, ata.name);
                                }}
                                className="px-3 py-2.5 border border-red-100 hover:border-red-300 hover:text-red-600 text-red-300 rounded-lg text-[10px] transition-all"
                                title="Excluir ata"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
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
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200"><Target size={14} className="text-amber-500" /><select className="text-[10px] font-bold uppercase outline-none bg-transparent cursor-pointer text-slate-600" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="all">Status</option><option value="Pendente">Pendente</option><option value="Em andamento">Em andamento</option><option value="Concluída">Concluída</option><option value="Atrasada">Atrasada</option></select></div>
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200"><AlertCircle size={14} className="text-amber-500" /><select className="text-[10px] font-bold uppercase outline-none bg-transparent cursor-pointer text-slate-600" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}><option value="all">Prioridade</option>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200"><Building2 size={14} className="text-amber-500" /><select className="text-[10px] font-bold uppercase outline-none bg-transparent cursor-pointer text-slate-600" value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)}><option value="all">Origem (Reunião)</option>{meetings.map(m => <option key={m.id} value={m.id}>{m.title}{m.date ? ` — ${new Date(m.date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</option>)}</select></div>
                      {strategyEnabled && <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200"><Compass size={14} className="text-amber-500" /><select className="text-[10px] font-bold uppercase outline-none bg-transparent cursor-pointer text-slate-600" value={filterObjective} onChange={e => setFilterObjective(e.target.value)}><option value="all">Objetivo estratégico</option><option value="with">✓ Vinculadas a objetivo</option><option value="none">✕ Sem objetivo</option>{strategyObjectives.length > 0 && <option disabled>──────────</option>}{strategyObjectives.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="flex bg-slate-100 rounded-lg p-1">
                      {(['tabela', 'kanban'] as const).map(v => <button key={v} onClick={() => setPlanoView(v)} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${planoView === v ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{v === 'tabela' ? 'Tabela' : 'Kanban'}</button>)}
                    </div>
                  </div>

                  {planoView === 'tabela' ? (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[1100px] font-bold italic">
                      <thead className="bg-slate-900 text-[10px] font-bold uppercase text-amber-500 tracking-widest">
                        <tr><th className="px-6 py-4">Iniciativa</th><th className="px-5 py-4">Responsável(is)</th><th className="px-6 py-4">Origem</th><th className="px-6 py-4">Prazo</th><th className="px-6 py-4 text-center">Prioridade</th><th className="px-6 py-4">Status</th>{canEdit && <th className="px-6 py-4 text-center">Ação</th>}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stats.allActions.length === 0 && (
                          <tr><td colSpan={canEdit ? 7 : 6} className="px-6 py-10 text-center text-slate-400 text-[10px] uppercase tracking-widest">Nenhuma ação registrada</td></tr>
                        )}
                        {stats.allActions.map((acao: any) => {
                          const acaoKey = `${acao.mId}-${acao.id}`;
                          const resps: string[] = acao.resps?.length > 0 ? acao.resps : (acao.resp ? [acao.resp] : []);
                          return (
                            <tr key={acaoKey} className="hover:bg-slate-50 transition-all align-top">
                              {/* INICIATIVA + OBS INLINE */}
                              <td className="px-6 py-4 text-slate-800 max-w-xs">
                                <p className="leading-snug">{acao.title}</p>
                                {acao.objective_id && objectiveName(acao.objective_id) && <span className="mt-1 inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 not-italic"><Compass size={9} /> {objectiveName(acao.objective_id)}</span>}
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

                              <td className="px-6 py-4">
                                <p className="text-slate-500 text-[10px] uppercase tracking-widest leading-snug">{acao.mTitle}</p>
                                {acao.mDate && <p className="text-[10px] text-slate-400 font-normal not-italic mt-1 flex items-center gap-1"><Calendar size={11} className="text-amber-500" />{new Date(acao.mDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}
                              </td>
                              <td className="px-6 py-4"><input type="date" className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-600" value={acao.date || ''} onChange={e => updateActionDateGlobal(acao.mId, acao.id, e.target.value)} disabled={!canEdit} /></td>
                              <td className="px-6 py-4 text-center"><select value={acao.priority || 'Média'} onChange={e => updateActionPriorityGlobal(acao.mId, acao.id, e.target.value)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase cursor-pointer border ${PRIORITY_STYLES[acao.priority || 'Média']}`} disabled={!canEdit}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></td>
                              <td className="px-6 py-4 text-center"><select value={acao.status} onChange={e => updateActionStatusGlobal(acao.mId, acao.id, e.target.value)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-amber-50 text-amber-700 cursor-pointer" disabled={!canEdit}><option value="Pendente">Aguardando</option><option value="Em andamento">Execução</option><option value="Concluída">Finalizado</option></select></td>
                              {canEdit && <td className="px-6 py-4 text-center"><div className="flex items-center justify-center gap-2"><button onClick={() => openActionModal(acao)} className="text-slate-300 hover:text-amber-600 transition-colors" title="Detalhes 5W2H"><PenLine size={15} /></button><button onClick={() => deleteActionGlobal(acao.mId, acao.id)} className="text-slate-200 hover:text-red-600 transition-colors" title="Excluir"><Trash2 size={16} /></button></div></td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {([['Pendente', 'Aguardando'], ['Em andamento', 'Execução'], ['Concluída', 'Finalizado']] as [string, string][]).map(([st, lbl]) => {
                        const cards = stats.allActions.filter((a: any) => a.status === st);
                        return (
                          <div key={st} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                            <div className="flex items-center justify-between mb-2 px-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{lbl}</span>
                              <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded-full px-2">{cards.length}</span>
                            </div>
                            <div className="space-y-2">
                              {cards.length === 0 ? <p className="text-[11px] text-slate-300 italic px-1 py-4 text-center">—</p> : cards.map((acao: any) => {
                                const resps: string[] = acao.resps?.length > 0 ? acao.resps : (acao.resp ? [acao.resp] : []);
                                const stIdx = ['Pendente', 'Em andamento', 'Concluída'].indexOf(acao.status);
                                return (
                                  <div key={`${acao.mId}-${acao.id}`} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                                    <p className="text-sm font-bold italic text-slate-800 leading-snug">{acao.title}</p>
                                    {acao.objective_id && objectiveName(acao.objective_id) && <span className="mt-1 inline-flex items-center gap-1 text-[8px] font-bold uppercase text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5"><Compass size={9} />{objectiveName(acao.objective_id)}</span>}
                                    <div className="flex items-center justify-between mt-2 gap-2">
                                      <div className="flex flex-wrap gap-1 items-center">
                                        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[acao.priority || 'Média']}`}>{acao.priority || 'Média'}</span>
                                        {resps.slice(0, 2).map((r: string) => <span key={r} className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{r}</span>)}
                                      </div>
                                      {canEdit && (
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button disabled={stIdx <= 0} onClick={() => updateActionStatusGlobal(acao.mId, acao.id, ['Pendente', 'Em andamento', 'Concluída'][stIdx - 1])} className="text-slate-300 hover:text-amber-600 disabled:opacity-20" title="Voltar"><ChevronLeft size={15} /></button>
                                          <button onClick={() => openActionModal(acao)} className="text-slate-300 hover:text-amber-600" title="Detalhes 5W2H"><PenLine size={12} /></button>
                                          <button disabled={stIdx >= 2} onClick={() => updateActionStatusGlobal(acao.mId, acao.id, ['Pendente', 'Em andamento', 'Concluída'][stIdx + 1])} className="text-slate-300 hover:text-amber-600 disabled:opacity-20" title="Avançar"><ChevronRight size={15} /></button>
                                        </div>
                                      )}
                                    </div>
                                    {acao.date && <p className="text-[9px] text-slate-400 mt-1.5 flex items-center gap-1"><Calendar size={9} />{new Date(acao.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

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
                            {meetings.map(m => <option key={m.id} value={m.id}>{m.title}{m.date ? ` — ${new Date(m.date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</option>)}
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
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Prioridade</label>
                          <select className={`w-full p-3 border rounded-lg text-sm font-bold outline-none transition-colors ${PRIORITY_STYLES[tmpGlobalAcao.priority || 'Média']}`} value={tmpGlobalAcao.priority} onChange={e => setTmpGlobalAcao({ ...tmpGlobalAcao, priority: e.target.value })}>
                            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div className="sm:col-span-6 space-y-1">
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

              {/* ==================== ACOMPANHAMENTO DE DELIBERAÇÕES ==================== */}
              {activeMenu === 'deliberacoes' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-2"><Scale size={22} className="text-amber-600" /> Deliberações</h1>
                      {canEdit && <button onClick={openExtraDelibModal} className="bg-slate-900 hover:bg-slate-800 text-amber-500 px-4 py-2 rounded-lg font-bold text-[10px] uppercase flex items-center gap-2 transition-all shadow-md tracking-widest"><Plus size={14} /> Deliberação Extraordinária</button>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200 w-full md:w-auto">
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200"><Filter size={14} className="text-amber-500" /><select className="text-[10px] font-bold uppercase outline-none bg-transparent cursor-pointer text-slate-600" value={delibFilterResult} onChange={e => setDelibFilterResult(e.target.value)}><option value="all">Resultado</option><option value="APROVADA">Aprovada</option><option value="REJEITADA">Rejeitada</option><option value="EM VOTAÇÃO">Em votação</option><option value="EMPATE">Empate</option><option value="SEM VOTANTES">Sem votantes</option></select></div>
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200"><Building2 size={14} className="text-amber-500" /><select className="text-[10px] font-bold uppercase outline-none bg-transparent cursor-pointer text-slate-600" value={delibFilterOrigin} onChange={e => setDelibFilterOrigin(e.target.value)}><option value="all">Origem (Reunião)</option>{meetings.map(m => <option key={m.id} value={m.id}>{m.title}{m.date ? ` — ${new Date(m.date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</option>)}</select></div>
                    </div>
                  </div>

                  {/* KPIs clicáveis (filtram por resultado) */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { l: 'Total', v: delibStats.total, f: 'all', c: 'slate', i: <Scale /> },
                      { l: 'Aprovadas', v: delibStats.aprovadas, f: 'APROVADA', c: 'emerald', i: <ThumbsUp /> },
                      { l: 'Rejeitadas', v: delibStats.rejeitadas, f: 'REJEITADA', c: 'red', i: <ThumbsDown /> },
                      { l: 'Em Votação', v: delibStats.emVotacao, f: 'EM VOTAÇÃO', c: 'amber', i: <Clock /> },
                    ].map((k, idx) => (
                      <button key={idx} onClick={() => setDelibFilterResult(k.f)} className={`group bg-white p-5 rounded-xl border shadow-sm flex items-center gap-4 text-left transition-all hover:shadow-md ${delibFilterResult === k.f ? 'border-amber-400 ring-1 ring-amber-200' : 'border-slate-200 hover:border-amber-300'}`}>
                        <div className={`p-3 rounded-lg ${k.c === 'emerald' ? 'bg-emerald-100 text-emerald-600' : k.c === 'red' ? 'bg-red-100 text-red-600' : k.c === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{k.i}</div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{k.l}</p><p className="text-2xl font-bold text-slate-800 mt-0.5">{k.v}</p></div>
                      </button>
                    ))}
                  </div>

                  {/* Tabela consolidada */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[900px] font-bold italic">
                      <thead className="bg-slate-900 text-[10px] font-bold uppercase text-amber-500 tracking-widest">
                        <tr><th className="px-6 py-4">Deliberação</th><th className="px-6 py-4">Origem</th><th className="px-6 py-4 text-center">Votação</th><th className="px-6 py-4 text-center">Resultado</th><th className="px-6 py-4 text-center">Abrir</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {delibStats.list.length === 0 ? (
                          <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-[10px] uppercase tracking-widest">Nenhuma deliberação encontrada</td></tr>
                        ) : delibStats.list.map((d: any) => {
                          const meeting = meetings.find((m: any) => m.id === d.mId);
                          return (
                            <tr key={`${d.mId}-${d.idx}`} className="hover:bg-slate-50 transition-all align-top">
                              <td className="px-6 py-4 text-slate-800 max-w-md"><p className="leading-snug">"{d.title}"</p></td>
                              <td className="px-6 py-4 text-[10px] uppercase tracking-widest">
                                {d.extra
                                  ? <span className="inline-flex items-center gap-1 bg-slate-900 text-amber-400 px-2 py-0.5 rounded-full not-italic font-bold"><Scale size={10} /> Extraordinária</span>
                                  : <><span className="text-slate-400">{d.mTitle}</span><br /><span className="text-slate-300 normal-case">{d.mDate || ''}</span></>}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-1.5 flex-wrap not-italic">
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-100"><ThumbsUp size={9} />{d.favor}</span>
                                  <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-red-100"><ThumbsDown size={9} />{d.contra}</span>
                                  <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded-full border border-slate-200"><MinusCircle size={9} />{d.abst}</span>
                                </div>
                                <p className="text-[9px] text-slate-400 text-center mt-1 not-italic">{d.voted}/{d.total} votaram</p>
                              </td>
                              <td className="px-6 py-4 text-center"><span className={`px-3 py-1 rounded-full text-[9px] uppercase font-bold ${d.cls}`}>{d.label}</span></td>
                              <td className="px-6 py-4 text-center">
                                {d.extra ? (
                                  <button onClick={() => setVotingDelibId(d.delibId)} className="bg-slate-900 hover:bg-slate-800 text-amber-500 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase inline-flex items-center gap-1 transition-all" title="Abrir votação"><ThumbsUp size={11} /> Votar</button>
                                ) : (
                                  <button onClick={() => { if (meeting) { setCurrentMeeting(meeting); setView('details'); setTab('delib'); setActiveMenu('reunioes'); } }} className="text-slate-300 hover:text-amber-600 transition-colors inline-flex" title="Abrir na reunião"><ExternalLink size={16} /></button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Controller em cliente sem o add-on de Planejamento Estratégico */}
              {activeMenu === 'indicadores' && isController && !strategyEnabled && (
                <div className="max-w-lg mx-auto mt-16 text-center bg-white p-10 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in">
                  <Gauge size={32} className="text-slate-200 mx-auto mb-3" />
                  <h2 className="text-lg font-bold text-slate-800 italic">Módulo de Indicadores indisponível</h2>
                  <p className="text-sm text-slate-500 mt-2">O add-on de Planejamento Estratégico não está ativo para esta empresa. Fale com a administração para liberar o acesso.</p>
                </div>
              )}

              {/* ==================== INDICADORES & GATILHOS (SEMÁFOROS) ==================== */}
              {activeMenu === 'indicadores' && !detailInd && strategyEnabled && (
                <div className="space-y-8 animate-in fade-in">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-2"><Gauge size={24} className="text-amber-600" /> Indicadores & Gatilhos</h1>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Semáforos de governança • {clientProfile?.name || activeClientId || currentUser.client_id}</p>
                    </div>
                    {canLancar && (
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button onClick={openBatch} className="bg-slate-900 hover:bg-slate-800 text-amber-500 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-all shadow-sm"><PenLine size={15} /> Lançar mês</button>
                        {canEdit && <button onClick={openYearMetas} className="border border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-600 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-all"><Target size={15} /> Metas do ano</button>}
                        <button onClick={openImport} className="border border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-600 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-all"><Upload size={15} /> Importar</button>
                        {canEdit && <button onClick={openCollect} className="border border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-600 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-all"><ExternalLink size={15} /> Link de coleta</button>}
                        {canEdit && <button onClick={() => openIndModal()} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-all shadow-sm"><Plus size={16} /> Novo indicador</button>}
                      </div>
                    )}
                  </div>

                  {/* Configuração: reavaliação agendada */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-x-8 gap-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Timer size={13} className="text-slate-400" /> Reavaliação automática</span>
                      {canEdit ? (
                        <select value={govSettings.reeval_frequency || 'weekly'} onChange={e => saveGovSetting({ reeval_frequency: e.target.value })} className="text-xs font-bold uppercase tracking-wider bg-slate-50 border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 outline-none cursor-pointer">
                          {FREQ_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : <span className="text-xs font-bold uppercase tracking-wider bg-slate-50 border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5">{(FREQ_OPTS.find(([v]) => v === (govSettings.reeval_frequency || 'weekly')) || ['', '—'])[1]}</span>}
                    </div>
                    <p className="text-[10px] text-slate-400 flex-1 min-w-[180px]">O semáforo e os alertas seguem a <b>meta</b> de cada mês. A reavaliação reverifica as metas periodicamente e lembra dos alertas em aberto.</p>
                  </div>

                  {/* Alertas abertos */}
                  <section>
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2"><Bell size={16} className="text-amber-600" /> Alertas abertos ({openTriggerEvents.length})</h2>
                    {openTriggerEvents.length === 0 ? (
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-sm text-slate-500 flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-500" /> Nenhum gatilho em aberto. Tudo no alvo.</div>
                    ) : (
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                        {openTriggerEvents.map((e: any) => {
                          const crit = e.severity === 'critical';
                          const ind = e.indicators?.name || e.triggers?.indicators?.name || 'Indicador';
                          const unit = e.indicators?.unit || e.triggers?.indicators?.unit || '';
                          const trig = e.source === 'meta' ? 'Meta não atingida' : (e.triggers?.name || '');
                          return (
                            <div key={e.id} className="flex items-center justify-between gap-3 p-4">
                              <div className="flex items-start gap-3 min-w-0">
                                <span className={`mt-1 h-3 w-3 rounded-full shrink-0 ${crit ? 'bg-red-600' : 'bg-amber-500'}`} />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-800 italic truncate">{ind} {trig ? <span className="font-normal text-slate-500">— {trig}</span> : null}</p>
                                  <p className="text-[11px] text-slate-500">Valor observado <b>{e.observed_value}{unit ? ' ' + unit : ''}</b> · {new Date(e.fired_at).toLocaleDateString('pt-BR')} · <span className={crit ? 'text-red-600 font-bold' : 'text-amber-600 font-bold'}>{crit ? 'Crítico' : 'Atenção'}</span></p>
                                </div>
                              </div>
                              {canEdit && (
                                <button onClick={() => resolveTriggerEvent(e.id)} className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all inline-flex items-center gap-1"><Check size={12} /> Resolver</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Cards de indicadores (semáforo) */}
                  <section>
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                      <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Indicadores monitorados ({indicatorStatuses.length})</h2>
                      {indicatorStatuses.length > 0 && (
                        <div className="flex bg-slate-100 rounded-lg p-1">
                          {(['cards', 'grid'] as const).map(v => <button key={v} onClick={() => setFarolView(v)} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${farolView === v ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{v === 'cards' ? 'Cartões' : 'Farol'}</button>)}
                        </div>
                      )}
                    </div>
                    {indicatorStatuses.length === 0 ? (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
                        <Gauge size={32} className="text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Nenhum indicador cadastrado ainda para este cliente.</p>
                        <p className="text-[11px] text-slate-400 mt-1">O cadastro de indicadores e gatilhos será habilitado na próxima etapa.</p>
                      </div>
                    ) : farolView === 'grid' ? (
                      (() => {
                        const months: string[] = [];
                        const now = new Date();
                        for (let i = 5; i >= 0; i--) { const dt = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`); }
                        const rMap: Record<string, number> = {};
                        readingsList.forEach((r: any) => { rMap[`${r.indicator_id}|${String(r.period).slice(0, 7)}`] = Number(r.value); });
                        const tMap: Record<string, number> = {};
                        targetsList.forEach((t: any) => { tMap[`${t.indicator_id}|${String(t.period).slice(0, 7)}`] = Number(t.target_value); });
                        const cellColor = (ind: any, v: any, t: any) => {
                          if (v === undefined) return 'none';
                          if (t === undefined) return 'neutral';
                          const higher = ind.direction !== 'lower_is_better';
                          const ach = higher ? (t === 0 ? (v >= 0 ? 1 : 0) : v / t) : (v === 0 ? 2 : t / v);
                          return ach >= 1 ? 'g' : ach >= 0.8 ? 'y' : 'r';
                        };
                        const fmtM = (m: string) => new Date(m + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
                        return (
                          <div>
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                              <table className="w-full text-xs border-collapse">
                                <thead><tr>
                                  <th className="text-left px-3 py-2 bg-slate-50 text-[9px] font-bold uppercase tracking-widest text-slate-400 sticky left-0 z-10">Indicador</th>
                                  {months.map(m => <th key={m} className="px-2 py-2 bg-slate-50 text-[9px] font-bold uppercase tracking-widest text-slate-400 text-center whitespace-nowrap">{fmtM(m)}</th>)}
                                </tr></thead>
                                <tbody>
                                  {indicatorsList.map((ind: any) => (
                                    <tr key={ind.id} className="border-t border-slate-100">
                                      <td className="px-3 py-2 font-bold text-slate-800 italic whitespace-nowrap sticky left-0 bg-white">{ind.name}{ind.unit ? <span className="text-[10px] font-normal text-slate-400"> ({ind.unit})</span> : null}</td>
                                      {months.map(m => {
                                        const v = rMap[`${ind.id}|${m}`]; const t = tMap[`${ind.id}|${m}`]; const c = cellColor(ind, v, t);
                                        const bg = c === 'g' ? 'bg-emerald-500 text-white' : c === 'y' ? 'bg-amber-500 text-white' : c === 'r' ? 'bg-red-600 text-white' : c === 'neutral' ? 'bg-slate-100 text-slate-600' : 'text-slate-300';
                                        return <td key={m} className="px-1 py-1 text-center"><span className={`inline-block min-w-[40px] rounded px-1.5 py-1 font-bold ${bg}`} title={t !== undefined ? `Meta: ${t}` : 'Sem meta definida'}>{v === undefined ? '—' : v}</span></td>;
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">Cor = realizado × meta do mês (🟢 ≥100% · 🟡 ≥80% · 🔴 &lt;80%, conforme a direção do indicador). Cinza = sem meta. Defina metas em "Lançar mês".</p>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {indicatorStatuses.map((s: any) => {
                          // Meta da competência atual + farol realizado × meta
                          const curTarget = targetsList.find((x: any) => x.indicator_id === s.indicator_id && String(x.period).slice(0, 7) === String(s.current_period || '').slice(0, 7));
                          const curMeta = curTarget ? Number(curTarget.target_value) : null;
                          let metaLvl = 0;
                          if (curMeta !== null && s.current_value != null) {
                            const higher = s.direction !== 'lower_is_better';
                            const v = Number(s.current_value), t = curMeta;
                            const ach = higher ? (t === 0 ? (v >= 0 ? 1 : 0) : v / t) : (v === 0 ? 2 : t / v);
                            metaLvl = ach >= 1 ? 0 : ach >= 0.8 ? 1 : 2;
                          }
                          // Semáforo do cartão vem da view (realizado × meta)
                          const lvl = s.breach_level || 0;
                          const dot = lvl === 2 ? 'bg-red-600' : lvl === 1 ? 'bg-amber-500' : 'bg-emerald-500';
                          const ring = lvl === 2 ? 'ring-red-200' : lvl === 1 ? 'ring-amber-200' : 'ring-emerald-200';
                          const label = lvl === 2 ? 'Crítico' : lvl === 1 ? 'Atenção' : 'No alvo';
                          return (
                            <div key={s.indicator_id} onClick={() => setDetailInd(s)} className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 cursor-pointer hover:shadow-md transition-all ${ring}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h3 className="text-sm font-bold text-slate-800 italic truncate">{s.name}</h3>
                                  {s.category && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{s.category}</p>}
                                </div>
                                <span className={`h-3 w-3 rounded-full shrink-0 mt-1 ${dot}`} title={label} />
                              </div>
                              <p className="mt-3 text-3xl font-bold text-slate-900">
                                {s.current_value ?? '—'}<span className="ml-1 text-sm font-normal text-slate-400">{s.unit}</span>
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{curMeta !== null ? <>Meta: <b className={metaLvl === 2 ? 'text-red-600' : metaLvl === 1 ? 'text-amber-600' : 'text-emerald-600'}>{curMeta}{s.unit ? ' ' + s.unit : ''}</b></> : 'Sem meta definida'}</p>
                              {(() => {
                                const ser = (indicatorSeries[s.indicator_id] || []).slice(-12);
                                if (ser.length < 2) return null;
                                const stroke = lvl === 2 ? '#dc2626' : lvl === 1 ? '#f59e0b' : '#10b981';
                                return (
                                  <div className="mt-2 h-10 -mx-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <LineChart data={ser} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                                        <XAxis dataKey="period" hide />
                                        <YAxis hide domain={['dataMin', 'dataMax']} />
                                        <Tooltip
                                          contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '4px 8px' }}
                                          labelFormatter={(l: any) => new Date(l + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}
                                          formatter={(v: any) => [`${v}${s.unit ? ' ' + s.unit : ''}`, 'Valor']}
                                        />
                                        <Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} dot={false} isAnimationActive={false} />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                );
                              })()}
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                  {s.direction === 'lower_is_better' ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                                  {s.current_period ? new Date(s.current_period + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) : 'sem leitura'}
                                </span>
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${lvl === 2 ? 'text-red-600' : lvl === 1 ? 'text-amber-600' : 'text-emerald-600'}`}>{label}</span>
                              </div>
                              {canLancar && (
                                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1">
                                  <button onClick={(e) => { e.stopPropagation(); openReadingModal(s); }} className="flex-1 text-[9px] font-bold uppercase tracking-wider text-slate-600 hover:text-amber-600 border border-slate-200 hover:border-amber-300 rounded-lg py-1.5 inline-flex items-center justify-center gap-1 transition-all"><PenLine size={12} /> Leitura</button>
                                  {canEdit && <button onClick={(e) => { e.stopPropagation(); const raw = indicatorsList.find((x: any) => x.id === s.indicator_id); openIndModal(raw || s); }} className="p-2 text-slate-400 hover:text-amber-600 border border-slate-200 hover:border-amber-300 rounded-lg transition-all" title="Editar indicador"><Edit2 size={12} /></button>}
                                  {canEdit && <button onClick={(e) => { e.stopPropagation(); deleteIndicator(s); }} className="p-2 text-slate-300 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg transition-all" title="Excluir indicador"><Trash2 size={12} /></button>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* ==================== DETALHE DO INDICADOR ==================== */}
              {activeMenu === 'indicadores' && detailInd && strategyEnabled && (() => {
                const dStatus = indicatorStatuses.find((x: any) => x.indicator_id === detailInd.indicator_id) || detailInd;
                const lvl = dStatus.breach_level || 0;
                const dot = lvl === 2 ? 'bg-red-600' : lvl === 1 ? 'bg-amber-500' : 'bg-emerald-500';
                const label = lvl === 2 ? 'Crítico' : lvl === 1 ? 'Atenção' : 'No alvo';
                const stroke = lvl === 2 ? '#dc2626' : lvl === 1 ? '#f59e0b' : '#10b981';
                const unit = dStatus.unit || '';
                const series = indicatorSeries[detailInd.indicator_id] || [];
                const rows = readingsList.filter((r: any) => r.indicator_id === detailInd.indicator_id).slice().sort((a: any, b: any) => String(b.period).localeCompare(String(a.period)));
                const tByPeriod: Record<string, number> = {};
                targetsList.filter((t: any) => t.indicator_id === detailInd.indicator_id).forEach((t: any) => { tByPeriod[String(t.period).slice(0, 7)] = Number(t.target_value); });
                const chartData = (series || []).map((pt: any) => ({ ...pt, meta: tByPeriod[String(pt.period).slice(0, 7)] ?? null }));
                const hasMeta = Object.keys(tByPeriod).length > 0;
                const fmtMonth = (p: any) => new Date(p + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' });
                return (
                  <div className="space-y-6 animate-in fade-in">
                    {/* Cabeçalho */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => setDetailInd(null)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600 transition-all shrink-0"><ChevronLeft size={18} /></button>
                        <div className="min-w-0">
                          <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic flex items-center gap-2 truncate"><span className={`h-3 w-3 rounded-full shrink-0 ${dot}`} />{dStatus.name}</h1>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{dStatus.category || 'Indicador'} · <span className={lvl === 2 ? 'text-red-600' : lvl === 1 ? 'text-amber-600' : 'text-emerald-600'}>{label}</span></p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-slate-900 leading-none">{dStatus.current_value ?? '—'}<span className="ml-1 text-sm font-normal text-slate-400">{unit}</span></p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{dStatus.current_period ? fmtMonth(dStatus.current_period) : 'sem leitura'}</p>
                        </div>
                        {canLancar && <button onClick={() => openReadingModal(detailInd)} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-all shadow-sm"><PenLine size={14} /> Registrar leitura</button>}
                      </div>
                    </div>

                    {/* Gráfico grande: realizado × meta */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest italic mb-3 flex items-center gap-2"><BarChart3 size={16} className="text-amber-600" /> Tendência {hasMeta && <span className="text-[9px] text-slate-400 normal-case tracking-normal not-italic">(linha tracejada = meta)</span>}</h3>
                      {series.length < 2 ? (
                        <p className="text-sm text-slate-400 py-10 text-center">Registre ao menos 2 leituras para ver a tendência.</p>
                      ) : (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="period" tickFormatter={fmtMonth} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
                              <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} labelFormatter={(l: any) => new Date(l + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })} formatter={(v: any, n: any) => [`${v}${unit ? ' ' + unit : ''}`, n === 'meta' ? 'Meta' : 'Realizado']} />
                              {hasMeta && <Line type="monotone" dataKey="meta" name="meta" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />}
                              <Line type="monotone" dataKey="value" name="value" stroke={stroke} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Metas por competência */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                          <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest italic flex items-center gap-2"><Target size={16} className="text-amber-600" /> Metas por competência</h3>
                          {canEdit && <button onClick={() => openBatch()} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1"><PenLine size={12} /> Lançar</button>}
                        </div>
                        <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                          {(() => {
                            const mine = targetsList.filter((t: any) => t.indicator_id === detailInd.indicator_id).slice().sort((a: any, b: any) => String(b.period).localeCompare(String(a.period)));
                            if (mine.length === 0) return <p className="text-sm text-slate-400 p-2">Nenhuma meta definida. {canEdit ? 'Use "Lançar" para definir metas por mês.' : ''}</p>;
                            const rMap: Record<string, number> = {}; rows.forEach((r: any) => { rMap[String(r.period).slice(0, 7)] = Number(r.value); });
                            const higher = detailInd.direction !== 'lower_is_better';
                            return mine.map((t: any) => {
                              const p = String(t.period).slice(0, 7); const meta = Number(t.target_value); const real = rMap[p];
                              let c = 'none';
                              if (real !== undefined) { const ach = higher ? (meta === 0 ? 1 : real / meta) : (real === 0 ? 2 : meta / real); c = ach >= 1 ? 'g' : ach >= 0.8 ? 'y' : 'r'; }
                              const dot = c === 'g' ? 'bg-emerald-500' : c === 'y' ? 'bg-amber-500' : c === 'r' ? 'bg-red-600' : 'bg-slate-200';
                              return (
                                <div key={detailInd.indicator_id + p} className="flex items-center justify-between gap-2 border border-slate-100 rounded-lg p-3">
                                  <span className="flex items-center gap-2 text-sm font-bold text-slate-700"><span className={`h-2.5 w-2.5 rounded-full ${dot}`} />{new Date(p + '-01T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}</span>
                                  <span className="flex items-center gap-2 shrink-0">
                                    <span className="text-[12px] text-slate-500">real <b className="text-slate-800">{real === undefined ? '—' : real}</b> · meta <b className="text-slate-800">{meta}</b>{unit ? ` ${unit}` : ''}</span>
                                    {c === 'r' && canEdit && <button onClick={() => openFca(detailInd, p)} className="text-[9px] font-bold uppercase tracking-wider text-amber-600 hover:text-white hover:bg-amber-600 border border-amber-300 rounded px-1.5 py-0.5 transition-all">FCA</button>}
                                  </span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Histórico de leituras */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                          <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest italic flex items-center gap-2"><History size={16} className="text-amber-600" /> Histórico de leituras ({rows.length})</h3>
                        </div>
                        {rows.length === 0 ? (
                          <p className="text-sm text-slate-400 p-4">Nenhuma leitura registrada.</p>
                        ) : (
                          <div className="max-h-72 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50/50 text-[9px] font-bold uppercase tracking-widest text-slate-400 sticky top-0">
                                <tr><th className="px-4 py-2 text-left">Competência</th><th className="px-4 py-2 text-right">Valor</th><th className="px-4 py-2 text-left">Fonte</th>{canEdit && <th className="px-4 py-2 text-center">Ações</th>}</tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {rows.map((r: any) => (
                                  <tr key={r.id} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-2 text-slate-700">{new Date(r.period + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}</td>
                                    <td className="px-4 py-2 text-right font-bold text-slate-800">{r.value}{unit ? ` ${unit}` : ''}</td>
                                    <td className="px-4 py-2 text-slate-400 text-[11px] truncate max-w-[120px]">{r.source || '—'}</td>
                                    {canEdit && (
                                      <td className="px-4 py-2">
                                        <div className="flex items-center justify-center gap-1">
                                          <button onClick={() => openReadingEdit(detailInd, r)} className="p-1.5 text-slate-400 hover:text-amber-600 rounded" title="Editar"><Edit2 size={14} /></button>
                                          <button onClick={() => deleteReading(r)} className="p-1.5 text-slate-300 hover:text-red-600 rounded" title="Excluir"><Trash2 size={14} /></button>
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Análise de Causa — FCA */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest italic flex items-center gap-2"><Search size={16} className="text-amber-600" /> Análise de Causa — FCA ({fcaList.filter((f: any) => f.indicator_id === detailInd.indicator_id).length})</h3>
                        {canEdit && <button onClick={() => openFca(detailInd)} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1"><Plus size={12} /> Nova análise</button>}
                      </div>
                      <div className="p-3 space-y-2">
                        {fcaList.filter((f: any) => f.indicator_id === detailInd.indicator_id).length === 0 ? (
                          <p className="text-sm text-slate-400 p-2">Nenhuma análise. Registre o <b>Fato → Causa → Ação</b> quando um mês não atinge a meta.</p>
                        ) : fcaList.filter((f: any) => f.indicator_id === detailInd.indicator_id).map((f: any) => (
                          <div key={f.id} className="border border-slate-100 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">{f.period ? new Date(f.period + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) : ''}</span>
                              {canEdit && <button onClick={() => deleteFca(f)} className="text-slate-300 hover:text-red-600" title="Excluir análise"><Trash2 size={14} /></button>}
                            </div>
                            <p className="text-[13px] text-slate-700"><b className="text-slate-800">Fato:</b> {f.fact}</p>
                            {f.cause && <p className="text-[13px] text-slate-700"><b className="text-slate-800">Causa:</b> {f.cause}</p>}
                            {f.action_text && <p className="text-[13px] text-slate-700"><b className="text-slate-800">Ação:</b> {f.action_text}{f.action_id ? <span className="text-[10px] text-emerald-600 ml-1">(no Plano de Ação)</span> : null}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ==================== ESTRATÉGIA (módulo componentizado) ==================== */}
              {activeMenu === 'estrategia' && (
                <Estrategia currentUser={currentUser} activeClientId={activeClientId} canEdit={canEdit} addLog={addLog} />
              )}

              {/* ==================== SEÇÃO DE USUÁRIOS ==================== */}
              {activeMenu === 'usuarios' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight italic">
                      {isSuper ? 'Contas de Clientes' : 'Conselheiros'}
                    </h1>
                  </div>

                  {/* PERFIL DA EMPRESA — apenas para Admins não-SuperAdmin */}
                  {isAdm && !isSuper && (
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
                          <p className="mt-2 w-28 text-[9px] text-slate-400 font-normal leading-tight">PNG horizontal, fundo transparente e cor clara (a barra lateral tem fundo escuro). Exibida em altura padrão.</p>
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

                  {/* GESTÃO DE CLIENTES — apenas SuperAdmin */}
                  {isSuper && (
                    <div className="space-y-4">
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-100 pb-4 flex items-center gap-2 mb-4">
                          <Building2 size={16} className="text-amber-600" /> Clientes Cadastrados
                        </h3>
                        {allClientsList.length === 0 ? (
                          <p className="text-sm text-slate-400 italic">Nenhum cliente encontrado.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {allClientsList.map((c: any) => (
                              <button
                                key={c.client_id}
                                onClick={() => selectClientForManagement(c.client_id)}
                                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${managedClientId === c.client_id ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-slate-50 hover:border-amber-300'} ${c.active === false ? 'opacity-60' : ''}`}
                              >
                                <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                                  {c.logo_url
                                    ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-contain p-1" />
                                    : <Building2 size={18} className="text-slate-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate italic">{c.name || c.client_id}</p>
                                  <p className="text-[9px] text-slate-400 uppercase tracking-widest truncate">{c.client_id}</p>
                                  <div className="flex gap-1.5 mt-1 flex-wrap">
                                    {c.active === false && <span className="text-[8px] bg-red-100 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full font-bold">Inativo</span>}
                                    {c.strategy_enabled && <span className="text-[8px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold">Estratégia</span>}
                                    {c.clicksign_enabled && <span className="text-[8px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold">ClickSign</span>}
                                    {!c.name && <span className="text-[8px] bg-slate-100 text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded-full font-bold">Sem perfil</span>}
                                  </div>
                                </div>
                                <ChevronRight size={14} className={`text-slate-300 shrink-0 transition-transform ${managedClientId === c.client_id ? 'rotate-90 text-amber-500' : ''}`} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Cadastrar novo cliente */}
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-100 pb-4 flex items-center gap-2">
                          <Building2 size={16} className="text-amber-600" /> Cadastrar Novo Cliente
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identificador (Client ID)</label>
                            <input type="text" placeholder="Ex: EMPRESA_XYZ" className="w-full p-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 transition-colors" value={newClientForm.client_id} onChange={e => setNewClientForm(p => ({ ...p, client_id: e.target.value.toUpperCase() }))} />
                            <p className="text-[9px] text-slate-400 font-normal">Apenas letras, números e _ (sem espaços/acentos). Não pode ser alterado depois.</p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome da Empresa</label>
                            <input type="text" placeholder="Ex: Empresa XYZ S.A." className="w-full p-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 transition-colors" value={newClientForm.name} onChange={e => setNewClientForm(p => ({ ...p, name: e.target.value }))} />
                          </div>
                        </div>
                        <button onClick={createClient} disabled={creatingClient} className="w-full sm:w-auto px-8 py-3 bg-slate-900 hover:bg-slate-800 text-amber-500 rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50">
                          <Building2 size={16} /> {creatingClient ? 'Criando...' : 'Criar Cliente'}
                        </button>
                        <p className="text-[10px] text-slate-400 font-normal">Após criar, clique no cliente acima para adicionar a logo e o ClickSign, e cadastre o Administrador dele em "Cadastrar Novo Membro".</p>
                      </div>

                      {/* Painel de edição do cliente selecionado */}
                      {managedClientId && (
                        <div className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm space-y-5 animate-in fade-in slide-in-from-top-2">
                          <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-100 pb-4 flex items-center gap-2">
                            <Settings size={16} className="text-amber-600" /> Configurações — {managedClientForm.name || managedClientId}
                          </h3>

                          {/* Perfil */}
                          <div className="flex flex-col sm:flex-row gap-6 items-start">
                            <div className="shrink-0">
                              <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                                {managedClientForm.logo_url
                                  ? <img src={managedClientForm.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                                  : <div className="flex flex-col items-center gap-1 text-slate-300"><Camera size={28} /><span className="text-[9px] font-bold uppercase">Sem logo</span></div>}
                              </div>
                              <input ref={managedLogoRef} type="file" accept="image/*" className="hidden" onChange={handleManagedLogoUpload} />
                              <button onClick={() => managedLogoRef.current?.click()} className="mt-2 w-28 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 border border-slate-200 rounded-lg hover:border-amber-400 hover:text-amber-600 transition-colors flex items-center justify-center gap-1">
                                <Upload size={11} /> Carregar logo
                              </button>
                              <p className="mt-2 w-28 text-[9px] text-slate-400 font-normal leading-tight">PNG horizontal, fundo transparente e cor clara. Exibida em altura padrão.</p>
                            </div>
                            <div className="flex-1 space-y-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome da Empresa</label>
                                <input type="text" placeholder="Ex: RealFlex Indústria S.A." className="w-full p-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 transition-colors" value={managedClientForm.name} onChange={e => setManagedClientForm(p => ({ ...p, name: e.target.value }))} />
                              </div>
                              <button onClick={saveManagedClientProfile} disabled={savingManagedClient} className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-md disabled:opacity-50">
                                <Save size={14} /> {savingManagedClient ? 'Salvando...' : 'Salvar Perfil'}
                              </button>
                            </div>
                          </div>

                          {/* Add-on Planejamento Estratégico */}
                          <div className="border-t border-slate-100 pt-5 space-y-3">
                            <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-2">
                              <Compass size={13} className="text-amber-600" /> Add-on: Planejamento Estratégico
                            </h4>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                              <div>
                                <p className="text-sm font-bold text-slate-800 italic">Estratégia + Indicadores — {managedClientForm.name || managedClientId}</p>
                                <p className="text-[10px] text-slate-400 font-normal not-italic mt-0.5">Libera os menus Estratégia (BSC/OKR/SWOT) e Indicadores (semáforos, metas, faróis)</p>
                              </div>
                              <button onClick={toggleManagedStrategy} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${managedClientProfile?.strategy_enabled ? 'bg-amber-600' : 'bg-slate-200'}`}>
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${managedClientProfile?.strategy_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                            </div>
                            {managedClientProfile?.strategy_enabled
                              ? <p className="text-[10px] text-emerald-600 font-bold not-italic flex items-center gap-1.5"><CheckCircle2 size={12} /> Add-on ativo — menus Estratégia e Indicadores visíveis para o cliente</p>
                              : <p className="text-[10px] text-slate-400 font-normal not-italic">Add-on inativo — o cliente não verá Estratégia nem Indicadores</p>}
                          </div>

                          {/* Add-on ClickSign */}
                          <div className="border-t border-slate-100 pt-5 space-y-3">
                            <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-2">
                              <PenLine size={13} className="text-amber-600" /> Add-on: Assinatura Digital (ClickSign)
                            </h4>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                              <div>
                                <p className="text-sm font-bold text-slate-800 italic">ClickSign — {managedClientForm.name || managedClientId}</p>
                                <p className="text-[10px] text-slate-400 font-normal not-italic mt-0.5">Habilita envio de atas para assinatura digital (cobrança adicional)</p>
                              </div>
                              <button onClick={toggleManagedClickSign} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${managedClientProfile?.clicksign_enabled ? 'bg-amber-600' : 'bg-slate-200'}`}>
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${managedClientProfile?.clicksign_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                            </div>
                            {managedClientProfile?.clicksign_enabled
                              ? <p className="text-[10px] text-emerald-600 font-bold not-italic flex items-center gap-1.5"><CheckCircle2 size={12} /> Add-on ativo — botão de assinatura digital visível nas atas</p>
                              : <p className="text-[10px] text-slate-400 font-normal not-italic">Add-on inativo — o cliente não verá a opção de assinatura digital</p>}
                          </div>

                          {/* Status da conta — ativar/inativar (reversível) */}
                          <div className="border-t border-slate-100 pt-5 space-y-3">
                            <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-2">
                              <Lock size={13} className="text-amber-600" /> Status da Conta
                            </h4>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                              <div>
                                <p className="text-sm font-bold text-slate-800 italic">{(managedClientProfile?.active ?? true) ? 'Conta ativa' : 'Conta inativa'}</p>
                                <p className="text-[10px] text-slate-400 font-normal not-italic mt-0.5">{(managedClientProfile?.active ?? true) ? 'Os usuários desta empresa têm acesso normal ao sistema.' : 'Os usuários desta empresa estão bloqueados no login (dados preservados).'}</p>
                              </div>
                              <button onClick={toggleManagedActive} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${(managedClientProfile?.active ?? true) ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${(managedClientProfile?.active ?? true) ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                            </div>
                          </div>

                          {/* Zona de perigo — exclusão definitiva */}
                          <div className="border-t border-red-100 pt-5 space-y-3">
                            <h4 className="text-[10px] font-bold uppercase text-red-500 tracking-widest flex items-center gap-2">
                              <AlertCircle size={13} /> Zona de Perigo
                            </h4>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                              <div>
                                <p className="text-sm font-bold text-red-700 italic">Excluir esta empresa</p>
                                <p className="text-[10px] text-red-500 font-normal not-italic mt-0.5">Apaga definitivamente reuniões, atas, membros e logins. Irreversível.</p>
                              </div>
                              <button onClick={deleteClientAccount} disabled={deletingClient} className="shrink-0 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50">
                                <Trash2 size={14} /> {deletingClient ? 'Excluindo...' : 'Excluir definitivamente'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
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
                            <option value="Assistente">Assistente (só materiais)</option>
                            <option value="Controller">Controller (só lançar indicadores)</option>
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
                            <input type="text" className="w-full p-3 border border-slate-100 rounded-lg text-sm font-bold outline-none bg-slate-50 text-slate-400 cursor-not-allowed" value={activeClientId || currentUser.client_id} readOnly />
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
                            <td className="px-6 py-4 text-center">
                              {(u.id === currentUser.id || (u.role === 'SuperAdmin' && !isSuper)) ? (
                                <span className="text-[10px] font-bold text-slate-500 uppercase">{u.role}</span>
                              ) : (
                                <select value={u.role} onChange={e => updateMemberRole(u, e.target.value)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer outline-none hover:border-amber-400 transition-colors not-italic">
                                  <option value="Conselheiro">Conselheiro</option>
                                  <option value="Assistente">Assistente</option>
                                  <option value="Controller">Controller</option>
                                  <option value="Secretário">Secretário</option>
                                  <option value="Administrador">Administrador</option>
                                  {isSuper && <option value="SuperAdmin">SuperAdmin</option>}
                                </select>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {isSuper && (u.role === 'Secretário' || u.role === 'Conselheiro' || u.role === 'Administrador') && (
                                  <button onClick={() => openSecModal(u)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border border-slate-200 text-slate-500 hover:border-amber-400 hover:text-amber-600 transition-all not-italic" title={u.role === 'Conselheiro' ? 'Empresas em que é conselheiro' : u.role === 'Administrador' ? 'Clientes que este administrador pode gerir' : 'Clientes que este secretário pode atender'}>
                                    <Building2 size={12} /> Clientes{(u.secretary_clients?.length ? ` (${u.secretary_clients.length})` : '')}
                                  </button>
                                )}
                                <button onClick={async () => {
                                  if (window.confirm(`Remover ${u.name}?\n\nO login também será excluído, liberando o e-mail para novo cadastro.`)) {
                                    const { data, error } = await supabase.functions.invoke('delete-member', { body: { userId: u.id } });
                                    if (error || data?.error) { alert('Erro ao remover: ' + (error?.message || data?.error)); return; }
                                    setUsers(users.filter((x: any) => x.id !== u.id)); addLog('Remoção', `Membro removido: ${u.name}`);
                                  }
                                }} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                              </div>
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
      {isScheduleOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2"><CalendarPlus size={20} className="text-amber-600" /> Programar Reuniões do Ano</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Crie as reuniões em lote e reserve a agenda dos conselheiros</p>
              </div>
              <button onClick={() => setIsScheduleOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-400"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
              {/* Configuração */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Título base das reuniões</label>
                  <input type="text" value={scheduleForm.baseTitle} onChange={e => setScheduleForm({ ...scheduleForm, baseTitle: e.target.value })} placeholder="Ex: Reunião Ordinária do Conselho" className="w-full p-3 border rounded-lg text-sm font-bold outline-none focus:border-amber-400" />
                  <p className="text-[9px] text-slate-400 mt-1 italic">O mês/ano é adicionado automaticamente (ex: "{scheduleForm.baseTitle || 'Reunião'} — {formatMonthYear(scheduleForm.startDate) || 'Mês/Ano'}").</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">1ª reunião</label>
                    <input type="date" value={scheduleForm.startDate} onChange={e => setScheduleForm({ ...scheduleForm, startDate: e.target.value })} className="w-full p-3 border rounded-lg text-sm font-bold outline-none focus:border-amber-400" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Horário</label>
                    <input type="time" value={scheduleForm.time} onChange={e => setScheduleForm({ ...scheduleForm, time: e.target.value })} className="w-full p-3 border rounded-lg text-sm font-bold outline-none focus:border-amber-400" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Tipo</label>
                    <select value={scheduleForm.type} onChange={e => { const t = e.target.value; setScheduleForm({ ...scheduleForm, type: t, link: t === 'Presencial' ? '' : scheduleForm.link, address: t === 'Online' ? '' : scheduleForm.address }); }} className="w-full p-3 border rounded-lg text-sm font-bold outline-none bg-white focus:border-amber-400">
                      <option>Híbrida</option><option>Presencial</option><option>Online</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Frequência</label>
                    <select value={scheduleForm.freq} onChange={e => setScheduleForm({ ...scheduleForm, freq: e.target.value })} className="w-full p-3 border rounded-lg text-sm font-bold outline-none bg-white focus:border-amber-400">
                      <option value="mensal">Mensal</option><option value="bimestral">Bimestral</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Quantidade</label>
                    <input type="number" min={1} max={24} value={scheduleForm.count} onChange={e => setScheduleForm({ ...scheduleForm, count: Number(e.target.value) })} className="w-full p-3 border rounded-lg text-sm font-bold outline-none focus:border-amber-400" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={generateScheduleDates} className="w-full h-12 bg-slate-900 text-amber-500 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"><Calendar size={14} /> Gerar prévia</button>
                  </div>
                </div>
                {(scheduleForm.type === 'Online' || scheduleForm.type === 'Presencial' || scheduleForm.type === 'Híbrida') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(scheduleForm.type === 'Online' || scheduleForm.type === 'Híbrida') && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Link da reunião</label>
                        <input type="text" value={scheduleForm.link} onChange={e => setScheduleForm({ ...scheduleForm, link: e.target.value })} placeholder="https://meet..." className="w-full p-3 border rounded-lg text-sm font-bold outline-none focus:border-amber-400" />
                      </div>
                    )}
                    {(scheduleForm.type === 'Presencial' || scheduleForm.type === 'Híbrida') && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Endereço</label>
                        <input type="text" value={scheduleForm.address} onChange={e => setScheduleForm({ ...scheduleForm, address: e.target.value })} placeholder="Local da reunião" className="w-full p-3 border rounded-lg text-sm font-bold outline-none focus:border-amber-400" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Prévia editável das datas */}
              {scheduleDates.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><CalendarClock size={14} className="text-amber-600" /> {scheduleDates.length} datas — ajuste se necessário</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                    {scheduleDates.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg border border-slate-100 p-2">
                        <span className="text-[10px] font-bold text-slate-400 w-6 text-center">{i + 1}</span>
                        <input type="date" value={d} onChange={e => { const nd = [...scheduleDates]; nd[i] = e.target.value; setScheduleDates(nd); }} className="flex-1 p-2 border rounded text-sm font-bold outline-none bg-white focus:border-amber-400" />
                        <button onClick={() => setScheduleDates(scheduleDates.filter((_, idx) => idx !== i))} className="p-1.5 text-slate-300 hover:text-red-500 transition-all"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Participantes */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><UserCheck size={14} className="text-amber-600" /> Participantes ({scheduleParticipants.length} selecionados)</h4>
                {(users || []).length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic uppercase tracking-widest">Nenhum membro cadastrado.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {(users || []).map((u: any) => {
                      const checked = scheduleParticipants.some((p: any) => p.email === u.email);
                      return (
                        <label key={u.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${checked ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100 hover:bg-white'}`}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            if (checked) setScheduleParticipants(scheduleParticipants.filter((p: any) => p.email !== u.email));
                            else setScheduleParticipants([...scheduleParticipants, { name: u.name, email: u.email, isExternal: false }]);
                          }} className="accent-amber-600 w-4 h-4" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 italic truncate">{u.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Convites */}
              <label className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 cursor-pointer">
                <input type="checkbox" checked={scheduleForm.sendInvites} onChange={e => setScheduleForm({ ...scheduleForm, sendInvites: e.target.checked })} className="accent-amber-600 w-5 h-5" />
                <div>
                  <p className="text-sm font-bold text-slate-800 italic flex items-center gap-2"><Mail size={15} className="text-amber-600" /> Enviar convites de calendário (RSVP) agora</p>
                  <p className="text-[10px] text-slate-400">Cada participante recebe um e-mail com o anexo .ics para reservar todas as datas na agenda.</p>
                </div>
              </label>
            </div>

            <div className="p-6 border-t bg-white flex flex-col sm:flex-row gap-3">
              <button onClick={() => setIsScheduleOpen(false)} className="flex-1 border border-slate-200 text-slate-600 py-4 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-50 transition-all">Cancelar</button>
              <button disabled={isScheduling || scheduleDates.length === 0} onClick={scheduleYear} className="flex-[2] bg-amber-600 text-white py-4 rounded-xl font-bold uppercase text-[10px] tracking-[2px] flex items-center justify-center gap-3 hover:bg-amber-700 transition-all shadow-xl disabled:opacity-50">
                {isScheduling ? 'Processando...' : <><CalendarPlus size={16} /> Programar {scheduleDates.length > 0 ? `${scheduleDates.length} ` : ''}Reuniões</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: criar deliberação extraordinária */}
      {isExtraDelibOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2"><Scale size={20} className="text-amber-600" /> Nova Deliberação Extraordinária</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Votação fora de reunião, com registro</p>
              </div>
              <button onClick={() => setIsExtraDelibOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-400"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/30">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proposição</label>
                <textarea rows={3} value={extraDelibForm.title} onChange={e => setExtraDelibForm({ ...extraDelibForm, title: e.target.value })} placeholder="Descreva a proposição a ser votada..." className="w-full p-3 border border-slate-200 rounded-lg text-sm font-bold italic outline-none focus:border-amber-500 resize-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Conselheiros votantes ({extraDelibForm.voters.length})</label>
                {clientMembers.length === 0 ? <p className="text-[10px] text-slate-400 italic">Nenhum membro cadastrado.</p> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                    {clientMembers.map((u: any) => {
                      const checked = extraDelibForm.voters.includes(u.name);
                      return (
                        <label key={u.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${checked ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={checked} onChange={() => setExtraDelibForm(f => ({ ...f, voters: checked ? f.voters.filter(n => n !== u.name) : [...f.voters, u.name] }))} className="accent-amber-600 w-4 h-4" />
                          <div className="min-w-0"><p className="text-sm font-bold text-slate-800 italic truncate">{u.name}</p><p className="text-[10px] text-slate-400 truncate">{u.email}</p></div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t bg-white flex gap-3">
              <button onClick={() => setIsExtraDelibOpen(false)} className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-50">Cancelar</button>
              <button disabled={extraCreating} onClick={createExtraDeliberation} className="flex-[2] bg-amber-600 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] flex items-center justify-center gap-2 hover:bg-amber-700 shadow-xl disabled:opacity-50"><Plus size={16} /> {extraCreating ? 'Criando...' : 'Criar e Abrir Votação'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: votação de deliberação extraordinária */}
      {votingDelibId != null && (() => {
        const container = findExtraContainer();
        const d = container?.deliberacoes?.find((x: any) => x.id === votingDelibId);
        if (!d) return null;
        const r = deliberationResult(d);
        const voters: string[] = d.voters || [];
        const votes: Record<string, string> = d.votes || {};
        const myName = resolveVoterNameIn(container.participants || [], voters);
        const myVote = myName ? votes[myName] : undefined;
        const availableToAdd = clientMembers.filter((u: any) => !voters.includes(u.name));
        return (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
              <div className="p-6 border-b flex justify-between items-start bg-slate-50 gap-3">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 bg-slate-900 text-amber-400 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase mb-2"><Scale size={10} /> Extraordinária</span>
                  <h3 className="text-base font-bold text-slate-800 italic leading-snug">"{d.title}"</h3>
                </div>
                <button onClick={() => setVotingDelibId(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 shrink-0"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/30">
                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-100"><ThumbsUp size={11} />{r.favor}</span>
                    <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-100"><ThumbsDown size={11} />{r.contra}</span>
                    <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-200"><MinusCircle size={11} />{r.abst}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[9px] uppercase font-bold ${r.cls}`}>{r.label}</span>
                </div>

                {myName ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Seu voto ({myName})</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleExtraVote(d.id, 'Favor')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${myVote === 'Favor' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'}`}><ThumbsUp size={13} /> Favor</button>
                      <button onClick={() => handleExtraVote(d.id, 'Contra')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${myVote === 'Contra' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600'}`}><ThumbsDown size={13} /> Contra</button>
                      <button onClick={() => handleExtraVote(d.id, 'Abstenção')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${myVote === 'Abstenção' ? 'bg-slate-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}><CircleSlash size={13} /> Abster</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic bg-white border border-slate-200 rounded-xl p-4">Você não está na lista de votantes desta deliberação.</p>
                )}

                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Votantes ({r.voted}/{r.total})</p>
                  {voters.length === 0 && <p className="text-[10px] text-slate-300 italic">Nenhum votante.</p>}
                  {voters.map((v) => (
                    <div key={v} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-50 last:border-0">
                      <span className="text-sm font-bold text-slate-700 italic flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-[8px] font-black shrink-0">{v[0]}</span>{v}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${votes[v] === 'Favor' ? 'bg-emerald-100 text-emerald-700' : votes[v] === 'Contra' ? 'bg-red-100 text-red-700' : votes[v] === 'Abstenção' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>{votes[v] || 'Pendente'}</span>
                        {canEdit && <button onClick={() => updateExtraDelibVoters(d.id, voters.filter(x => x !== v))} className="text-slate-300 hover:text-red-500" title="Remover votante"><X size={13} /></button>}
                      </div>
                    </div>
                  ))}
                  {canEdit && availableToAdd.length > 0 && (
                    <select className="mt-2 w-full p-2 border border-slate-200 rounded-lg text-[10px] font-bold uppercase text-slate-500 bg-white outline-none cursor-pointer" value="" onChange={e => { if (e.target.value) updateExtraDelibVoters(d.id, [...voters, e.target.value]); }}>
                      <option value="">+ Adicionar votante</option>
                      {availableToAdd.map((u: any) => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
              <div className="p-6 border-t bg-white flex flex-wrap gap-3">
                {canEdit && <button onClick={() => deleteExtraDeliberation(d.id)} className="px-4 py-3 border border-red-200 text-red-600 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-red-50 flex items-center gap-2"><Trash2 size={14} /> Excluir</button>}
                {canEdit && <button onClick={() => sendVoteInvitations(d.id)} disabled={sendingVoteInvites} className="px-4 py-3 border border-amber-300 bg-amber-50 text-amber-700 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-amber-100 flex items-center gap-2 disabled:opacity-50"><Mail size={14} /> {sendingVoteInvites ? 'Enviando...' : 'Convidar por e-mail'}</button>}
                <button onClick={() => setVotingDelibId(null)} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-800">Concluir</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: clientes do secretário multi-cliente (SuperAdmin) */}
      {secModalUser && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2"><Building2 size={20} className="text-amber-600" /> {secModalUser.role === 'Conselheiro' ? 'Empresas do Conselheiro' : `Clientes do ${secModalUser.role}`}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{secModalUser.name} — {secModalUser.role === 'Conselheiro' ? 'será conselheiro das empresas marcadas' : secModalUser.role === 'Administrador' ? 'administrará os clientes marcados' : 'poderá secretariar os clientes marcados'}</p>
              </div>
              <button onClick={() => setSecModalUser(null)} className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-400"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allClientsList.map((c: any) => {
                  const checked = secModalSelected.includes(c.client_id);
                  return (
                    <label key={c.client_id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checked ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={checked} onChange={() => setSecModalSelected(prev => checked ? prev.filter((x: string) => x !== c.client_id) : [...prev, c.client_id])} className="accent-amber-600 w-4 h-4" />
                      <div className="min-w-0"><p className="text-sm font-bold text-slate-800 italic truncate">{c.name || c.client_id}</p><p className="text-[9px] text-slate-400 uppercase tracking-widest truncate">{c.client_id}</p></div>
                    </label>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-3">Marque todas as empresas vinculadas a este usuário. Ele alterna entre elas pelo seletor no topo do sistema {secModalUser.role === 'Conselheiro' ? 'e poderá ser incluído como votante nas deliberações dessas empresas.' : secModalUser.role === 'Administrador' ? 'com poderes de administrador em cada uma.' : 'com poderes de secretário.'}</p>
            </div>
            <div className="p-6 border-t bg-white flex gap-3">
              <button onClick={() => setSecModalUser(null)} className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-50">Cancelar</button>
              <button disabled={secModalSaving} onClick={saveSecModal} className="flex-[2] bg-amber-600 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] flex items-center justify-center gap-2 hover:bg-amber-700 shadow-xl disabled:opacity-50"><Save size={16} /> {secModalSaving ? 'Salvando...' : 'Salvar Clientes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: Indicador ===== */}
      {indModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2"><Gauge size={20} className="text-amber-600" /> {indModal.id ? 'Editar indicador' : 'Novo indicador'}</h3>
              <button onClick={() => setIndModal(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do indicador *</label>
                <input value={indModal.name} onChange={e => setIndModal({ ...indModal, name: e.target.value })} placeholder="Ex.: Margem EBITDA" className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidade</label>
                  <input value={indModal.unit} onChange={e => setIndModal({ ...indModal, unit: e.target.value })} placeholder="%, R$, dias" className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoria</label>
                  <input value={indModal.category} onChange={e => setIndModal({ ...indModal, category: e.target.value })} placeholder="Financeiro, Comercial…" className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Direção (o que é melhor)</label>
                <select value={indModal.direction} onChange={e => setIndModal({ ...indModal, direction: e.target.value })} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm bg-white cursor-pointer">
                  <option value="higher_is_better">Maior é melhor (ex.: margem, caixa)</option>
                  <option value="lower_is_better">Menor é melhor (ex.: inadimplência, custo)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nível</label>
                  <select value={indModal.level || ''} onChange={e => setIndModal({ ...indModal, level: e.target.value })} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm bg-white cursor-pointer">
                    <option value="">—</option>
                    <option value="estrategico">Estratégico</option>
                    <option value="tatico">Tático</option>
                    <option value="operacional">Operacional</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsável</label>
                  <select value={indModal.responsible_member_id || ''} onChange={e => setIndModal({ ...indModal, responsible_member_id: e.target.value })} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm bg-white cursor-pointer">
                    <option value="">—</option>
                    {clientMembers.filter((u: any) => u.email).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição (opcional)</label>
                <textarea value={indModal.description} onChange={e => setIndModal({ ...indModal, description: e.target.value })} rows={2} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm resize-none" />
              </div>
            </div>
            <div className="p-6 border-t bg-white flex gap-3">
              <button onClick={() => setIndModal(null)} className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-50">Cancelar</button>
              <button disabled={indSaving} onClick={saveIndicator} className="flex-[2] bg-amber-600 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] flex items-center justify-center gap-2 hover:bg-amber-700 shadow-xl disabled:opacity-50"><Save size={16} /> {indSaving ? 'Salvando...' : 'Salvar indicador'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: Registrar leitura ===== */}
      {readingModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2"><PenLine size={20} className="text-amber-600" /> Registrar leitura</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{readingModal.name}</p>
              </div>
              <button onClick={() => setReadingModal(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 shrink-0"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 bg-slate-50/30">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Competência *</label>
                  <input type="month" value={readingForm.period} onChange={e => setReadingForm({ ...readingForm, period: e.target.value })} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor * {readingModal.unit ? `(${readingModal.unit})` : ''}</label>
                  <input type="number" step="any" value={readingForm.value} onChange={e => setReadingForm({ ...readingForm, value: e.target.value })} placeholder="0" className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fonte (opcional)</label>
                <input value={readingForm.source} onChange={e => setReadingForm({ ...readingForm, source: e.target.value })} placeholder="Ex.: ECD, planilha do controller" className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm" />
              </div>
              <p className="text-[10px] text-slate-400">Ao salvar, o sistema avalia os gatilhos deste indicador automaticamente e, se houver rompimento, cria o alerta e a ação no Plano de Ação.</p>
            </div>
            <div className="p-6 border-t bg-white flex gap-3">
              <button onClick={() => setReadingModal(null)} className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-50">Cancelar</button>
              <button disabled={readingSaving} onClick={saveReading} className="flex-[2] bg-amber-600 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] flex items-center justify-center gap-2 hover:bg-amber-700 shadow-xl disabled:opacity-50"><Save size={16} /> {readingSaving ? 'Registrando...' : 'Registrar e avaliar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: Detalhes da Ação (5W2H) ===== */}
      {actionModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2"><ListChecks size={20} className="text-amber-600" /> Detalhes da Ação (5W2H)</h3>
              <button onClick={() => setActionModal(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/30">
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">O quê — título *</label><input value={actionModal.title} onChange={e => setActionModal({ ...actionModal, title: e.target.value })} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm" /></div>
              {strategyEnabled && <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Objetivo estratégico vinculado</label>
                <select value={actionModal.objective_id || ''} onChange={e => setActionModal({ ...actionModal, objective_id: e.target.value })} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm bg-white cursor-pointer">
                  <option value="">— nenhum —</option>
                  {strategyObjectives.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>}
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Por quê — justificativa</label><textarea value={actionModal.why} onChange={e => setActionModal({ ...actionModal, why: e.target.value })} rows={2} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm resize-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Onde</label><input value={actionModal.where} onChange={e => setActionModal({ ...actionModal, where: e.target.value })} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm" /></div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quanto — custo</label><input value={actionModal.how_much} onChange={e => setActionModal({ ...actionModal, how_much: e.target.value })} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm" /></div>
              </div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Como</label><textarea value={actionModal.how} onChange={e => setActionModal({ ...actionModal, how: e.target.value })} rows={2} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm resize-none" /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Observações</label><textarea value={actionModal.obs} onChange={e => setActionModal({ ...actionModal, obs: e.target.value })} rows={2} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm resize-none" /></div>
              <p className="text-[10px] text-slate-400"><b>Quem</b> (responsáveis), <b>Quando</b> (prazo), <b>Prioridade</b> e <b>Status</b> são editados direto na tabela ou no Kanban.</p>
            </div>
            <div className="p-6 border-t bg-white flex gap-3">
              <button onClick={() => setActionModal(null)} className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-50">Cancelar</button>
              <button disabled={actionModalSaving} onClick={saveActionModal} className="flex-[2] bg-amber-600 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] flex items-center justify-center gap-2 hover:bg-amber-700 shadow-xl disabled:opacity-50"><Save size={16} /> {actionModalSaving ? 'Salvando...' : 'Salvar detalhes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: FCA (Ficha de Controle Analítico) ===== */}
      {fcaModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 gap-3">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2"><Search size={20} className="text-amber-600" /> Análise de Causa (FCA)</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{fcaModal.indicator.name} — Fato → Causa → Ação</p>
              </div>
              <button onClick={() => setFcaModal(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 shrink-0"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/30">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Competência</label>
                <input type="month" value={fcaModal.period} onChange={e => setFcaModal({ ...fcaModal, period: e.target.value })} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fato — o que aconteceu *</label>
                <textarea value={fcaModal.fact} onChange={e => setFcaModal({ ...fcaModal, fact: e.target.value })} rows={2} placeholder="Ex.: Receita ficou 40% abaixo da meta no mês." className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Causa — por quê</label>
                <textarea value={fcaModal.cause} onChange={e => setFcaModal({ ...fcaModal, cause: e.target.value })} rows={2} placeholder="Ex.: Atraso no lançamento de dois produtos." className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ação (contramedida)</label>
                <textarea value={fcaModal.action_text} onChange={e => setFcaModal({ ...fcaModal, action_text: e.target.value })} rows={2} placeholder="Ex.: Antecipar o cronograma de lançamento." className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm resize-none" />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer"><input type="checkbox" checked={fcaModal.createAction} onChange={e => setFcaModal({ ...fcaModal, createAction: e.target.checked })} className="accent-amber-600 w-4 h-4" /> Criar esta ação no Plano de Ação</label>
            </div>
            <div className="p-6 border-t bg-white flex gap-3">
              <button onClick={() => setFcaModal(null)} className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-50">Cancelar</button>
              <button disabled={fcaSaving} onClick={saveFca} className="flex-[2] bg-amber-600 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] flex items-center justify-center gap-2 hover:bg-amber-700 shadow-xl disabled:opacity-50"><Save size={16} /> {fcaSaving ? 'Salvando...' : 'Salvar análise'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: Metas do ano ===== */}
      {yearMetasOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 gap-3">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2"><Target size={20} className="text-amber-600" /> Metas do ano</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Defina a meta de cada indicador para os 12 meses</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1.5 py-1">
                  <button onClick={() => changeYearMetas(-1)} className="p-1 text-slate-400 hover:text-amber-600"><ChevronLeft size={16} /></button>
                  <span className="text-sm font-bold text-slate-800 w-12 text-center tabular-nums">{yearMetasYear}</span>
                  <button onClick={() => changeYearMetas(1)} className="p-1 text-slate-400 hover:text-amber-600"><ChevronRight size={16} /></button>
                </div>
                <button onClick={() => setYearMetasOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 shrink-0"><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50/30">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-100 text-left px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200">Indicador</th>
                    {['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'].map(mn => <th key={mn} className="px-1 py-2 text-[9px] font-bold uppercase text-slate-400 border-b border-slate-200 text-center">{mn}</th>)}
                    <th className="px-2 py-2 border-b border-slate-200"></th>
                  </tr>
                </thead>
                <tbody>
                  {indicatorsList.map((ind: any) => (
                    <tr key={ind.id} className="border-b border-slate-100">
                      <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-bold text-slate-800 italic whitespace-nowrap max-w-[200px] truncate">{ind.name}{ind.unit ? <span className="text-[9px] font-normal text-slate-400"> ({ind.unit})</span> : null}</td>
                      {YM_MONTHS.map(m => (
                        <td key={m} className="px-0.5 py-0.5"><input type="number" step="any" value={yearMetasVals[`${ind.id}|${m}`] ?? ''} onChange={e => setYearMetasVals({ ...yearMetasVals, [`${ind.id}|${m}`]: e.target.value })} placeholder="—" className="w-14 p-1 rounded border border-slate-200 text-right text-[11px] outline-none focus:border-amber-400 bg-amber-50/30" /></td>
                      ))}
                      <td className="px-1 text-center"><button onClick={() => applyRowAll(ind.id)} title="Replicar o 1º valor preenchido nos 12 meses" className="text-slate-300 hover:text-amber-600 text-sm font-bold">⟳</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-400 mt-3">Dica: preencha o primeiro mês e clique em <b>⟳</b> para replicar nos 12. Metas em branco são ignoradas. Você também pode registrar realizado + meta mês a mês em "Lançar mês".</p>
            </div>
            <div className="p-6 border-t bg-white flex gap-3">
              <button onClick={() => setYearMetasOpen(false)} className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-50">Cancelar</button>
              <button disabled={yearMetasSaving} onClick={saveYearMetas} className="flex-[2] bg-amber-600 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] flex items-center justify-center gap-2 hover:bg-amber-700 shadow-xl disabled:opacity-50"><Save size={16} /> {yearMetasSaving ? 'Salvando...' : 'Salvar metas do ano'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: Lançar mês (grade) ===== */}
      {batchOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 gap-3">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2"><PenLine size={20} className="text-amber-600" /> Lançar mês</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Digite os valores de todos os indicadores de uma vez</p>
              </div>
              <button onClick={() => setBatchOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 shrink-0"><X size={20} /></button>
            </div>
            <div className="p-6 pb-3 bg-slate-50/30">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Competência</label>
              <input type="month" value={batchPeriod} onChange={e => { setBatchPeriod(e.target.value); fillBatchForPeriod(e.target.value); }} className="w-full mt-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm" />
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-2 bg-slate-50/30">
              <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
                  <div className="flex-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Indicador</div>
                  <div className="w-20 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Realizado</div>
                  {canEdit && <div className="w-20 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Meta</div>}
                  <div className="w-7" />
                </div>
                <div className="divide-y divide-slate-100">
                  {indicatorsList.map((ind: any) => (
                    <div key={ind.id} className="flex items-center gap-2 p-3">
                      <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-800 italic truncate">{ind.name}</p>{ind.category && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{ind.category}</p>}</div>
                      <input type="number" step="any" value={batchValues[ind.id] ?? ''} onChange={e => setBatchValues({ ...batchValues, [ind.id]: e.target.value })} placeholder="—" className="w-20 p-2 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm text-right shrink-0" />
                      {canEdit && <input type="number" step="any" value={batchTargets[ind.id] ?? ''} onChange={e => setBatchTargets({ ...batchTargets, [ind.id]: e.target.value })} placeholder="—" className="w-20 p-2 rounded-lg border border-slate-200 bg-amber-50/40 outline-none focus:border-amber-400 text-sm text-right shrink-0" />}
                      <span className="text-[10px] text-slate-400 w-7 shrink-0">{ind.unit || ''}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Preencha o <b>realizado</b> e/ou a <b>meta</b> do mês. Campos em branco são ignorados. Ao salvar, os gatilhos são avaliados e o farol (realizado × meta) é atualizado.</p>
            </div>
            <div className="p-6 border-t bg-white flex gap-3">
              <button onClick={() => setBatchOpen(false)} className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-50">Cancelar</button>
              <button disabled={batchSaving} onClick={saveBatch} className="flex-[2] bg-amber-600 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] flex items-center justify-center gap-2 hover:bg-amber-700 shadow-xl disabled:opacity-50"><Save size={16} /> {batchSaving ? 'Salvando...' : 'Salvar lançamento'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: Importar planilha ===== */}
      {importOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 gap-3">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2"><Upload size={20} className="text-amber-600" /> Importar planilha</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CSV com colunas: indicador · competência · valor · (fonte)</p>
              </div>
              <button onClick={() => setImportOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 shrink-0"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 space-y-4">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => indCsvRef.current?.click()} className="bg-slate-900 hover:bg-slate-800 text-amber-500 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2"><Upload size={15} /> Escolher arquivo CSV</button>
                <button onClick={downloadTemplate} className="border border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-600 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2"><Download size={15} /> Baixar modelo</button>
              </div>
              <div className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-lg p-3">
                <b>Como preparar:</b> no Excel, use uma coluna com o <b>nome exato</b> do indicador, outra com a <b>competência</b> (ex.: <code>2026-06</code> ou <code>06/2026</code>) e outra com o <b>valor</b> (decimal com vírgula, ex.: <code>12,4</code>). Salve como <b>CSV</b>. Dica: use o <b>modelo</b> acima, que já vem com seus indicadores.
              </div>
              {importRows.length > 0 && (() => {
                const okN = importRows.filter((r: any) => r.ok).length;
                const badN = importRows.length - okN;
                return (
                  <div>
                    <p className="text-xs font-bold text-slate-600 mb-2">{okN} linha(s) prontas{badN > 0 ? ` · ${badN} ignorada(s)` : ''}</p>
                    <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                      <table className="w-full text-[12px]">
                        <thead className="bg-slate-50/50 text-[9px] font-bold uppercase tracking-widest text-slate-400 sticky top-0"><tr><th className="px-3 py-2 text-left">Indicador</th><th className="px-3 py-2 text-left">Compet.</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          {importRows.map((r: any, i: number) => (
                            <tr key={i} className={r.ok ? '' : 'bg-red-50/40'}>
                              <td className="px-3 py-1.5 text-slate-700 truncate max-w-[160px]">{r.name || '—'}</td>
                              <td className="px-3 py-1.5 text-slate-500">{r.period ? String(r.period).slice(0, 7) : '—'}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-slate-800">{isNaN(r.value) ? '—' : r.value}</td>
                              <td className="px-3 py-1.5">{r.ok ? <span className="text-emerald-600 font-bold text-[10px] uppercase">ok</span> : <span className="text-red-500 text-[10px]">{r.reason}</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="p-6 border-t bg-white flex gap-3">
              <button onClick={() => setImportOpen(false)} className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-50">Cancelar</button>
              <button disabled={importing || importRows.filter((r: any) => r.ok).length === 0} onClick={runImport} className="flex-[2] bg-amber-600 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] flex items-center justify-center gap-2 hover:bg-amber-700 shadow-xl disabled:opacity-50"><Save size={16} /> {importing ? 'Importando...' : `Importar ${importRows.filter((r: any) => r.ok).length} leitura(s)`}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: Link de coleta ===== */}
      {collectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 gap-3">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2"><ExternalLink size={20} className="text-amber-600" /> Link de coleta</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">O responsável do cliente preenche os indicadores sem login</p>
              </div>
              <button onClick={() => setCollectModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 shrink-0"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 bg-slate-50/30">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Competência da coleta</label>
                <div className="flex gap-2 mt-1">
                  <input type="month" value={collectPeriod} onChange={e => { setCollectPeriod(e.target.value); setCollectUrl(''); }} className="flex-1 p-3 rounded-lg border border-slate-200 outline-none focus:border-amber-400 text-sm" />
                  <button disabled={collectMinting} onClick={genCollectLink} className="bg-amber-600 hover:bg-amber-700 text-white px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest shrink-0 disabled:opacity-50">{collectMinting ? 'Gerando...' : 'Gerar link'}</button>
                </div>
              </div>
              {collectUrl && (
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Link (válido por 45 dias)</p>
                  <div className="flex gap-2">
                    <input readOnly value={collectUrl} onFocus={e => e.target.select()} className="flex-1 p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600 outline-none" />
                    <button onClick={copyCollectUrl} className="bg-slate-900 hover:bg-slate-800 text-amber-500 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest shrink-0 inline-flex items-center gap-1">{collectCopied ? <><Check size={13} /> Copiado</> : <><Download size={13} className="rotate-90" /> Copiar</>}</button>
                  </div>
                  <p className="text-[10px] text-slate-400">Envie este link ao controller/financeiro do cliente. Ele abre uma página simples para digitar os valores do mês — sem precisar de conta. Ao enviar, os gatilhos são avaliados normalmente.</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-white">
              <button onClick={() => setCollectModalOpen(false)} className="w-full border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-[2px] hover:bg-slate-50">Fechar</button>
            </div>
          </div>
        </div>
      )}

      <input type="file" ref={indCsvRef} accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} />
      <input type="file" ref={fileRef} className="hidden" onChange={(e) => handleFileUpload(e, 'materiais')} />
      <input type="file" ref={transcriptRef} accept=".vtt,.txt,.srt,text/plain" className="hidden" onChange={handleTranscriptUpload} />
      <input type="file" ref={ataRef} className="hidden" onChange={(e) => handleFileUpload(e, 'atas')} />
      <input type="file" ref={assistantFileRef} className="hidden" onChange={assistantUploadMaterial} />
    </div>
  );
};

export default App;