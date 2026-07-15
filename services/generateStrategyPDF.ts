import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const SLATE: [number, number, number] = [15, 23, 42];
const AMBER: [number, number, number] = [217, 119, 6];
const GREEN: [number, number, number] = [16, 185, 129];
const YELLOW: [number, number, number] = [245, 158, 11];
const RED: [number, number, number] = [220, 38, 38];
const MUT: [number, number, number] = [100, 116, 139];

const farolLabel = (lvl: number) => lvl === 2 ? 'Crítico' : lvl === 1 ? 'Atenção' : 'No alvo';
const farolColor = (lvl: number) => lvl === 2 ? RED : lvl === 1 ? YELLOW : GREEN;

type StrategyData = {
  clientName: string;
  framework: { mission?: string; vision?: string; values_text?: string; success_factors?: string };
  perspectives: { id: string; name: string }[];
  objectives: { id: string; name: string; perspective_id: string; farol: number }[];
  indicators: { name: string; current: any; meta: any; unit?: string; lvl: number }[];
  okr: { cycleName: string; objectives: { name: string; progress: number; krs: { name: string; pct: number; conf?: string }[] }[] }[];
};

export function generateStrategyPDF(data: StrategyData) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 0;

  const ensure = (need: number) => { if (y + need > H - 14) { doc.addPage(); y = 16; } };
  const heading = (t: string) => {
    ensure(16); doc.setFillColor(241, 245, 249); doc.rect(12, y, W - 24, 8, 'F');
    doc.setTextColor(...SLATE); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(t.toUpperCase(), 15, y + 5.6); y += 13;
  };
  const para = (label: string, text?: string) => {
    if (!text) return; ensure(14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...AMBER); doc.text(label.toUpperCase(), 14, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(text, W - 28); y += 5;
    lines.forEach((ln: string) => { ensure(6); doc.text(ln, 14, y); y += 5; }); y += 3;
  };

  // Cabeçalho
  doc.setFillColor(...SLATE); doc.rect(0, 0, W, 34, 'F');
  doc.setFillColor(...AMBER); doc.rect(0, 34, W, 1.4, 'F');
  doc.setTextColor(251, 191, 36); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('INEPAD CONSULTORIA · GOVCORP', 14, 12);
  doc.setTextColor(255, 255, 255); doc.setFontSize(19); doc.text('Planejamento Estratégico', 14, 23);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(203, 213, 225);
  doc.text(`${data.clientName}  ·  ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
  y = 44;

  // Identidade
  heading('Identidade Estratégica');
  para('Missão', data.framework?.mission);
  para('Visão', data.framework?.vision);
  para('Valores', data.framework?.values_text);
  para('Fatores de sucesso', data.framework?.success_factors);
  if (!data.framework?.mission && !data.framework?.vision) { doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...MUT); doc.text('Não definida.', 14, y); y += 8; }

  // Objetivos por perspectiva
  heading('Mapa Estratégico — Objetivos por Perspectiva');
  const objRows: any[] = [];
  data.perspectives.forEach(p => {
    const objs = data.objectives.filter(o => o.perspective_id === p.id);
    if (objs.length === 0) objRows.push([p.name, '—', '']);
    else objs.forEach((o, i) => objRows.push([i === 0 ? p.name : '', o.name, farolLabel(o.farol)]));
  });
  if (objRows.length === 0) objRows.push(['—', 'Nenhum objetivo cadastrado', '']);
  autoTable(doc, {
    startY: y, margin: { left: 12, right: 12 },
    head: [['Perspectiva', 'Objetivo', 'Farol']],
    body: objRows,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: SLATE, textColor: [251, 191, 36], fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 2: { cellWidth: 24, halign: 'center', fontStyle: 'bold' } },
    didParseCell: (h: any) => { if (h.section === 'body' && h.column.index === 2) { const lvl = h.cell.raw === 'Crítico' ? 2 : h.cell.raw === 'Atenção' ? 1 : 0; h.cell.styles.textColor = farolColor(lvl); } },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Indicadores
  heading('Indicadores — Realizado × Meta');
  const indRows = data.indicators.map(i => [i.name, i.current == null ? '—' : `${i.current}${i.unit ? ' ' + i.unit : ''}`, i.meta == null ? '—' : `${i.meta}${i.unit ? ' ' + i.unit : ''}`, farolLabel(i.lvl)]);
  autoTable(doc, {
    startY: y, margin: { left: 12, right: 12 },
    head: [['Indicador', 'Realizado', 'Meta', 'Farol']],
    body: indRows.length ? indRows : [['Nenhum indicador cadastrado', '', '', '']],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: SLATE, textColor: [251, 191, 36], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { cellWidth: 24, halign: 'center', fontStyle: 'bold' } },
    didParseCell: (h: any) => { if (h.section === 'body' && h.column.index === 3) { const lvl = h.cell.raw === 'Crítico' ? 2 : h.cell.raw === 'Atenção' ? 1 : 0; h.cell.styles.textColor = farolColor(lvl); } },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // OKRs
  data.okr.forEach(cy => {
    heading(`OKRs — ${cy.cycleName}`);
    cy.objectives.forEach(o => {
      ensure(10); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...SLATE);
      doc.text(`${o.name}  (${o.progress}%)`, 14, y); y += 6;
      o.krs.forEach(k => { ensure(6); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105); doc.text(`•  ${k.name} — ${k.pct}%`, 18, y); y += 5; });
      y += 3;
    });
  });

  // Rodapé
  const pages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...MUT);
    doc.text('Boardplan — INEPAD Consultoria', 14, H - 8);
    doc.text(`${i}/${pages}`, W - 20, H - 8);
  }

  doc.save(`Planejamento_Estrategico_${data.clientName}.pdf`);
}
