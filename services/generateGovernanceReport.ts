import jsPDF from 'jspdf';

type RGB = [number, number, number];
const SLATE: RGB = [15, 23, 42];
const AMBER: RGB = [217, 119, 6];
const MUT: RGB = [100, 116, 139];
const LINE: RGB = [226, 232, 240];

const BANDS: { key: string; label: string; color: RGB }[] = [
  { key: 'avancado', label: 'Avançado (≥80)', color: [5, 150, 105] },
  { key: 'estruturado', label: 'Estruturado (60–79)', color: [101, 163, 13] },
  { key: 'em_desenvolvimento', label: 'Em desenvolvimento (40–59)', color: [217, 119, 6] },
  { key: 'em_estruturacao', label: 'Em estruturação (20–39)', color: [234, 88, 12] },
  { key: 'inicial', label: 'Inicial (<20)', color: [220, 38, 38] },
];
const PILLARS: { key: string; label: string }[] = [
  { key: 'conselho', label: 'Conselho' }, { key: 'gestao', label: 'Gestão' },
  { key: 'propriedade', label: 'Propriedade' }, { key: 'controle', label: 'Controle' },
  { key: 'conduta', label: 'Conduta' },
];
const SEALS: { key: string; label: string; color: RGB }[] = [
  { key: 'ouro', label: 'Ouro', color: [180, 83, 9] },
  { key: 'prata', label: 'Prata', color: [71, 85, 105] },
  { key: 'bronze', label: 'Bronze', color: [154, 52, 18] },
];

export function generateGovernanceReport(r: any, year: number) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();   // ~210
  const M = 18;
  let y = 0;

  // Cabeçalho
  doc.setFillColor(...SLATE); doc.rect(0, 0, W, 46, 'F');
  doc.setFillColor(...AMBER); doc.rect(0, 46, W, 1.6, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('BOARDPLAN · INEPAD GOVERNANÇA E SUCESSÃO', M, 18);
  doc.setFontSize(22); doc.text('Estado da Governança', M, 30);
  doc.setTextColor(245, 158, 11); doc.setFontSize(13); doc.text(String(year), M, 39);
  doc.setTextColor(203, 213, 225); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(`Panorama anônimo de ${r.n} conselhos na plataforma`, W - M, 30, { align: 'right' });
  y = 60;

  const sectionTitle = (t: string) => {
    doc.setTextColor(...AMBER); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text(t.toUpperCase(), M, y);
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, y + 2, W - M, y + 2);
    y += 9;
  };

  // KPIs
  const kpis = [
    { v: String(r.avg), l: 'Índice médio' },
    { v: String(r.median), l: 'Mediana' },
    { v: `${r.p25}–${r.p75}`, l: 'Faixa 25–75%' },
    { v: String(r.seals?.total ?? 0), l: 'Conselhos certificados' },
  ];
  const kw = (W - M * 2 - 9) / 4;
  kpis.forEach((k, i) => {
    const x = M + i * (kw + 3);
    doc.setFillColor(248, 250, 252); doc.roundedRect(x, y, kw, 22, 2, 2, 'F');
    doc.setTextColor(...SLATE); doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    doc.text(k.v, x + kw / 2, y + 11, { align: 'center' });
    doc.setTextColor(...MUT); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
    doc.text(k.l.toUpperCase(), x + kw / 2, y + 17.5, { align: 'center' });
  });
  y += 32;

  // Barra horizontal genérica
  const barRow = (label: string, value: number, max: number, color: RGB, suffix = '') => {
    const labelW = 58, barX = M + labelW, barW = W - M - barX - 16;
    doc.setTextColor(...SLATE); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(label, M, y + 3.4);
    doc.setFillColor(241, 245, 249); doc.roundedRect(barX, y, barW, 5, 1, 1, 'F');
    const w = max > 0 ? Math.max(1.5, barW * value / max) : 1.5;
    doc.setFillColor(...color); doc.roundedRect(barX, y, w, 5, 1, 1, 'F');
    doc.setTextColor(...SLATE); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text(`${value}${suffix}`, W - M, y + 3.4, { align: 'right' });
    y += 8.5;
  };

  // Distribuição por faixa de maturidade
  sectionTitle('Distribuição por faixa de maturidade');
  const bandsObj = r.bands || {};
  BANDS.forEach(b => barRow(b.label, bandsObj[b.key] || 0, r.n, b.color, ''));
  y += 3;

  // Média por pilar
  sectionTitle('Média por pilar (0–100)');
  const pilMap: any = Object.fromEntries((r.pillars || []).map((p: any) => [p.key, p.avg]));
  PILLARS.forEach(p => { if (pilMap[p.key] != null) barRow(p.label, pilMap[p.key], 100, AMBER); });
  y += 3;

  // Certificações
  sectionTitle('Certificações válidas');
  const byLevel = r.seals?.by_level || {};
  const sx = M; const boxW = (W - M * 2 - 12) / 3;
  SEALS.forEach((s, i) => {
    const x = sx + i * (boxW + 6);
    doc.setDrawColor(...s.color); doc.setLineWidth(0.5); doc.roundedRect(x, y, boxW, 20, 2, 2, 'S');
    doc.setTextColor(...s.color); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text(String(byLevel[s.key] || 0), x + boxW / 2, y + 10, { align: 'center' });
    doc.setFontSize(7); doc.text(`SELO ${s.label.toUpperCase()}`, x + boxW / 2, y + 15.5, { align: 'center' });
  });
  y += 28;

  // Evolução
  sectionTitle('Evolução dos conselhos');
  const e = r.evolution;
  doc.setTextColor(...MUT); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  if (!e || e.insufficient) {
    doc.text('Base de histórico ainda em formação — estatísticas de evolução disponíveis conforme os conselhos acumulam registros.', M, y + 3, { maxWidth: W - M * 2 });
    y += 12;
  } else {
    const pctImp = e.n ? Math.round(e.improved / e.n * 100) : 0;
    doc.setTextColor(...SLATE); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(`${pctImp}% dos conselhos com histórico melhoraram a nota`, M, y + 3);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUT);
    doc.text(`Ganho médio de ${e.avg_delta > 0 ? '+' : ''}${e.avg_delta} pontos (mediana ${e.median_delta > 0 ? '+' : ''}${e.median_delta}) · base de ${e.n} conselhos.`, M, y + 9);
    y += 16;
  }

  // Rodapé
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, H - 20, W - M, H - 20);
  doc.setTextColor(...MUT); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.text('Dados anônimos e agregados da plataforma Boardplan. Nenhuma empresa é identificada. Índice de maturidade combina sinais automáticos de funcionamento do conselho e da gestão com o diagnóstico dos instrumentos de governança.', M, H - 15, { maxWidth: W - M * 2 });
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...SLATE);
  doc.text('INEPAD Governança e Sucessão', M, H - 6);

  doc.save(`Estado_da_Governanca_${year}.pdf`);
}
