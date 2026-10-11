// Zugangsdaten zum Supabase-Projekt (Settings → API).
// Beide Werte sind öffentlich und dürfen in der App stehen.
// Solange sie leer sind, läuft die App im Demo-Modus mit Beispieldaten.
export const SUPABASE_URL = 'https://igfelgxeiygndnkcznar.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_7-mPe-7XHSKpuwskeeTT3A_c5QvJ8nv';

export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;
