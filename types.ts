
export enum MeetingStatus {
  SCHEDULED = 'Agendada',
  IN_PROGRESS = 'Em Andamento',
  CONCLUDED = 'Concluída',
  CANCELLED = 'Cancelada'
}

export enum ActionStatus {
  PENDING = 'Pendente',
  IN_PROGRESS = 'Em Execução',
  COMPLETED = 'Concluída',
  OVERDUE = 'Atrasada'
}

export enum DeliberationStatus {
  APPROVED = 'Aprovado',
  REJECTED = 'Rejeitado',
  POSTPONED = 'Postergado',
  UNDER_REVIEW = 'Em Revisão'
}

export interface Participant {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface Material {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
}

export interface AgendaItem {
  id: string;
  title: string;
  description: string;
  duration: number; // in minutes
}

export interface Deliberation {
  id: string;
  title: string;
  description: string;
  status: DeliberationStatus;
  materialRef?: string;
}

export interface ActionPlan {
  id: string;
  description: string;
  responsible: string;
  deadline: string;
  status: ActionStatus;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  status: MeetingStatus;
  agenda: AgendaItem[];
  materials: Material[];
  participants: Participant[];
  deliberations: Deliberation[];
  actions: ActionPlan[];
  minutes?: string;
}
