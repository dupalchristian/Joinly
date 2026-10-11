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
