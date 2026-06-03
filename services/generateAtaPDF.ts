import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Paleta de cores (espelha o app e o generateMeetingPDF) ────────
const C = {
  primary:    [15,  23,  42]  as [number, number, number], // slate-900
  accent:     [217, 119,  6]  as [number, number, number], // amber-600
  accentLight:[251, 191, 36]  as [number, number, number], // amber-300
  white:      [255, 255, 255] as [number, number, number],
  light:      [248, 250, 252] as [number, number, number], // slate-50
  medium:     [148, 163, 184] as [number, number, number], // slate-400
  border:     [226, 232, 240] as [number, number, number], // slate-200
  green:      [16,  185, 129] as [number, number, number], // emerald-500
  red:        [239,  68,  68] as [number, number, number], // red-500
  yellow:     [245, 158,  11] as [number, number, number], // amber-500
  slate600:   [71,   85, 105] as [number, number, number], // slate-600
};

// ── Carrega imagem remota como base64 ────────────────────────────
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror  = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Detecta formato da imagem a partir do data URL ───────────────
function getImageFormat(dataUrl: string): string {
  if (dataUrl.includes('image/png'))  return 'PNG';
  if (dataUrl.includes('image/gif'))  return 'GIF';
  if (dataUrl.includes('image/webp')) return 'WEBP';
  return 'JPEG';
}

