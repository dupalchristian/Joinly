// Letzte Daten auf dem Handy merken, damit die App sofort etwas zeigt (danach wird live nachgeladen)
const PREFIX = 'joinly-cache:';
export function readCache(key) {
  try { return JSON.parse(localStorage.getItem(PREFIX + key)); } catch { return null; }
}
export function writeCache(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* voll oder gesperrt: egal */ }
}
export function clearCache() {
  try { Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k)); } catch { /* egal */ }
}
