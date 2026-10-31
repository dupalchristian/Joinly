const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
const MON_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const dayDiff = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
export const hhmm = (d) => new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

export function dayLabel(d, now = new Date()) {
  const diff = dayDiff(d, now);
  const date = `${WD[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}`;
  if (diff === 0) return `Heute · ${date}`;
  if (diff === 1) return `Morgen · ${date}`;
  return date;
}

export const dayChip = (d, now = new Date()) => dayDiff(d, now) === 0 ? 'Heute' : dayDiff(d, now) === 1 ? 'Morgen' : WD_SHORT[d.getDay()];
export const longDate = (d) => `${WD[d.getDay()]}, ${d.getDate()}. ${MON_LONG[d.getMonth()]}`;
export const dayName = (d, now = new Date()) => dayDiff(d, now) === 0 ? 'heute' : dayDiff(d, now) === 1 ? 'morgen' : WD[d.getDay()];

export function timeOptions() {
  const out = [];
  for (let h = 5; h < 24; h++) for (const m of [0, 30]) out.push(`${String(h).padStart(2, '0')}:${m ? '30' : '00'}`);
  return out;
}

export function combine(day, time) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(day); d.setHours(h, m, 0, 0);
  return d;
}

export function nextHalfHour(now = new Date()) {
  const d = new Date(now);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return hhmm(d);
}

export const shortDate = (d) => `${WD_SHORT[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}`;
export const withYear = (d, now = new Date()) => d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '';

// Geht über mehrere Tage? (Ende kurz nach Mitternacht zählt noch zum Vortag)
export const multiDay = (s) => dayDiff(new Date(new Date(s.ends_at).getTime() - 60000), new Date(s.starts_at)) > 0;

// „Heute · Sa, 1. Nov. · 10:00 – 12:00 Uhr“ oder bei mehreren Tagen „Sa, 7. Aug. – Sa, 14. Aug. 2027“
export function whenText(s, now = new Date()) {
  const a = new Date(s.starts_at);
  if (!multiDay(s)) return `${dayLabel(a, now)}${withYear(a, now)} · ${hhmm(a)} – ${hhmm(s.ends_at)} Uhr`;
  const b = new Date(new Date(s.ends_at).getTime() - 60000);
  return `${shortDate(a)} – ${shortDate(b)}${withYear(b, now)}`;
}

// Zeitraum als Text, z. B. für Terminvorschläge: „Sa, 7. Aug. – Sa, 14. Aug. 2027“ (Datumswerte als „YYYY-MM-DD“)
export const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function rangeText(fromKey, toKey, now = new Date()) {
  const a = parseDay(fromKey), b = parseDay(toKey);
  if (fromKey === toKey) return `${shortDate(a)}${withYear(a, now)}`;
  return `${shortDate(a)} – ${shortDate(b)}${withYear(b, now)}`;
}
export const MONTH_NAMES = MON_LONG;