// ── Função principal (async para permitir fetch da logo) ──────────
export async function generateAtaPDF(
  meeting: any,
  clientName: string,
  logoUrl?: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W  = doc.internal.pageSize.getWidth();
  const H  = doc.internal.pageSize.getHeight();
  const ML = 15;

  const now     = new Date();
  const genDate = now.toLocaleDateString('pt-BR');
  const genTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Tenta carregar o logotipo
  let logoBase64: string | null = null;
  if (logoUrl) {
    logoBase64 = await fetchImageAsBase64(logoUrl);
  }

  // ── Cabeçalho ─────────────────────────────────────────────────
  let y = buildAtaHeader(doc, W, ML, clientName, meeting.type || '', logoBase64);

  // Título da reunião
  doc.setTextColor(...C.primary);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(meeting.title || 'Reunião', W - ML * 2);
  doc.text(titleLines, ML, y);
  y += titleLines.length * 6.5 + 7;

  // ── Seção 1: Identificação ────────────────────────────────────
  y = addSectionHeader(doc, 'IDENTIFICAÇÃO DA REUNIÃO', y, W, ML);

  const infoItems: [string, string][] = [
    ['Data',       meeting.date ? formatDate(meeting.date) : 'Não definida'],
    ['Horário',    meeting.time || 'Não definido'],
    ['Modalidade', meeting.type || 'N/D'],
  ];
  if (meeting.address) infoItems.push(['Local', meeting.address]);
  if (meeting.link)    infoItems.push(['Link',  meeting.link]);
  y = drawInfoGrid(doc, infoItems, y, W, ML);

  // ── Seção 2: Presença ─────────────────────────────────────────
  const participants: any[] = meeting.participants || [];
  const presentes = participants.filter((p: any) => p.present !== false);
  const ausentes  = participants.filter((p: any) => p.present === false);

  y = checkPageBreak(doc, y, 30, H, W, ML, meeting.title);
  y = addSectionHeader(doc, 'PRESENÇA', y, W, ML);

  const maxRows = Math.max(presentes.length, ausentes.length, 1);
  const presBody: [string, string][] = Array.from({ length: maxRows }, (_, i) => [
    presentes[i]?.name ?? '',
    ausentes[i]?.name  ?? '',
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: ML },
    head:   [[`PRESENTES (${presentes.length})`, `AUSENTES (${ausentes.length})`]],
    body:   presBody,
    styles:     { fontSize: 7.5, cellPadding: 3 },
    headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.light },
    didParseCell(data) {
      if (data.section === 'body') {
        if (data.column.index === 0 && data.cell.raw) {
          data.cell.styles.textColor = C.primary as any;
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 1 && data.cell.raw) {
          data.cell.styles.textColor = C.red as any;
        }
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Seção 3: Ordem do Dia + Discussões ────────────────────────
  const pautas: any[] = meeting.pautas || [];
  if (pautas.length > 0) {
    y = checkPageBreak(doc, y, 30, H, W, ML, meeting.title);
    y = addSectionHeader(doc, 'ORDEM DO DIA E DISCUSSÕES', y, W, ML);

    for (let i = 0; i < pautas.length; i++) {
      const p = pautas[i];
      y = checkPageBreak(doc, y, 28, H, W, ML, meeting.title);

      // Título da pauta
      doc.setFillColor(...C.light);
      doc.rect(ML, y, W - ML * 2, 9, 'F');
      doc.setFillColor(...C.accent);
      doc.rect(ML, y, 3, 9, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...C.primary);
      const maxPW = p.resp ? W - ML * 2 - 45 : W - ML * 2 - 8;
      const pTitleLines = doc.splitTextToSize(`${i + 1}. ${p.title || ''}`, maxPW);
      doc.text(pTitleLines[0], ML + 7, y + 6);
      if (p.resp) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...C.medium);
        doc.text(`Resp.: ${p.resp}`, W - ML, y + 6, { align: 'right' });
      }
      y += 12;

      // Notas de discussão
      const notes: string = (p.notes || '').trim();
      if (notes) {
        const noteLines = doc.splitTextToSize(notes, W - ML * 2 - 8);
        const noteH = Math.max(noteLines.length * 4.5 + 10, 16);
        y = checkPageBreak(doc, y, noteH + 4, H, W, ML, meeting.title);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...C.border);
        doc.setLineDashPattern([], 0);
        doc.rect(ML, y, W - ML * 2, noteH, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.slate600);
        doc.text(noteLines, ML + 4, y + 6);
        y += noteH + 5;
      } else {
        // Caixa vazia tracejada para anotações manuais
        y = checkPageBreak(doc, y, 18, H, W, ML, meeting.title);
        doc.setDrawColor(...C.border);
        doc.setLineDashPattern([1, 2], 0);
        doc.rect(ML, y, W - ML * 2, 14, 'D');
        doc.setLineDashPattern([], 0);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(...C.medium);
        doc.text('Sem notas de discussão registradas.', ML + 4, y + 8.5);
        y += 18;
      }
    }
  }

  // ── Seção 4: Deliberações ─────────────────────────────────────
  const deliberacoes: any[] = meeting.deliberacoes || [];
  if (deliberacoes.length > 0) {
    y = checkPageBreak(doc, y, 30, H, W, ML, meeting.title);
    y = addSectionHeader(doc, 'DELIBERAÇÕES', y, W, ML);

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: ML },
      head:   [['Proposição', 'Favor', 'Contra', 'Abstenção', 'Resultado']],
      body:   deliberacoes.map((d: any) => {
        const voters: string[]             = d.voters || [];
        const votes: Record<string, string> = d.votes  || {};
        const favor = voters.filter(v => votes[v] === 'Favor').length;
        const contra = voters.filter(v => votes[v] === 'Contra').length;
        const abst   = voters.filter(v => votes[v] === 'Abstenção').length;
        const pend   = voters.length - favor - contra - abst;
        const result =
          voters.length === 0 ? '—'
          : pend > 0          ? 'EM VOTAÇÃO'
          : favor > contra    ? 'APROVADA'
          : contra > favor    ? 'REJEITADA'
                              : 'EMPATE';
        return [d.title || '', String(favor), String(contra), String(abst), result];
      }),
      styles:     { fontSize: 7.5, cellPadding: 3 },
      headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.light },
      columnStyles: {
        1: { halign: 'center', cellWidth: 15 },
        2: { halign: 'center', cellWidth: 15 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'center', cellWidth: 26 },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 4) {
          const val = data.cell.raw as string;
          data.cell.styles.fontStyle = 'bold';
          if      (val === 'APROVADA')   data.cell.styles.textColor = C.green  as any;
          else if (val === 'REJEITADA')  data.cell.styles.textColor = C.red    as any;
          else if (val === 'EM VOTAÇÃO') data.cell.styles.textColor = C.yellow as any;
          else                           data.cell.styles.textColor = C.medium as any;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Seção 5: Plano de Ações ───────────────────────────────────
  const acoes: any[] = meeting.acoes || [];
  if (acoes.length > 0) {
    y = checkPageBreak(doc, y, 30, H, W, ML, meeting.title);
    y = addSectionHeader(doc, 'PLANO DE AÇÕES', y, W, ML);

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: ML },
      head:   [['Ação', 'Responsável(is)', 'Prazo', 'Status']],
      body:   acoes.map((a: any) => {
        const resps: string[] = a.resps?.length > 0 ? a.resps : (a.resp ? [a.resp] : []);
        return [
          a.title || '',
          resps.join(', ') || '—',
          a.date ? formatDate(a.date) : '—',
          a.status || 'Pendente',
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
          data.cell.styles.fontStyle = 'bold';
          if      (val === 'Concluída')    data.cell.styles.textColor = C.green  as any;
          else if (val === 'Em Andamento') data.cell.styles.textColor = C.yellow as any;
          else                             data.cell.styles.textColor = C.medium as any;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Seção 6: Assinaturas ──────────────────────────────────────
  if (presentes.length > 0) {
    y = checkPageBreak(doc, y, 50, H, W, ML, meeting.title);
    y = addSectionHeader(doc, 'ASSINATURAS', y, W, ML);

    const SIG_W = (W - ML * 2 - 10) / 2;
    const SIG_H = 28;

    for (let i = 0; i < presentes.length; i++) {
      const col    = i % 2;
      const row    = Math.floor(i / 2);
      // Nova linha: checka page break antes de cada linha par
      if (col === 0 && row > 0) {
        y = checkPageBreak(doc, y, SIG_H + 6, H, W, ML, meeting.title);
      }
      const sx = ML + col * (SIG_W + 10);
      const sy = y + row * (SIG_H + 6);

      // Linha de assinatura
      doc.setDrawColor(...C.border);
      doc.setLineDashPattern([], 0);
      doc.line(sx, sy + SIG_H - 10, sx + SIG_W, sy + SIG_H - 10);

      // Nome
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.primary);
      const nameLines = doc.splitTextToSize(presentes[i].name, SIG_W - 4);
      doc.text(nameLines[0], sx + SIG_W / 2, sy + SIG_H - 4, { align: 'center' });

      // E-mail
      if (presentes[i].email) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...C.medium);
        doc.text(presentes[i].email, sx + SIG_W / 2, sy + SIG_H, { align: 'center' });
      }
    }

    const totalRows = Math.ceil(presentes.length / 2);
    y += totalRows * (SIG_H + 6) + 6;
  }

  // ── Rodapé em todas as páginas ────────────────────────────────
  addAtaFooters(doc, W, H, ML, genDate, genTime, clientName);

  // ── Salvar ────────────────────────────────────────────────────
  const safe = (meeting.title || 'ata')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  doc.save(`ata-${safe}-${now.toISOString().slice(0, 10)}.pdf`);
}

