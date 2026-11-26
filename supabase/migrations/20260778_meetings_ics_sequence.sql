-- Contador de versão do convite de calendário (iCalendar SEQUENCE) por reunião.
-- Reenviar um convite incrementa este número → a agenda do participante ATUALIZA
-- o evento existente (mesmo UID) em vez de criar um evento duplicado.
-- Começa em 0 (igual ao convite original, que sempre ia com SEQUENCE:0); o 1º
-- reenvio manda SEQUENCE:1 (> 0), então atualiza inclusive reuniões antigas.
-- Portável: só ADD COLUMN, não toca policies (vale para prod e develop).
alter table public.meetings
  add column if not exists ics_sequence integer not null default 0;
