import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Paleta de cores (espelha o Tailwind do app) ──────────────────
const C = {
  primary:   [15,  23,  42]  as [number, number, number], // slate-900
  accent:    [217, 119,  6]  as [number, number, number], // amber-600
  accentLight:[251, 191, 36] as [number, number, number], // amber-300
  white:     [255, 255, 255] as [number, number, number],
  light:     [248, 250, 252] as [number, number, number], // slate-50
  medium:    [148, 163, 184] as [number, number, number], // slate-400
  border:    [226, 232, 240] as [number, number, number], // slate-200
  green:     [16,  185, 129] as [number, number, number], // emerald-500
  red:       [239,  68,  68] as [number, number, number], // red-500
  yellow:    [245, 158,  11] as [number, number, number], // amber-500
  indigo:    [99,  102, 241] as [number, number, number], // indigo-500
  slate600:  [71,   85, 105] as [number, number, number], // slate-600
};

// ── Função principal ─────────────────────────────────────────────
export function generateMeetingPDF(meeting: any, clientName: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W  = doc.internal.pageSize.getWidth();
  const H  = doc.internal.pageSize.getHeight();
  const ML = 15; // margin left/right

  const now     = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  let y = buildFirstPageHeader(doc, W, ML, clientName, dateStr, timeStr);

  // ── Título da reunião ─────────────────────────────────────────
  doc.setTextColor(...C.primary);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(meeting.title || 'Reunião sem título', W - ML * 2);
  doc.text(titleLines, ML, y);
  y += titleLines.length * 7 + 4;

  // Badge de status
  y = drawStatusBadge(doc, meeting.status || 'N/D', ML, y);
  y += 6;

  // ── Seção 1: Dados da Reunião ─────────────────────────────────
  y = addSectionHeader(doc, 'DADOS DA REUNIÃO', y, W, ML);

  const infoItems: [string, string][] = [
    ['Data',       meeting.date ? formatDate(meeting.date) : 'Não definida'],
    ['Horário',    meeting.time || 'Não definido'],
    ['Modalidade', meeting.type || 'N/D'],
    ['Status',     meeting.status || 'N/D'],
  ];
  if (meeting.address) infoItems.push(['Local',      meeting.address]);
  if (meeting.link)    infoItems.push(['Link/Acesso', meeting.link]);

  y = drawInfoGrid(doc, infoItems, y, W, ML);

  // Participantes
  const participants: any[] = meeting.participants || [];
  if (participants.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.medium);
    doc.text('PARTICIPANTES', ML, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: ML },
      head: [['Nome', 'E-mail', 'Tipo']],
      body: participants.map((p: any) => [
        p.name  || '',
        p.email || '',
        p.isExternal ? 'Convidado externo' : 'Membro do conselho',
      ]),
      styles:           { fontSize: 7.5, cellPadding: 3 },
      headStyles:       { fillColor: C.primary,  textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.light },
      columnStyles:     { 2: { halign: 'center', cellWidth: 36 } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Seção 2: Ordem do Dia ─────────────────────────────────────
  const pautas: any[] = meeting.pautas || [];
  if (pautas.length > 0) {
    y = checkPageBreak(doc, y, 40, H, W, ML, meeting.title);
    y = addSectionHeader(doc, 'ORDEM DO DIA', y, W, ML);

    const totalPrev = pautas.reduce((s: number, p: any) => s + (parseInt(p.dur) || 0), 0);
    const totalReal = pautas.reduce((s: number, p: any) => s + (parseInt(p.realDur) || 0), 0);

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: ML },
      head: [['#', 'Pauta', 'Responsável', 'Prev.', 'Real.', '']],
      body: pautas.map((p: any, i: number) => [
        i + 1,
        p.title || '',
        p.resp  || '—',
        p.dur     ? `${p.dur} min`     : '—',
        p.realDur ? `${p.realDur} min` : '—',
        p.completed ? '✓' : '',
      ]),
      foot: [['', 'TOTAL', '', `${totalPrev} min`, totalReal ? `${totalReal} min` : '—', '']],
      styles:           { fontSize: 7.5, cellPadding: 3 },
      headStyles:       { fillColor: C.primary, textColor: C.white, fontStyle: 'bold' },
      footStyles:       { fillColor: C.primary, textColor: C.accentLight, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: C.light },
      columnStyles: {
        0: { halign: 'center', cellWidth: 9 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 10 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Seção 3: Deliberações ─────────────────────────────────────
  const deliberacoes: any[] = meeting.deliberacoes || [];
  if (deliberacoes.length > 0) {
    y = checkPageBreak(doc, y, 40, H, W, ML, meeting.title);
    y = addSectionHeader(doc, 'DELIBERAÇÕES', y, W, ML);

    for (const d of deliberacoes) {
      y = checkPageBreak(doc, y, 35, H, W, ML, meeting.title);

      // Título da deliberação
      doc.setFillColor(...C.light);
      doc.rect(ML, y, W - ML * 2, 8, 'F');
      doc.setDrawColor(...C.border);
      doc.rect(ML, y, W - ML * 2, 8, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...C.primary);
      const dtLines = doc.splitTextToSize(d.title || 'Deliberação', W - ML * 2 - 6);
      doc.text(dtLines[0], ML + 4, y + 5.5);
      y += 11;

      // Contagem de votos
      const voters: string[] = d.voters || [];
      const votes: Record<string, string> = d.votes || {};
      let favor = 0, contra = 0, abstencao = 0, pendente = 0;
      for (const voter of voters) {
        const v = votes[voter];
        if      (v === 'Favor')     favor++;
        else if (v === 'Contra')    contra++;
        else if (v === 'Abstenção') abstencao++;
        else pendente++;
      }

      const summary = [
        { label: 'FAVOR',    count: favor,     color: C.green  },
        { label: 'CONTRA',   count: contra,    color: C.red    },
        { label: 'ABSTENÇÃO',count: abstencao, color: C.yellow },
        { label: 'PENDENTE', count: pendente,  color: C.medium },
      ];

      let bx = ML;
      for (const s of summary) {
        doc.setFillColor(...s.color);
        doc.roundedRect(bx, y, 28, 11, 2, 2, 'F');
        doc.setTextColor(...C.white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(String(s.count), bx + 14, y + 6, { align: 'center' });
        doc.setFontSize(5.5);
        doc.text(s.label, bx + 14, y + 9.5, { align: 'center' });
        bx += 31;
      }
      y += 15;

      // Tabela de votantes
      if (voters.length > 0) {
        autoTable(doc, {
          startY: y,
          margin: { left: ML, right: ML },
          head: [['Conselheiro', 'Voto']],
          body: voters.map(v => [v, votes[v] || 'Pendente']),
          styles:     { fontSize: 7, cellPadding: 2.5 },
          headStyles: { fillColor: C.slate600, textColor: C.white, fontStyle: 'bold', fontSize: 7 },
          alternateRowStyles: { fillColor: C.light },
          columnStyles: { 1: { halign: 'center', cellWidth: 30 } },
          didParseCell(data) {
            if (data.section === 'body' && data.column.index === 1) {
              const val = data.cell.raw as string;
              if      (val === 'Favor')     data.cell.styles.textColor = C.green  as any;
              else if (val === 'Contra')    data.cell.styles.textColor = C.red    as any;
              else if (val === 'Abstenção') data.cell.styles.textColor = C.yellow as any;
              else                          data.cell.styles.textColor = C.medium as any;
              data.cell.styles.fontStyle = 'bold';
            }
          },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      } else {
        y += 4;
      }
    }
  }

  // ── Seção 4: Plano de Ações ───────────────────────────────────
  const acoes: any[] = meeting.acoes || [];
  if (acoes.length > 0) {
    y = checkPageBreak(doc, y, 40, H, W, ML, meeting.title);
    y = addSectionHeader(doc, 'PLANO DE AÇÕES', y, W, ML);

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: ML },
      head: [['Ação', 'Responsável(is)', 'Prazo', 'Status', 'Observações']],
      body: acoes.map((a: any) => {
        const resps: string[] = a.resps?.length > 0 ? a.resps : (a.resp ? [a.resp] : []);
        return [
          a.title || '',
          resps.join(', ') || '—',
          a.date ? formatDate(a.date) : '—',
          a.status || 'Pendente',
          a.obs    || '',
        ];
      }),
      styles:     { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.light },
      columnStyles: {
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'center', cellWidth: 28 },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 3) {
          const val = data.cell.raw as string;
          if      (val === 'Concluída')    data.cell.styles.textColor = C.green  as any;
          else if (val === 'Em Andamento') data.cell.styles.textColor = C.yellow as any;
          else                             data.cell.styles.textColor = C.medium as any;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
  }

  // ── Rodapé em todas as páginas ────────────────────────────────
  addFooters(doc, W, H, ML, dateStr, timeStr);

  // ── Salvar ────────────────────────────────────────────────────
  const safe = (meeting.title || 'reuniao')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  doc.save(`relatorio-${safe}-${now.toISOString().slice(0, 10)}.pdf`);
}

// ── Helpers ───────────────────────────────────────────────────────

function buildFirstPageHeader(
  doc: jsPDF, W: number, ML: number,
  clientName: string, dateStr: string, timeStr: string
): number {
  const H_BAR = 38; // altura da barra de cabeçalho

  // Barra principal escura
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, W, H_BAR, 'F');

  // Faixa amber lateral esquerda (detalhe visual)
  doc.setFillColor(...C.accent);
  doc.rect(0, 0, 4, H_BAR, 'F');

  // Linha amber inferior
  doc.setFillColor(...C.accent);
  doc.rect(0, H_BAR, W, 2.5, 'F');

  // Texto: sistema
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.medium);
  doc.text('Boardplan — Governança de Conselhos', ML + 4, 9);

  // Texto: título principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.white);
  doc.text('RELATÓRIO DE REUNIÃO', ML + 4, 21);

  // Texto: nome do cliente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.accentLight);
  doc.text(clientName.toUpperCase(), ML + 4, 30);

  // Texto: data de geração (canto direito)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.medium);
  doc.text('Gerado em', W - ML, 20, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setTextColor(...C.white);
  doc.text(`${dateStr}  ${timeStr}`, W - ML, 27, { align: 'right' });

  return H_BAR + 8; // margem após o cabeçalho
}

function addSectionHeader(doc: jsPDF, title: string, y: number, W: number, ML: number): number {
  const ROW_H = 10;
  // Fundo cinza claro
  doc.setFillColor(...C.light);
  doc.rect(ML, y, W - ML * 2, ROW_H, 'F');
  // Barra de destaque amber na esquerda
  doc.setFillColor(...C.accent);
  doc.rect(ML, y, 3.5, ROW_H, 'F');
  // Texto do título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.primary);
  doc.text(title, ML + 8, y + 6.8);
  // Linha amber fina NO RODAPÉ da barra (abaixo do texto)
  doc.setFillColor(...C.accent);
  doc.rect(ML, y + ROW_H, W - ML * 2, 0.7, 'F');
  return y + ROW_H + 7;
}

function drawStatusBadge(doc: jsPDF, status: string, x: number, y: number): number {
  const colorMap: Record<string, [number, number, number]> = {
    'Concluída':     C.green,
    'Em Andamento':  C.yellow,
    'Agendada':      C.indigo,
  };
  const color = colorMap[status] || C.medium;
  const label = status.toUpperCase();

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  const tw = doc.getTextWidth(label);
  doc.setFillColor(...color);
  doc.roundedRect(x, y, tw + 8, 6, 1.5, 1.5, 'F');
  doc.setTextColor(...C.white);
  doc.text(label, x + 4, y + 4.2);
  return y + 6;
}

function drawInfoGrid(
  doc: jsPDF,
  items: [string, string][],
  y: number,
  W: number,
  ML: number
): number {
  const colW = (W - ML * 2) / 2;
  const rowH = 9;

  for (let i = 0; i < items.length; i++) {
    const [label, value] = items[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = ML + col * colW;
    const cy = y + row * rowH;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.medium);
    doc.text(label.toUpperCase(), cx, cy);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.primary);
    const lines = doc.splitTextToSize(value, colW - 4);
    doc.text(lines[0], cx, cy + 4.5);
  }

  return y + Math.ceil(items.length / 2) * rowH + 6;
}

function checkPageBreak(
  doc: jsPDF, y: number, needed: number, H: number,
  W: number, ML: number, meetingTitle: string
): number {
  if (y + needed > H - 18) {
    doc.addPage();
    // Mini cabeçalho nas páginas de continuação
    doc.setFillColor(...C.primary);
    doc.rect(0, 0, W, 12, 'F');
    doc.setFillColor(...C.accent);
    doc.rect(0, 10.5, W, 1.5, 'F');
    doc.setTextColor(...C.white);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE REUNIÃO', ML, 7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.medium);
    const titleShort = (meetingTitle || '').length > 55
      ? meetingTitle.slice(0, 52) + '...'
      : meetingTitle || '';
    doc.text(titleShort, W - ML, 7.5, { align: 'right' });
    return 20;
  }
  return y;
}

function addFooters(
  doc: jsPDF, W: number, H: number, ML: number,
  dateStr: string, timeStr: string
) {
  const total = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.light);
    doc.rect(0, H - 11, W, 11, 'F');
    doc.setDrawColor(...C.border);
    doc.line(ML, H - 11, W - ML, H - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.medium);
    doc.text(
      `Boardplan — Governança de Conselhos | INEPAD Consultoria | ${dateStr} às ${timeStr}`,
      ML, H - 4.5
    );
    doc.text(`Página ${i} de ${total}`, W - ML, H - 4.5, { align: 'right' });
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/D';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}
