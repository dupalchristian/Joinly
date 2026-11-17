// Supabase Edge Function „joinly-push“: verschickt Push-Nachrichten.
// Wird von der Datenbank aufgerufen (neuer Status, Zusage, Idee, Erinnerung …).
// VAPID_PRIVATE und JOINLY_SECRET vor dem Einfügen ins Supabase-Dashboard ersetzen.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC = 'BLMbZyfZApw5sKyiWRI5c2yGFZnJDQuiX7ylwrN-rN9MrrCacjm5doFPnEJINIrrZ0FWP3gjG5VV5AOUoQ2Wga8';
const VAPID_PRIVATE = 'VAPID_PRIVATE';
const SECRET = 'JOINLY_SECRET';
const APP_URL = 'https://dupalchristian.github.io/Joinly/';

webpush.setVapidDetails(APP_URL, VAPID_PUBLIC, VAPID_PRIVATE);

type Action = { action: string; title: string };

const emo = (i?: string) => (i && i.startsWith('img:') ? ({ joint: '🌿', karte: '💳' } as Record<string, string>)[i.slice(4)] ?? '' : (i ?? ''));
const TZ = 'Europe/Berlin';
const time = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const dateKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });

const MON = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
const shortDay = (iso: string) => {
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: TZ }));
  return `${d.getDate()}. ${MON[d.getMonth()]}`;
};
const multiDay = (a: string, b: string) => dateKey(new Date(a)) !== dateKey(new Date(new Date(b).getTime() - 60000));

function dayWord(iso: string) {
  const d = dateKey(new Date(iso));
  if (d === dateKey(new Date())) return 'Heute';
  if (d === dateKey(new Date(Date.now() + 86400000))) return 'Morgen';
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', timeZone: TZ });
}

// „Heute 18:00–19:30“ oder „3. Aug. – 10. Aug.“
function whenText(s: any) {
  if (multiDay(s.starts_at, s.ends_at)) return `${shortDay(s.starts_at)} – ${shortDay(new Date(new Date(s.ends_at).getTime() - 60000).toISOString())}`;
  return `${dayWord(s.starts_at)} ${time(s.starts_at)}–${time(s.ends_at)}`;
}

// „Max“, „Max und Lisa“, „Max, Lisa und 2 weitere“
function names(list: string[]) {
  if (list.length <= 1) return list[0] ?? '';
  if (list.length === 2) return `${list[0]} und ${list[1]}`;
  if (list.length === 3) return `${list[0]}, ${list[1]} und ${list[2]}`;
  return `${list[0]}, ${list[1]} und ${list.length - 2} weitere`;
}

const RSVP: Action[] = [{ action: 'rsvp-yes', title: '🙌 Bin dabei' }, { action: 'rsvp-maybe', title: '🤔 Evtl.' }];

// Wer bei einer Idee „Hätte Lust“ oder „Vielleicht“ gesagt hat
async function ideaFans(sb: any, ideaId: string) {
  const { data } = await sb.from('idea_votes').select('profile_id').eq('idea_id', ideaId);
  return (data ?? []).map((v: any) => v.profile_id);
}

