import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, DEMO } from './config.js';
import { demoApi } from './demo.js';

let sb = null;
if (!DEMO) {
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'joinly-auth' }
  });
}

// Profilbild-Spalten gibt es erst nach Update 3 – bis dahin ohne sie weiterarbeiten
let AV = 'avatar_color, avatar_url, avatar_emoji';
const missingAvatar = (e) => /avatar_url|avatar_emoji/.test(e?.message || '');
async function q(build) {
  let res = await build();
  if (res.error && missingAvatar(res.error) && AV !== 'avatar_color') { AV = 'avatar_color'; res = await build(); }
  return check(res);
}

const PUBLIC_FIELDS = ['first_name', 'phone', 'avatar_color', 'avatar_url', 'avatar_emoji'];

const check = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

// Falls eine neuere Spalte (place_address, idea_id) in der Datenbank noch fehlt: ohne sie speichern
async function withoutMissingAddress(row, run) {
  let res = await run(row);
  for (const col of ['place_address', 'idea_id']) {
    if (res.error && res.error.message.includes(col) && col in row) {
      const { [col]: _, ...rest } = row;
      row = rest;
      res = await run(row);
    }
  }
  return check(res);
}

// Handynummer → feste Anmelde-Adresse (es werden keine E-Mails verschickt)
export function phoneEmail(phone) {
  let d = String(phone).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '49' + d.slice(1);
  return `${d}@nutzer.joinly.app`;
}
const pinPassword = (pin) => 'jl-' + pin;

// Alte Geräte-Anmeldung (ohne PIN) mit Profil? Dann Übernahme vorbereiten.
async function transferToken() {
  const { data } = await sb.auth.getSession();
  if (!data.session?.user?.is_anonymous) return null;
  try { return check(await sb.rpc('create_transfer')); } catch { return null; }
}

async function uid() {
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}

