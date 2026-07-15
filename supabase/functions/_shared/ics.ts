// Gerador de arquivos .ics (iCalendar / RFC 5545) para convites de reunião com RSVP.
// Brasil usa UTC-3 fixo (sem horário de verão desde 2019), então convertemos
// o horário local de Brasília para UTC somando 3 horas.

export interface ICSEvent {
  uid: string;
  title: string;
  date: string;       // 'YYYY-MM-DD'
  time?: string;      // 'HH:MM' (horário de Brasília)
  durationMin?: number;
  location?: string;
  description?: string;
}

export interface ICSAttendee {
  name?: string;
  email: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Converte data/hora local (America/Sao_Paulo, UTC-3) para um objeto Date em UTC.
function localToUTC(date: string, time = '09:00'): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '09:00').split(':').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, (hh || 0) + 3, mm || 0, 0));
}

// Formata um Date (UTC) no padrão iCal: YYYYMMDDTHHMMSSZ
function fmt(dt: Date): string {
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`;
}

// Escapa caracteres especiais conforme RFC 5545
const esc = (s: string) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

export function buildICS(
  events: ICSEvent[],
  attendees: ICSAttendee[],
  organizer: { name: string; email: string },
  method: 'REQUEST' | 'PUBLISH' = 'REQUEST',
): string {
  const dtstamp = fmt(new Date());

  const attendeeLines = attendees
    .filter((a) => a.email)
    .map(
      (a) =>
        `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${esc(a.name || a.email)}:mailto:${a.email}`,
    );

  const vevents = events.flatMap((ev) => {
    const start = localToUTC(ev.date, ev.time);
    const end = new Date(start.getTime() + (ev.durationMin || 120) * 60000);
    return [
      'BEGIN:VEVENT',
      `UID:${ev.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${esc(ev.title)}`,
      ev.location ? `LOCATION:${esc(ev.location)}` : '',
      ev.description ? `DESCRIPTION:${esc(ev.description)}` : '',
      `ORGANIZER;CN=${esc(organizer.name)}:mailto:${organizer.email}`,
      ...attendeeLines,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'SEQUENCE:0',
      'END:VEVENT',
    ].filter(Boolean);
  });

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//INEPAD//Boardplan//PT-BR',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    ...vevents,
    'END:VCALENDAR',
  ];

  // RFC 5545 exige quebras de linha CRLF
  return lines.join('\r\n');
}

// Converte o texto .ics em base64 (UTF-8) para anexar via API do Resend.
export function icsToBase64(ics: string): string {
  const bytes = new TextEncoder().encode(ics);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
