
import React from 'react';
import { 
  MeetingStatus, 
  ActionStatus, 
  DeliberationStatus, 
  Meeting 
} from './types';

export const MOCK_PARTICIPANTS = [
  { id: '1', name: 'Ana Silva', role: 'Presidente do Conselho', email: 'ana@empresa.com' },
  { id: '2', name: 'Carlos Santos', role: 'Conselheiro Independente', email: 'carlos@empresa.com' },
  { id: '3', name: 'Beatriz Costa', role: 'Diretora Executiva', email: 'beatriz@empresa.com' },
  { id: '4', name: 'Ricardo Oliveira', role: 'Secretário de Governança', email: 'ricardo@empresa.com' },
];

export const INITIAL_MEETINGS: Meeting[] = [
  {
    id: 'm1',
    title: 'Reunião Ordinária do Conselho de Administração - Q1',
    date: '2024-05-15',
    time: '09:00',
    location: 'Sala de Conferências A / Zoom',
    status: MeetingStatus.CONCLUDED,
    agenda: [
      { id: 'a1', title: 'Aprovação da Ata Anterior', description: 'Revisão e assinatura da ata da última reunião.', duration: 15 },
      { id: 'a2', title: 'Resultados Financeiros Q1', description: 'Apresentação dos resultados do primeiro trimestre.', duration: 45 },
      { id: 'a3', title: 'Nova Política de Sustentabilidade', description: 'Discussão sobre as diretrizes ESG para 2025.', duration: 30 }
    ],
    materials: [
      { id: 'f1', name: 'Relatorio_Financeiro_Q1.pdf', type: 'application/pdf', uploadDate: '2024-05-10' },
      { id: 'f2', name: 'Proposta_ESG_v2.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', uploadDate: '2024-05-12' }
    ],
    participants: MOCK_PARTICIPANTS,
    deliberations: [
      { id: 'd1', title: 'Aprovação de Dividendos', description: 'Distribuição de R$ 0,50 por ação.', status: DeliberationStatus.APPROVED },
      { id: 'd2', title: 'Investimento em Tecnologia', description: 'Aprovação de Capex de R$ 2M para nuvem.', status: DeliberationStatus.APPROVED }
    ],
    actions: [
      { id: 'ap1', description: 'Comunicar acionistas sobre dividendos', responsible: 'Beatriz Costa', deadline: '2024-05-20', status: ActionStatus.COMPLETED },
      { id: 'ap2', description: 'Revisar contrato com fornecedor Cloud', responsible: 'Ricardo Oliveira', deadline: '2024-06-01', status: ActionStatus.IN_PROGRESS }
    ],
    minutes: 'A reunião iniciou-se às 09:00 com quórum total. Os resultados do Q1 foram apresentados pela diretoria executiva, demonstrando crescimento de 12% YoY...'
  },
  {
    id: 'm2',
    title: 'Comitê de Auditoria e Riscos',
    date: '2024-06-10',
    time: '14:30',
    location: 'Híbrida',
    status: MeetingStatus.SCHEDULED,
    agenda: [
      { id: 'a4', title: 'Mapa de Riscos 2024', description: 'Atualização dos principais riscos corporativos.', duration: 60 }
    ],
    materials: [],
    participants: [MOCK_PARTICIPANTS[0], MOCK_PARTICIPANTS[3]],
    deliberations: [],
    actions: [],
  }
];