// ── Helpers ───────────────────────────────────────────────────────

function buildAtaHeader(
  doc: jsPDF, W: number, ML: number,
  clientName: string, meetingType: string,
  logoBase64: string | null
): number {
  const H_BAR = 42;

  // Barra escura
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, W, H_BAR, 'F');

  // Faixa amber esquerda
  doc.setFillColor(...C.accent);
  doc.rect(0, 0, 4, H_BAR, 'F');

  // Linha amber inferior
  doc.setFillColor(...C.accent);
  doc.rect(0, H_BAR, W, 2.5, 'F');

  const ataTitle = meetingType
    ? `ATA DE REUNIÃO DE ${meetingType.toUpperCase()}`
    : 'ATA DE REUNIÃO DE CONSELHO';

  // Logo (se disponível)
  if (logoBase64) {
    try {
      const fmt = getImageFormat(logoBase64);
      doc.addImage(logoBase64, fmt, ML + 4, 7, 22, 14, '', 'FAST');
    } catch {
      // Ignora silenciosamente
    }

    const tx = ML + 30;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.medium);
    doc.text('GovCorp — Plataforma de Gestão de Conselhos', tx, 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...C.white);
    doc.text(ataTitle, tx, 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.accentLight);
    doc.text(clientName.toUpperCase(), tx, 31);
  } else {
    const tx = ML + 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.medium);
    doc.text('GovCorp — Plataforma de Gestão de Conselhos', tx, 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...C.white);
    doc.text(ataTitle, tx, 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.accentLight);
    doc.text(clientName.toUpperCase(), tx, 32);
  }

  // Data geração (canto direito)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.medium);
  doc.text('Gerado em', W - ML, 20, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(...C.white);
  doc.text(new Date().toLocaleDateString('pt-BR'), W - ML, 27, { align: 'right' });

  return H_BAR + 8;
}

function addSectionHeader(doc: jsPDF, title: string, y: number, W: number, ML: number): number {
  const ROW_H = 10;
  doc.setFillColor(...C.light);
  doc.rect(ML, y, W - ML * 2, ROW_H, 'F');
  doc.setFillColor(...C.accent);
  doc.rect(ML, y, 3.5, ROW_H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.primary);
  doc.text(title, ML + 8, y + 6.8);
  doc.setFillColor(...C.accent);
  doc.rect(ML, y + ROW_H, W - ML * 2, 0.7, 'F');
  return y + ROW_H + 7;
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
    const cx  = ML + col * colW;
    const cy  = y + row * rowH;
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
    // Mini cabeçalho
    doc.setFillColor(...C.primary);
    doc.rect(0, 0, W, 12, 'F');
    doc.setFillColor(...C.accent);
    doc.rect(0, 10.5, W, 1.5, 'F');
    doc.setTextColor(...C.white);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('ATA DE REUNIÃO', ML, 7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.medium);
    const ts = (meetingTitle || '').length > 55 ? meetingTitle.slice(0, 52) + '...' : (meetingTitle || '');
    doc.text(ts, W - ML, 7.5, { align: 'right' });
    return 20;
  }
  return y;
}

function addAtaFooters(
  doc: jsPDF, W: number, H: number, ML: number,
  genDate: string, genTime: string, clientName: string
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
      `GovCorp — Ata de Reunião | ${clientName} | Gerado em ${genDate} às ${genTime}`,
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
