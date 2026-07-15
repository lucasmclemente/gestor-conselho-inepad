// Calcula o resultado de uma deliberação a partir dos votos
// (mesma regra usada na aba da reunião e no repositório de atas)
export function deliberationResult(d: any) {
  const voters: string[] = d.voters || [];
  const votes: Record<string, string> = d.votes || {};
  const favor = voters.filter(v => votes[v] === 'Favor').length;
  const contra = voters.filter(v => votes[v] === 'Contra').length;
  const abst = voters.filter(v => votes[v] === 'Abstenção').length;
  const voted = favor + contra + abst;
  const total = voters.length;
  const pending = total - voted;
  const allVoted = total > 0 && pending === 0;
  let label = 'SEM VOTANTES', cls = 'bg-slate-100 text-slate-400';
  if (total > 0 && !allVoted) { label = 'EM VOTAÇÃO'; cls = 'bg-amber-100 text-amber-700'; }
  else if (allVoted && favor > contra) { label = 'APROVADA'; cls = 'bg-emerald-100 text-emerald-700'; }
  else if (allVoted && contra > favor) { label = 'REJEITADA'; cls = 'bg-red-100 text-red-700'; }
  else if (allVoted) { label = 'EMPATE'; cls = 'bg-slate-100 text-slate-600'; }
  return { favor, contra, abst, voted, total, pending, allVoted, label, cls };
}