Deno.serve(async (req) => {
  if (req.headers.get('x-joinly-secret') !== SECRET) return new Response('forbidden', { status: 403 });
  const { type, record } = await req.json();
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let targets: string[] = [];
  let title = '';
  let body = '';
  let url = APP_URL;
  let icon: string | null = null;    // Profilbild der Person, um die es geht
  let actions: Action[] = [];
  let tag = String(record.id ?? record.status_id ?? record.idea_id ?? '') + type;

  const profile = async (id: string) =>
    (await sb.from('profiles').select('first_name, avatar_url').eq('id', id).single()).data ?? { first_name: 'Jemand', avatar_url: null };

  if (type === 'status') {
    const s = record;
    const [author, { data: members }] = await Promise.all([
      profile(s.profile_id),
      sb.from('memberships').select('profile_id').eq('group_id', s.group_id).eq('status', 'active').neq('profile_id', s.profile_id)
    ]);
    const ids = (members ?? []).map((m: any) => m.profile_id);
    if (!ids.length) return new Response('ok');
    const { data: prefs } = await sb.from('profile_private').select('id, push_activities, push_free').in('id', ids);
    // Aktivitäten: keine Auswahl = alle. Wer welche ausgewählt hat, bekommt nur diese.
    const wants = (p: any) => {
      if (s.kind !== 'plan') return p.push_free !== false;
      const list = p.push_activities ?? [];
      return list.length === 0 || list.includes(s.activity);
    };
    const withPrefs = new Set((prefs ?? []).map((p: any) => p.id));
    targets = [...(prefs ?? []).filter(wants).map((p: any) => p.id), ...ids.filter((id: string) => !withPrefs.has(id))];
    if (s.idea_id) targets = [...new Set([...targets, ...(await ideaFans(sb, s.idea_id)).filter((id: string) => ids.includes(id))])];

    const name = author.first_name;
    icon = author.avatar_url;
    const where = s.place_name ? ` · 📍 ${s.place_name}` : '';
    const note = s.note ? `\n„${s.note}“` : '';
    if (s.kind === 'free') {
      title = `👋 ${name} ist gerade frei`;
      body = `Bis ${time(s.ends_at)} Uhr${where} – wer hat Lust?${note}`;
    } else if (s.kind === 'open') {
      title = `🚪 ${name}: Kommt vorbei!`;
      body = `Bis ${time(s.ends_at)} Uhr${where}${note}`;
    } else if (s.idea_id) {
      title = `🎉 Termin steht: ${s.activity} ${emo(s.icon)}`.trim();
      body = `${whenText(s)}${where}\nBist du dabei?`;
    } else {
      title = `${emo(s.icon)} ${name} hat Lust auf ${s.activity}`.trim();
      body = `${whenText(s)} Uhr${where} – wer kommt mit?${note}`;
    }
    actions = RSVP;
    url = `${APP_URL}?status=${s.id}`;
  } else if (type === 'join') {
    const { data: s } = await sb.from('statuses').select('id, profile_id, activity, icon, kind, starts_at, ends_at').eq('id', record.status_id).single();
    if (!s || s.profile_id === record.profile_id) return new Response('ok');
    const [who, { data: going }] = await Promise.all([
      profile(record.profile_id),
      sb.from('participants').select('profile_id, profiles(first_name)').eq('status_id', s.id).eq('response', 'yes')
    ]);
    const others = (going ?? []).filter((g: any) => g.profile_id !== s.profile_id).map((g: any) => g.profiles?.first_name).filter(Boolean);
    targets = [s.profile_id];
    icon = who.avatar_url;
    const what = s.kind === 'plan' ? `${emo(s.icon)} ${s.activity} · ${whenText(s)}` : s.kind === 'open' ? '🚪 Kommt vorbei' : '👋 Gerade frei';
    if (record.response === 'maybe') {
      title = `🤔 ${who.first_name} kommt evtl. nach`;
      body = what;
    } else {
      title = s.kind === 'open' ? `🙌 ${who.first_name} kommt vorbei!` : `🙌 ${who.first_name} ist dabei!`;
      body = `${what}\n${others.length > 1 ? `Ihr seid jetzt ${others.length + 1}: du, ${names(others)}` : 'Die erste Zusage 🎉'}`;
    }
    url = `${APP_URL}?status=${s.id}`;
    tag = s.id + 'join';
  } else if (type === 'reminder') {
    const s = record;
    const { data: going } = await sb.from('participants').select('profile_id, profiles(first_name)').eq('status_id', s.id).eq('response', 'yes');
    const host = await profile(s.profile_id);
    const people = (going ?? []).filter((g: any) => g.profile_id !== s.profile_id);
    if (!people.length) return new Response('ok');
    targets = [s.profile_id, ...people.map((g: any) => g.profile_id)];
    const mins = Math.max(5, Math.round((new Date(s.starts_at).getTime() - Date.now()) / 300000) * 5);
    title = `⏰ In ${mins} Min.: ${s.activity} ${emo(s.icon)}`.trim();
    const all = [host.first_name, ...people.map((g: any) => g.profiles?.first_name).filter(Boolean)];
    body = `${s.place_name ? `📍 ${s.place_name}\n` : ''}Mit ${names(all)}`;
    actions = [{ action: 'open', title: '🗺 Route & Details' }];
    url = `${APP_URL}?status=${s.id}`;
  } else if (type === 'idea' || type === 'idea_poll') {
    const i = record;
    const [author, { data: members }] = await Promise.all([
      profile(i.profile_id),
      sb.from('memberships').select('profile_id').eq('group_id', i.group_id).eq('status', 'active').neq('profile_id', i.profile_id)
    ]);
    const ids = (members ?? []).map((m: any) => m.profile_id);
    icon = author.avatar_url;
    if (type === 'idea') {
      targets = ids;
      title = `🪣 ${author.first_name} hat eine neue Idee`;
      body = `${emo(i.icon)} ${i.title}${i.timeframe ? ' · ' + i.timeframe : ''}\nHättest du auch Lust?`.trim();
      actions = [{ action: 'vote-yes', title: '🙌 Hätte Lust' }];
    } else {
      targets = (await ideaFans(sb, i.id)).filter((id: string) => ids.includes(id));
      title = `📅 Termin gesucht: ${i.title} ${emo(i.icon)}`.trim();
      body = `${author.first_name} sucht einen Termin – stimm ab, wann es dir passt.`;
    }
    url = `${APP_URL}?idea=${i.id}`;
  } else if (type === 'idea_vote') {
    const { data: i } = await sb.from('ideas').select('id, profile_id, title, icon').eq('id', record.idea_id).single();
    if (!i || i.profile_id === record.profile_id) return new Response('ok');
    const [who, { count }] = await Promise.all([
      profile(record.profile_id),
      sb.from('idea_votes').select('profile_id', { count: 'exact', head: true }).eq('idea_id', i.id).eq('response', 'yes').neq('profile_id', i.profile_id)
    ]);
    targets = [i.profile_id];
    icon = who.avatar_url;
    const n = (count ?? 1) + 1;
    title = `🙌 ${who.first_name} hätte auch Lust`;
    body = `${emo(i.icon)} ${i.title}\n${n >= 3 ? `Schon ${n} mit Lust – Zeit, einen Termin zu finden?` : 'Ihr seid schon zu zweit!'}`;
    url = `${APP_URL}?idea=${i.id}`;
    tag = i.id + 'idea_vote';
  } else {
    return new Response('unknown type', { status: 400 });
  }

  targets = [...new Set(targets)];
  if (!targets.length) return new Response('ok');
  const { data: subs } = await sb.from('push_subscriptions').select('*').in('profile_id', targets);
  const payload = JSON.stringify({ title, body, url, tag, icon, actions });

  const results = await Promise.allSettled((subs ?? []).map((sub: any) =>
    webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600, urgency: 'high' })
      .catch(async (e: any) => {
        if (e.statusCode === 404 || e.statusCode === 410) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        throw e;
      })
  ));
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return new Response(JSON.stringify({ sent, of: results.length }), { headers: { 'Content-Type': 'application/json' } });
});
