// Demo-Modus: gleiche Funktionen wie die echte Datenbank, aber nur im Browser.
const KEY = 'joinly-demo-v1';
const ME = 'me';

const at = (dayOffset, hhmm) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

function seed() {
  const people = [
    { id: 's', first_name: 'Stefan', avatar_color: '#3B4A5A' },
    { id: 'a', first_name: 'Anna', avatar_color: '#5A3B4A' },
    { id: 'm', first_name: 'Markus', avatar_color: '#3B5A45' },
    { id: 'l', first_name: 'Lisa', avatar_color: '#5A513B' },
    { id: 't', first_name: 'Tom', avatar_color: '#463B5A' },
    { id: 'p', first_name: 'Paul', avatar_color: '#2E2E2E' }
  ];
  const lake = { place_mode: 'search', place_name: 'Badestelle am See', place_lat: 47.995, place_lng: 11.33 };
  return {
    me: null,
    people,
    groups: [
      { id: 'g1', name: 'Freunde', invite_code: 'demo123' },
      { id: 'g2', name: 'Familie', invite_code: 'demo456' }
    ],
    memberships: [
      { group_id: 'g1', profile_id: ME, role: 'admin', status: 'active' },
      { group_id: 'g2', profile_id: ME, role: 'admin', status: 'active' },
      ...['s', 'a', 'm', 'l', 't'].map(id => ({ group_id: 'g1', profile_id: id, role: 'member', status: 'active' })),
      { group_id: 'g1', profile_id: 'p', role: 'member', status: 'pending' }
    ],
    groupActivities: [{ id: 'ga1', group_id: 'g1', name: 'Daydrinking', icon: '🍹' }],
    statuses: [
      { id: 'st1', group_id: 'g1', profile_id: 's', activity: 'Eisbaden', icon: '🧊', starts_at: at(0, '10:00'), ends_at: at(0, '11:00'), ...lake },
      { id: 'st2', group_id: 'g1', profile_id: 'a', activity: 'Joggen', icon: '🏃', starts_at: at(0, '13:00'), ends_at: at(0, '14:30'), place_mode: 'none' },
      { id: 'st3', group_id: 'g1', profile_id: 'm', activity: 'Abendessen', icon: '🍝', starts_at: at(0, '19:00'), ends_at: at(0, '22:00'), place_mode: 'meet', place_name: 'Treffpunkt Marktplatz' },
      { id: 'st4', group_id: 'g1', profile_id: 'l', activity: 'Spazieren', icon: '🚶', starts_at: at(1, '18:00'), ends_at: at(1, '19:30'), place_mode: 'search', place_name: 'Englischer Garten', place_lat: 48.1642, place_lng: 11.6056 },
      { id: 'st5', group_id: 'g1', profile_id: 't', activity: 'Daydrinking', icon: '🍹', starts_at: at(6, '14:00'), ends_at: at(6, '18:00'), place_mode: 'none' },
      { id: 'st6', group_id: 'g2', profile_id: ME, activity: 'Kaffee & Kuchen', icon: '☕', starts_at: at(0, '15:00'), ends_at: at(0, '17:30'), place_mode: 'meet', place_name: 'Bei Mama' }
    ],
    participants: [
      { status_id: 'st1', profile_id: 'l' },
      { status_id: 'st3', profile_id: 't' }, { status_id: 'st3', profile_id: 'a' },
      { status_id: 'st5', profile_id: 'm' }
    ],
    messages: [
      { id: 'mm1', status_id: 'st1', profile_id: 's', body: 'Ich bring Tee mit 🙂', created_at: at(0, '07:30') }
    ]
  };
}

let db = null;
const load = () => {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db) db = seed();
  return db;
};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* egal */ } };
const listeners = new Set();
const changed = () => { save(); listeners.forEach(fn => fn()); };
const profile = (id) => id === ME ? { id: ME, ...load().me } : load().people.find(p => p.id === id);
const rid = () => Math.random().toString(36).slice(2, 10);

export const demoApi = {
  demo: true,
  async init() { const d = load(); return { userId: ME, me: d.me ? { id: ME, ...d.me } : null }; },
  async saveProfile(p) { load().me = { avatar_color: '#2E2E2E', interests: null, push_activities: [], ...p }; changed(); return { id: ME, ...db.me }; },
  async updateProfile(patch) { Object.assign(load().me, patch); changed(); return { id: ME, ...db.me }; },
  async listMyGroups() {
    const d = load();
    return d.memberships.filter(m => m.profile_id === ME)
      .map(m => ({ ...d.groups.find(g => g.id === m.group_id), role: m.role, status: m.status }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  async createGroup(name) {
    const d = load(); const id = rid();
    d.groups.push({ id, name, invite_code: rid() });
    d.memberships.push({ group_id: id, profile_id: ME, role: 'admin', status: 'active' });
    changed(); return id;
  },
  async inviteInfo(code) { const g = load().groups.find(x => x.invite_code === code); return g ? { group_id: g.id, group_name: g.name } : null; },
  async requestJoin(code) {
    const d = load(); const g = d.groups.find(x => x.invite_code === code);
    if (!g) throw new Error('Einladung ungültig');
    if (!d.memberships.find(m => m.group_id === g.id && m.profile_id === ME)) d.memberships.push({ group_id: g.id, profile_id: ME, role: 'member', status: 'pending' });
    changed(); return g.id;
  },
  async listMembers(groupId) {
    return load().memberships.filter(m => m.group_id === groupId).map(m => ({ role: m.role, status: m.status, profile: profile(m.profile_id) }));
  },
  async approve(groupId, pid) { const m = load().memberships.find(x => x.group_id === groupId && x.profile_id === pid); if (m) m.status = 'active'; changed(); },
  async removeMember(groupId, pid) { db.memberships = load().memberships.filter(x => !(x.group_id === groupId && x.profile_id === pid)); changed(); },
  async listStatuses(groupId, fromIso, toIso) {
    const d = load();
    return d.statuses.filter(s => s.group_id === groupId && s.ends_at >= fromIso && s.starts_at <= toIso)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map(s => ({ ...s, author: profile(s.profile_id),
        participants: d.participants.filter(p => p.status_id === s.id).map(p => ({ profile_id: p.profile_id, profiles: profile(p.profile_id) })) }));
  },
  async createStatus(s) { const st = { id: rid(), profile_id: ME, ...s }; load().statuses.push(st); changed(); return st; },
  async deleteStatus(id) { db.statuses = load().statuses.filter(s => s.id !== id); changed(); },
  async join(statusId) { load().participants.push({ status_id: statusId, profile_id: ME }); changed(); },
  async leave(statusId) { db.participants = load().participants.filter(p => !(p.status_id === statusId && p.profile_id === ME)); changed(); },
  async listMessages(statusId) {
    return load().messages.filter(m => m.status_id === statusId).sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(m => ({ ...m, profiles: profile(m.profile_id) }));
  },
  async sendMessage(statusId, body) { load().messages.push({ id: rid(), status_id: statusId, profile_id: ME, body, created_at: new Date().toISOString() }); changed(); },
  async listGroupActivities(groupId) { return load().groupActivities.filter(a => a.group_id === groupId); },
  async addGroupActivity(groupId, name, icon) {
    const d = load();
    if (!d.groupActivities.find(a => a.group_id === groupId && a.name === name)) d.groupActivities.push({ id: rid(), group_id: groupId, name, icon });
    changed();
  },
  subscribe(groupId, cb) { listeners.add(cb); return () => listeners.delete(cb); },
  reset() { localStorage.removeItem(KEY); db = null; }
};
