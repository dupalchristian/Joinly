// Kalender-Export: Apple bekommt eine .ics-Datei, alle anderen den Google-Kalender
import { isApple } from './services.js';

const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (t = '') => String(t).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

export function calendarLink(s, title) {
  const where = [s.place_name, s.place_address].filter(Boolean).join(', ');
  const text = `${title} (Joinly)`;
  const details = [s.note, 'Geplant mit Joinly'].filter(Boolean).join('\n');
  if (!isApple()) {
    const q = new URLSearchParams({ action: 'TEMPLATE', text, dates: `${stamp(s.starts_at)}/${stamp(s.ends_at)}`, details, location: where });
    return { href: 'https://calendar.google.com/calendar/render?' + q, label: 'In Google Kalender' };
  }
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Joinly//DE', 'BEGIN:VEVENT',
    `UID:${s.id}@joinly`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(s.starts_at)}`, `DTEND:${stamp(s.ends_at)}`,
    `SUMMARY:${esc(text)}`, where && `LOCATION:${esc(where)}`, `DESCRIPTION:${esc(details)}`,
    'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  return { href: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics), label: 'In Kalender eintragen', download: 'joinly.ics' };
}
