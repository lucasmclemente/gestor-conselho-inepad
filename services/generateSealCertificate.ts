import jsPDF from 'jspdf';
import QRCode from 'qrcode';

type RGB = [number, number, number];
const SLATE: RGB = [15, 23, 42];
const AMBER: RGB = [217, 119, 6];
const MUT: RGB = [100, 116, 139];

const TIER: Record<string, { label: string; color: RGB }> = {
  ouro: { label: 'Ouro', color: [180, 83, 9] },
  prata: { label: 'Prata', color: [71, 85, 105] },
  bronze: { label: 'Bronze', color: [154, 52, 18] },
};

const fmt = (d: string) => { try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return '—'; } };

export async function generateSealCertificate(
  seal: { client_name: string; level: string; issued_at: string; valid_until: string; verification_code: string; issued_by?: string },
  verifyUrl: string,
) {
  const t = TIER[seal.level] || TIER.bronze;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();   // ~297
  const H = doc.internal.pageSize.getHeight();  // ~210

  // Fundo + moldura
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, W, H, 'F');
  doc.setDrawColor(...t.color); doc.setLineWidth(2); doc.rect(8, 8, W - 16, H - 16);
  doc.setLineWidth(0.4); doc.setDrawColor(203, 213, 225); doc.rect(11, 11, W - 22, H - 22);
  // Faixa superior fina
  doc.setFillColor(...t.color); doc.rect(11, 11, W - 22, 2.2, 'F');

  // Cabeçalho
  doc.setTextColor(...SLATE); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text('INEPAD GOVERNANÇA E SUCESSÃO', W / 2, 27, { align: 'center' });
  doc.setTextColor(...AMBER); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('SELO DE GOVERNANÇA · BOARDPLAN', W / 2, 33, { align: 'center' });

  // Título
  doc.setTextColor(...SLATE); doc.setFont('helvetica', 'bold'); doc.setFontSize(30);
  doc.text('Certificado de Governança', W / 2, 58, { align: 'center' });

  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(...MUT);
  doc.text('A INEPAD Governança e Sucessão certifica que', W / 2, 74, { align: 'center' });

  // Nome do cliente
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor(...SLATE);
  doc.text(String(seal.client_name || '').toUpperCase(), W / 2, 90, { align: 'center' });

  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(...MUT);
  doc.text('atingiu o nível de maturidade de governança corporativa', W / 2, 101, { align: 'center' });

  // Emblema do nível
  const cx = W / 2, cy = 128, rr = 17;
  doc.setFillColor(...t.color); doc.circle(cx, cy, rr, 'F');
  doc.setFillColor(255, 255, 255); doc.circle(cx, cy, rr - 3.5, 'S');
  doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.8); doc.circle(cx, cy, rr - 3.5, 'S');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text(t.label.toUpperCase(), cx, cy + 2, { align: 'center' });

  doc.setTextColor(...t.color); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(`Selo ${t.label}`, W / 2, cy + 30, { align: 'center' });

  // Datas
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...MUT);
  doc.text(`Emitido em ${fmt(seal.issued_at)}   ·   Válido até ${fmt(seal.valid_until)}`, W / 2, 178, { align: 'center' });

  // QR + verificação (rodapé direito)
  try {
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240 });
    doc.addImage(qr, 'PNG', W - 52, H - 54, 30, 30);
    doc.setFontSize(7); doc.setTextColor(...MUT);
    doc.text('Verifique a autenticidade', W - 37, H - 20, { align: 'center' });
  } catch { /* sem QR se falhar */ }

  // Código + link (rodapé esquerdo)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...SLATE);
  doc.text(`Código: ${seal.verification_code}`, 22, H - 24);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUT);
  doc.text(verifyUrl, 22, H - 19);
  if (seal.issued_by) doc.text(`Emitido por: ${seal.issued_by}`, 22, H - 14);

  doc.save(`Certificado_Governanca_${seal.verification_code}.pdf`);
}
