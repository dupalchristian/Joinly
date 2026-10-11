// Zugangsdaten zum Supabase-Projekt (Settings → API).
// Beide Werte sind öffentlich und dürfen in der App stehen.
// Solange sie leer sind, läuft die App im Demo-Modus mit Beispieldaten.
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;
