// Supabase Edge Function „joinly-push“: verschickt Push-Nachrichten.
// Wird von der Datenbank aufgerufen (neuer Status, neue Zusage).
// VAPID_PRIVATE und JOINLY_SECRET vor dem Einfügen ins Supabase-Dashboard ersetzen.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC = 'BLMbZyfZApw5sKyiWRI5c2yGFZnJDQuiX7ylwrN-rN9MrrCacjm5doFPnEJINIrrZ0FWP3gjG5VV5AOUoQ2Wga8';
const VAPID_PRIVATE = 'VAPID_PRIVATE';
const SECRET = 'JOINLY_SECRET';
const APP_URL = 'https://dupalchristian.github.io/Joinly/';

webpush.setVapidDetails(APP_URL, VAPID_PUBLIC, VAPID_PRIVATE);

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

function dayWord(iso: string) {
  const fmt = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const d = new Date(iso);
  if (fmt(d) === fmt(today)) return 'heute';
  if (fmt(d) === fmt(tomorrow)) return 'morgen';
  return d.toLocaleDateString('de-DE', { weekday: 'long', timeZone: 'Europe/Berlin' });
}

Deno.serve(async (req) => {
  if (req.headers.get('x-joinly-secret') !== SECRET) return new Response('forbidden', { status: 403 });
  const { type, record } = await req.json();
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let targets: string[] = [];
  let title = '';
  let body = '';
  let url = APP_URL;

  if (type === 'status') {
    const s = record;
    const [{ data: author }, { data: group }, { data: members }] = await Promise.all([
      sb.from('profiles').select('first_name').eq('id', s.profile_id).single(),
      sb.from('groups').select('name').eq('id', s.group_id).single(),
      sb.from('memberships').select('profile_id').eq('group_id', s.group_id).eq('status', 'active').neq('profile_id', s.profile_id)
    ]);
    const ids = (members ?? []).map((m) => m.profile_id);
    if (!ids.length) return new Response('ok');
    const { data: prefs } = await sb.from('profile_private').select('id, push_activities, push_free').in('id', ids);
    targets = (prefs ?? [])
      .filter((p) => s.kind === 'plan' ? (p.push_activities ?? []).includes(s.activity) : p.push_free !== false)
      .map((p) => p.id);
    const name = author?.first_name ?? 'Jemand';
    const where = s.place_name ? ` · ${s.place_name}` : '';
    if (s.kind === 'free') {
      title = `${name} ist gerade frei 👋`;
      body = `Bis ${time(s.ends_at)} Uhr${s.note ? ' – ' + s.note : ''}`;
    } else if (s.kind === 'open') {
      title = `${name}: Kommt vorbei! 🚪`;
      body = `${s.place_name ?? ''} bis ${time(s.ends_at)} Uhr${s.note ? ' – ' + s.note : ''}`.trim();
    } else {
      title = `${name} ist offen für ${s.activity} ${s.icon ?? ''}`.trim();
      body = `${dayWord(s.starts_at)}, ${time(s.starts_at)} – ${time(s.ends_at)} Uhr${where}`;
    }
    if (group?.name) body += ` (${group.name})`;
    url = `${APP_URL}?status=${s.id}`;
  } else if (type === 'join') {
    const { data: s } = await sb.from('statuses').select('id, profile_id, activity, kind').eq('id', record.status_id).single();
    if (!s || s.profile_id === record.profile_id) return new Response('ok');
    const { data: who } = await sb.from('profiles').select('first_name').eq('id', record.profile_id).single();
    targets = [s.profile_id];
    title = s.kind === 'open' ? `${who?.first_name ?? 'Jemand'} kommt vorbei` : `${who?.first_name ?? 'Jemand'} ist dabei ✓`;
    body = s.kind === 'plan' ? `bei ${s.activity}` : 'Schau in Joinly, wer noch kommt.';
    url = `${APP_URL}?status=${s.id}`;
  } else {
    return new Response('unknown type', { status: 400 });
  }

  if (!targets.length) return new Response('ok');
  const { data: subs } = await sb.from('push_subscriptions').select('*').in('profile_id', targets);
  const payload = JSON.stringify({ title, body, url, tag: (record.id ?? record.status_id) + type });

  const results = await Promise.allSettled((subs ?? []).map((sub) =>
    webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600 })
      .catch(async (e) => {
        if (e.statusCode === 404 || e.statusCode === 410) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        throw e;
      })
  ));
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return new Response(JSON.stringify({ sent, of: results.length }), { headers: { 'Content-Type': 'application/json' } });
});