const supabaseApi = {
  demo: false,

  async init() {
    const { data } = await sb.auth.getSession();
    const user = data.session?.user;
    if (!user) return { userId: null, me: null, anonymous: false };
    return { userId: user.id, me: await this.loadMe(user.id), anonymous: !!user.is_anonymous };
  },

  async loadMe(id) {
    id = id || await uid();
    const [pubRes, privRes] = await Promise.all([
      sb.from('profiles').select('*').eq('id', id).maybeSingle(),
      sb.from('profile_private').select('*').eq('id', id).maybeSingle()
    ]);
    const pub = check(pubRes);
    if (!pub) return null;
    return { ...(check(privRes) || {}), ...pub };
  },

  // Neues Konto mit Handynummer + PIN. Bestehende Geräte-Anmeldung wird mit übernommen.
  async register({ first_name, phone, pin, avatar_color }) {
    const token = await transferToken();
    const { data: cur } = await sb.auth.getSession();
    if (cur.session?.user?.is_anonymous && !token && await this.loadMe(cur.session.user.id)) {
      throw new Error('Die Umstellung ist noch nicht ganz fertig. Bitte in ein paar Minuten nochmal versuchen.');
    }
    const res = await sb.auth.signUp({ email: phoneEmail(phone), password: pinPassword(pin) });
    if (res.error) {
      if (/already|registered|exists/i.test(res.error.message)) throw new Error('Für diese Nummer gibt es schon ein Konto. Tippe auf „Ich habe schon ein Konto“.');
      throw new Error(res.error.message);
    }
    if (!res.data.session) throw new Error('Anmeldung noch nicht freigeschaltet (in Supabase „Confirm email“ ausschalten).');
    if (token) check(await sb.rpc('claim_transfer', { tok: token }));
    const existing = await this.loadMe();
    return this.updateProfile(existing ? { first_name, phone } : { first_name, phone, avatar_color });
  },

  async login({ phone, pin }) {
    const token = await transferToken();
    const res = await sb.auth.signInWithPassword({ email: phoneEmail(phone), password: pinPassword(pin) });
    if (res.error) throw new Error('Handynummer oder PIN stimmt nicht.');
    if (token) { try { check(await sb.rpc('claim_transfer', { tok: token })); } catch { /* egal */ } }
    return this.loadMe();
  },

  async logout() {
    await sb.auth.signOut();
  },

  async adminResetPin(memberId, pin) {
    check(await sb.rpc('admin_reset_pin', { member: memberId, new_pin: pin }));
  },

  async saveProfile(p) {
    return this.updateProfile(p);
  },

  async updateProfile(patch) {
    const id = await uid();
    const pub = {}, priv = {};
    for (const [k, v] of Object.entries(patch)) (PUBLIC_FIELDS.includes(k) ? pub : priv)[k] = v;
    if (Object.keys(pub).length) {
      let res = await sb.from('profiles').upsert({ id, ...pub });
      if (res.error && missingAvatar(res.error)) {
        const { avatar_url, avatar_emoji, ...rest } = pub;
        res = await sb.from('profiles').upsert({ id, ...rest });
      }
      check(res);
    }
    if (Object.keys(priv).length) check(await sb.from('profile_private').upsert({ id, ...priv }));
    return this.loadMe(id);
  },

  async listMyGroups() {
    const id = await uid();
    const rows = check(await sb.from('memberships')
      .select('role, status, groups(id, name, invite_code)')
      .eq('profile_id', id));
    return rows.filter(r => r.groups).map(r => ({ ...r.groups, role: r.role, status: r.status }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async createGroup(name) {
    return check(await sb.rpc('create_group', { group_name: name }));
  },

  async inviteInfo(code) {
    const rows = check(await sb.rpc('invite_info', { code }));
    return rows?.[0] ?? null;
  },

  async requestJoin(code) {
    return check(await sb.rpc('request_join', { code }));
  },

  async listMembers(groupId) {
    const rows = await q(() => sb.from('memberships')
      .select(`role, status, profile_id, profiles(id, first_name, phone, ${AV})`)
      .eq('group_id', groupId));
    return rows.map(r => ({ role: r.role, status: r.status, profile: r.profiles ?? { id: r.profile_id, first_name: 'Neu', phone: '' } }));
  },

  async approve(groupId, profileId) {
    check(await sb.from('memberships').update({ status: 'active' }).eq('group_id', groupId).eq('profile_id', profileId));
  },

  async removeMember(groupId, profileId) {
    check(await sb.from('memberships').delete().eq('group_id', groupId).eq('profile_id', profileId));
  },

  async listStatuses(groupId, fromIso, toIso) {
    return q(() => sb.from('statuses')
      .select(`*, author:profiles!statuses_profile_id_fkey(id, first_name, ${AV}), participants(profile_id, response, late_minutes, profiles(id, first_name, ${AV}))`)
      .eq('group_id', groupId)
      .gte('ends_at', fromIso)
      .lte('starts_at', toIso)
      .order('starts_at'));
  },

  async createStatus(s) {
    const id = await uid();
    return withoutMissingAddress(s, (row) => sb.from('statuses').insert({ ...row, profile_id: id }).select().single());
  },

  async updateStatus(statusId, patch) {
    return withoutMissingAddress(patch, (row) => sb.from('statuses').update(row).eq('id', statusId).select().single());
  },

  async publicStatus(statusId) {
    return check(await sb.rpc('public_status', { sid: statusId }));
  },

  async joinStatusGuest(statusId) {
    check(await sb.rpc('join_status_guest', { sid: statusId }));
  },

  async savePushSubscription(sub) {
    check(await sb.rpc('save_push_subscription', { ep: sub.endpoint, key_p256dh: sub.keys.p256dh, key_auth: sub.keys.auth }));
  },

  // Profilbild hochladen (bereits verkleinert als JPEG-Blob)
  async uploadAvatar(blob) {
    const id = await uid();
    const path = `${id}/avatar-${Date.now()}.jpg`;
    const { error } = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(error.message);
    return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  },

  async deleteStatus(statusId) {
    check(await sb.from('statuses').delete().eq('id', statusId));
  },

  async join(statusId) {
    return this.respond(statusId, 'yes', null);
  },

  // Antwort auf einen Status: yes | maybe | no, optional Verspätung in Minuten
  async respond(statusId, response, lateMinutes = null) {
    const id = await uid();
    check(await sb.from('participants').upsert(
      { status_id: statusId, profile_id: id, response, late_minutes: response === 'yes' ? lateMinutes : null, updated_at: new Date().toISOString() },
      { onConflict: 'status_id,profile_id' }));
  },

  async listHistory(groupId, limit = 60) {
    return q(() => sb.from('statuses')
      .select(`*, author:profiles!statuses_profile_id_fkey(id, first_name, ${AV}), participants(profile_id, response, late_minutes, profiles(id, first_name, ${AV})), status_photos(id, url)`)
      .eq('group_id', groupId)
      .lt('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: false })
      .limit(limit));
  },

  async listLocations(statusId) {
    return check(await sb.from('live_locations').select('*').eq('status_id', statusId));
  },

  async shareLocation(statusId, pos) {
    const id = await uid();
    check(await sb.from('live_locations').upsert({ status_id: statusId, profile_id: id, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy ?? null, updated_at: new Date().toISOString() }));
  },

  async stopLocation(statusId) {
    const id = await uid();
    await sb.from('live_locations').delete().eq('status_id', statusId).eq('profile_id', id);
  },

  async listPhotos(statusId) {
    return check(await sb.from('status_photos').select('*').eq('status_id', statusId).order('created_at'));
  },

  async uploadStatusPhoto(statusId, blob) {
    const id = await uid();
    const path = `${id}/${statusId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
    const { error } = await sb.storage.from('status-photos').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw new Error(error.message);
    const url = sb.storage.from('status-photos').getPublicUrl(path).data.publicUrl;
    check(await sb.from('status_photos').insert({ status_id: statusId, profile_id: id, url, path }));
  },

  async deletePhoto(photo) {
    if (photo.path) await sb.storage.from('status-photos').remove([photo.path]);
    check(await sb.from('status_photos').delete().eq('id', photo.id));
  },

  async activityCounts(groupId) {
    return check(await sb.rpc('activity_counts', { g: groupId }));
  },

  async leave(statusId) {
    const id = await uid();
    check(await sb.from('participants').delete().eq('status_id', statusId).eq('profile_id', id));
  },

  async listMessages(statusId) {
    return q(() => sb.from('messages')
      .select(`*, profiles(id, first_name, ${AV})`)
      .eq('status_id', statusId).order('created_at'));
  },

  async sendMessage(statusId, body) {
    const id = await uid();
    check(await sb.from('messages').insert({ status_id: statusId, profile_id: id, body }));
  },

  async listGroupActivities(groupId) {
    return check(await sb.from('group_activities').select('*').eq('group_id', groupId).order('name'));
  },

  async addGroupActivity(groupId, name, icon) {
    const id = await uid();
    const { error } = await sb.from('group_activities').insert({ group_id: groupId, name, icon, created_by: id });
    if (error && !String(error.message).includes('duplicate')) throw new Error(error.message);
  },

  // Bucket List. Gibt null zurück, solange die Tabellen in der Datenbank noch fehlen.
  async listIdeas(groupId) {
    const res = await sb.from('ideas')
      .select(`*, author:profiles!ideas_profile_id_fkey(id, first_name, ${AV}), idea_votes(profile_id, response, profiles(id, first_name, ${AV})), idea_options(id, starts_on, ends_on, idea_option_votes(profile_id, ok)), statuses(id, starts_at, ends_at)`)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (res.error && /ideas|relation|schema cache|does not exist/i.test(res.error.message)) return null;
    if (res.error && missingAvatar(res.error) && AV !== 'avatar_color') { AV = 'avatar_color'; return this.listIdeas(groupId); }
    return check(res);
  },

  async createIdea(idea) {
    const id = await uid();
    return check(await sb.from('ideas').insert({ ...idea, profile_id: id }).select().single());
  },

  async updateIdea(ideaId, patch) {
    check(await sb.from('ideas').update(patch).eq('id', ideaId));
  },

  async deleteIdea(ideaId) {
    check(await sb.from('ideas').delete().eq('id', ideaId));
  },

  // response: 'yes' | 'maybe' | null (zurücknehmen)
  async voteIdea(ideaId, response) {
    const id = await uid();
    if (!response) check(await sb.from('idea_votes').delete().eq('idea_id', ideaId).eq('profile_id', id));
    else check(await sb.from('idea_votes').upsert({ idea_id: ideaId, profile_id: id, response }, { onConflict: 'idea_id,profile_id' }));
  },

  async addIdeaOption(ideaId, startsOn, endsOn) {
    check(await sb.from('idea_options').insert({ idea_id: ideaId, starts_on: startsOn, ends_on: endsOn }));
  },

  async deleteIdeaOption(optionId) {
    check(await sb.from('idea_options').delete().eq('id', optionId));
  },

  // ok: true | false | null (zurücknehmen)
  async voteOption(optionId, ok) {
    const id = await uid();
    if (ok === null) check(await sb.from('idea_option_votes').delete().eq('option_id', optionId).eq('profile_id', id));
    else check(await sb.from('idea_option_votes').upsert({ option_id: optionId, profile_id: id, ok }, { onConflict: 'option_id,profile_id' }));
  },

  // Live-Updates: ruft cb() bei jeder Änderung in der Gruppe auf
  subscribe(groupId, cb) {
    const ch = sb.channel('g-' + groupId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses', filter: 'group_id=eq.' + groupId }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'status_photos' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memberships', filter: 'group_id=eq.' + groupId }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas', filter: 'group_id=eq.' + groupId }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'idea_votes' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'idea_options' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'idea_option_votes' }, cb)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }
};

export const api = DEMO ? demoApi : supabaseApi;
