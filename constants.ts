// Prioridades do Plano de Ação — escala de cor crescente (baixa → urgente)
export const PRIORITIES = ['Baixa', 'Média', 'Importante', 'Urgente'] as const;

export const PRIORITY_STYLES: Record<string, string> = {
  'Baixa': 'bg-slate-100 text-slate-600 border-slate-200',
  'Média': 'bg-sky-100 text-sky-700 border-sky-200',
  'Importante': 'bg-amber-100 text-amber-700 border-amber-200',
  'Urgente': 'bg-red-100 text-red-700 border-red-200',
};

// Ordenação: Urgente primeiro
export const PRIORITY_WEIGHT: Record<string, number> = { 'Urgente': 0, 'Importante': 1, 'Média': 2, 'Baixa': 3 };
