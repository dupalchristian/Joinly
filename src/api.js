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

// Falls die Spalte place_address in der Datenbank noch fehlt: ohne sie speichern
async function withoutMissingAddress(row, run) {
  const res = await run(row);
  if (res.error && /place_address/.test(res.error.message)) {
    const { place_address, ...rest } = row;
    return check(await run(rest));
  }
  return check(res);
}

async function uid() {
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}

const supabaseApi = {
  demo: false,

  async init() {
    let id = await uid();
    if (!id) {
      check(await sb.auth.signInAnonymously());
      id = await uid();
    }
    return { userId: id, me: await this.loadMe(id) };
  },

  async loadMe(id) {
    id = id || await uid();
    const pub = check(await sb.from('profiles').select('*').eq('id', id).maybeSingle());
    if (!pub) return null;
    const priv = check(await sb.from('profile_private').select('*').eq('id', id).maybeSingle());
    return { ...(priv || {}), ...pub };
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
      .select(`*, author:profiles!statuses_profile_id_fkey(id, first_name, ${AV}), participants(profile_id, profiles(id, first_name, ${AV}))`)
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
    const id = await uid();
    check(await sb.from('participants').insert({ status_id: statusId, profile_id: id }));
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

  // Live-Updates: ruft cb() bei jeder Änderung in der Gruppe auf
  subscribe(groupId, cb) {
    const ch = sb.channel('g-' + groupId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses', filter: 'group_id=eq.' + groupId }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memberships', filter: 'group_id=eq.' + groupId }, cb)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }
};

export const api = DEMO ? demoApi : supabaseApi;
