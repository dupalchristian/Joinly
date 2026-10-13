import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { addDays, startOfDay } from './time.js';
import { Toast } from './common.jsx';
import Onboarding from './Onboarding.jsx';
import Feed from './Feed.jsx';
import Detail from './Detail.jsx';
import Create from './Create.jsx';
import Groups from './Groups.jsx';
import Profile from './Profile.jsx';
import Quick from './Quick.jsx';
import PublicStatus from './PublicStatus.jsx';
import { kindOf } from './Feed.jsx';
import { refreshPush } from './push.js';
import { readCache, writeCache, clearCache } from './cache.js';
import { hhmm, dayName } from './time.js';

const appBase = () => location.origin + location.pathname;

function shareText(s, me) {
  const k = kindOf(s);
  const mine = s.profile_id === me?.id;
  const who = mine ? 'Ich bin' : `${s.author?.first_name} ist`;
  const place = s.place_name ? ` · ${s.place_name}` : '';
  const note = s.note ? ` – ${s.note}` : '';
  if (k === 'free') return `${who} gerade frei bis ${hhmm(s.ends_at)} Uhr 👋${note}. Wer hat Lust?`;
  if (k === 'open') return `Kommt vorbei! ${who} bis ${hhmm(s.ends_at)} Uhr${place ? ' hier:' + place.slice(2) : ''}${note}.`;
  return `${who} offen für ${s.activity} ${s.icon} – ${dayName(new Date(s.starts_at))}, ${hhmm(s.starts_at)}–${hhmm(s.ends_at)} Uhr${place}${note}. Wer kommt mit?`;
}

const GROUP_KEY = 'joinly-group';
const readGroup = () => { try { return localStorage.getItem(GROUP_KEY); } catch { return null; } };
const writeGroup = (id) => { try { localStorage.setItem(GROUP_KEY, id); } catch { /* egal */ } };

function takeParams() {
  const p = new URLSearchParams(location.search);
  const code = p.get('invite');
  const status = p.get('status');
  if (code || status) history.replaceState(null, '', location.pathname);
  return { code, status };
}

export default function App() {
  const cached = readCache('session');
  const [boot, setBoot] = useState({ loading: !cached?.me, error: '' });
  const [me, setMe] = useState(cached?.me || null);
  const [legacyMe, setLegacyMe] = useState(null);   // altes Konto ohne PIN
  const [invite, setInvite] = useState(null);       // { code, group_name }
  const [groups, setGroups] = useState(cached?.groups || []);
  const [groupId, setGroupIdRaw] = useState(readGroup());
  const [statuses, setStatuses] = useState(() => readCache('st:' + readGroup()) || []);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [screen, setScreen] = useState({ name: 'feed' });
  const [toast, setToast] = useState('');
  const [tick, setTick] = useState(0);
  const [pub, setPub] = useState(null);
  const [members, setMembers] = useState([]);             // geteilter Status, den man (noch) nicht in der Gruppe sieht

  const setGroupId = (id) => { setGroupIdRaw(id); writeGroup(id); };

  const reloadGroups = useCallback(async () => {
    const gs = await api.listMyGroups();
    setGroups(gs);
    const active = gs.filter(g => g.status === 'active');
    setGroupIdRaw(cur => {
      const keep = active.find(g => g.id === cur) ? cur : active[0]?.id ?? null;
      writeGroup(keep || '');
      return keep;
    });
    return gs;
  }, []);

  // Geteilten Status öffnen: als Mitglied in der Gruppe, sonst als Gast-Ansicht
  const openStatusLink = useCallback(async (id, meNow, gsNow) => {
    let data = null;
    try { data = await api.publicStatus(id); } catch { /* egal */ }
    if (!data) { setToast('Diesen Status gibt es nicht mehr.'); return false; }
    const member = meNow && (gsNow || []).some(g => g.id === data.group_id && g.status === 'active');
    if (member) {
      setGroupIdRaw(data.group_id); writeGroup(data.group_id);
      setScreen({ name: 'detail', id });
    } else {
      setPub(data);
      setScreen({ name: 'public', id });
    }
    return true;
  }, []);

  // Start
  useEffect(() => {
    (async () => {
      try {
        const { code, status: statusLink } = takeParams();
        const [{ me, anonymous }, info] = await Promise.all([
          api.init(),
          code ? api.inviteInfo(code).catch(() => null) : Promise.resolve(null)
        ]);
        let inv = null;
        if (code) {
          if (info) inv = { code, ...info };
          else setToast('Dieser Einladungslink ist ungültig.');
        }
        setInvite(inv);
        if (me && anonymous) {            // altes Konto: einmal PIN festlegen
          setLegacyMe(me); setMe(null); clearCache();
          setBoot({ loading: false, error: '' });
          return;
        }
        setMe(me);
        if (!me) clearCache();
        if (me) {
          if (inv) { await api.requestJoin(inv.code); setToast(`Anfrage für „${inv.group_name}“ gesendet`); setInvite(null); }
          const gs = await reloadGroups();
          if (gs.length === 0) setScreen({ name: 'groups' });
          if (statusLink) await openStatusLink(statusLink, me, gs);
          refreshPush();
        } else if (statusLink) {
          await openStatusLink(statusLink, null, []);
        }
        setBoot({ loading: false, error: '' });
      } catch (e) {
        setBoot({ loading: false, error: e.message });
      }
    })();
  }, []);

  const loadStatuses = useCallback(async () => {
    if (!groupId) { setStatuses([]); return; }
    const from = new Date(Date.now() - 12 * 3600 * 1000);
    const to = addDays(startOfDay(new Date()), 8);
    const rows = await api.listStatuses(groupId, from.toISOString(), to.toISOString());
    setStatuses(rows);
    writeCache('st:' + groupId, rows);
  }, [groupId]);

  // Feed laden + Live-Updates
  useEffect(() => {
    if (!me || !groupId) return;
    let live = true;
    const c = readCache('st:' + groupId);
    if (c) setStatuses(c);
    setLoadingFeed(true);
    loadStatuses().catch(e => setToast(e.message)).finally(() => live && setLoadingFeed(false));
    let t;
    const unsub = api.subscribe(groupId, () => {
      clearTimeout(t);
      t = setTimeout(() => { loadStatuses().catch(() => {}); reloadGroups().catch(() => {}); setTick(x => x + 1); }, 250);
    });
    const onFocus = () => { if (document.visibilityState === 'visible') { loadStatuses().catch(() => {}); reloadGroups().catch(() => {}); } };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { live = false; unsub(); clearTimeout(t); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [me?.id, groupId]);

  // Mitglieder der Gruppe (für die Status-Kreise)
  useEffect(() => {
    if (!me || !groupId) { setMembers([]); return; }
    const c = readCache('mem:' + groupId);
    if (c) setMembers(c);
    api.listMembers(groupId).then(m => { setMembers(m); writeCache('mem:' + groupId, m); }).catch(() => {});
  }, [me?.id, groupId, tick]);

  // Zuletzt bekannte Daten merken, damit die App beim nächsten Öffnen sofort etwas zeigt
  useEffect(() => { if (me) writeCache('session', { me, groups }); }, [me, groups]);

  // Ausstehende Freigabe regelmäßig prüfen
  useEffect(() => {
    if (!me || !groups.some(g => g.status === 'pending')) return;
    const t = setInterval(() => reloadGroups().catch(() => {}), 20000);
    return () => clearInterval(t);
  }, [me?.id, groups]);

  // Klick auf eine Push-Nachricht, während die App offen ist
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMsg = (e) => {
      if (e.data?.type !== 'open') return;
      const id = new URL(e.data.url).searchParams.get('status');
      if (id && me) reloadGroups().then(gs => openStatusLink(id, me, gs));
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, [me?.id]);

  const shareStatus = async (s) => {
    const url = `${appBase()}?status=${s.id}`;
    const text = shareText(s, me);
    if (navigator.share) {
      try { await navigator.share({ title: 'Joinly', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
  };

  const endStatus = async (s) => {
    try { await api.updateStatus(s.id, { ends_at: new Date().toISOString() }); await loadStatuses(); setScreen({ name: 'feed' }); setToast('Beendet'); }
    catch (e) { setToast('Hat nicht geklappt: ' + e.message); }
  };

  const reloadPub = async () => {
    const data = await api.publicStatus(pub.id);
    setPub(data);
    try { setMe(await api.init().then(r => r.me)); } catch { /* egal */ }
  };

  const toggleJoin = async (s) => {
    const joined = s.participants.some(p => p.profile_id === me.id);
    // sofort anzeigen, dann speichern
    setStatuses(list => list.map(x => x.id !== s.id ? x : {
      ...x, participants: joined
        ? x.participants.filter(p => p.profile_id !== me.id)
        : [...x.participants, { profile_id: me.id, profiles: me }]
    }));
    try {
      if (joined) await api.leave(s.id); else await api.join(s.id);
      if (!joined) setToast(kindOf(s) === 'open' ? 'Du kommst vorbei' : kindOf(s) === 'free' ? `Du bist dabei – meld dich bei ${s.author?.first_name}` : `Du bist bei ${s.activity} dabei`);
    } catch (e) { setToast('Hat nicht geklappt: ' + e.message); }
    loadStatuses().catch(() => {});
  };

  if (boot.loading) return <div className="app"><div className="spinner" aria-label="Lädt" /></div>;
  if (boot.error) return (
    <div className="app"><div className="screen empty">
      Joinly konnte nicht starten.<br /><span className="small">{boot.error}</span>
      <div style={{ marginTop: 16 }}><button className="btn white" onClick={() => location.reload()}>Nochmal versuchen</button></div>
    </div></div>
  );

  if (screen.name === 'public' && pub) return (
    <div className="app">
      <PublicStatus s={pub} me={me} onMe={setMe} onReload={reloadPub}
        onDone={async () => { setPub(null); if (me || (await api.init()).me) { const gs = await reloadGroups(); setScreen({ name: gs.length ? 'feed' : 'groups' }); } else setScreen({ name: 'feed' }); }} />
      <Toast text={toast} onDone={() => setToast('')} />
    </div>
  );

  if (!me) return (
    <div className="app">
      <Onboarding invite={invite} legacyMe={legacyMe} onDone={async (m) => {
        setLegacyMe(null);
        setMe(m);
        if (invite) { await api.requestJoin(invite.code); setInvite(null); setToast(`Anfrage für „${invite.group_name}“ gesendet`); }
        const gs = await reloadGroups();
        setScreen({ name: gs.length ? 'feed' : 'groups' });
      }} />
      <Toast text={toast} onDone={() => setToast('')} />
    </div>
  );

  const group = groups.find(g => g.id === groupId && g.status === 'active');
  const sel = screen.name === 'detail' ? statuses.find(s => s.id === screen.id) : null;
  const go = (name, extra) => { setScreen({ name, ...extra }); window.scrollTo(0, 0); };

  return (
    <div className="app">
      {api.demo && screen.name === 'feed' && (
        <div style={{ background: '#2A2416', color: 'var(--accent)', fontSize: 12, textAlign: 'center', padding: 'calc(6px + var(--safe-top)) 12px 6px' }}>
          Demo-Modus · Beispieldaten, noch nicht mit der Datenbank verbunden
        </div>
      )}
      {screen.name === 'feed' && (
        <Feed me={me} groups={groups} groupId={groupId} setGroupId={setGroupId} statuses={statuses} members={members} loading={loadingFeed && !statuses.length}
          onOpen={(id) => go('detail', { id })} onToggle={toggleJoin} onCreate={() => go('create')} onQuick={(kind) => go('quick', { kind })}
          onGroups={() => go('groups')} onProfile={() => go('profile')} />
      )}
      {screen.name === 'quick' && group && (
        <Quick kind={screen.kind} me={me} group={group} onClose={() => go('feed')}
          onPosted={async () => { await loadStatuses(); go('feed'); setToast(screen.kind === 'open' ? 'Deine Tür ist offen' : 'Alle sehen jetzt, dass du frei bist'); }} />
      )}
      {screen.name === 'detail' && sel && (
        <Detail s={sel} me={me} tick={tick} onBack={() => go('feed')} onToggle={toggleJoin} onEdit={() => go('edit', { id: sel.id })} onShare={shareStatus} onEnd={endStatus}
          onDelete={async (id) => { await api.deleteStatus(id); await loadStatuses(); go('feed'); setToast('Status gelöscht'); }} />
      )}
      {screen.name === 'detail' && !sel && <Feed me={me} groups={groups} groupId={groupId} setGroupId={setGroupId} statuses={statuses} members={members} loading
        onOpen={(id) => go('detail', { id })} onToggle={toggleJoin} onCreate={() => go('create')} onQuick={(kind) => go('quick', { kind })} onGroups={() => go('groups')} onProfile={() => go('profile')} />}
      {screen.name === 'create' && group && (
        <Create me={me} group={group} onClose={() => go('feed')}
          onPosted={async () => { await loadStatuses(); go('feed'); setToast('Dein Status ist online'); }} />
      )}
      {screen.name === 'edit' && group && statuses.find(s => s.id === screen.id) && (
        <Create me={me} group={group} existing={statuses.find(s => s.id === screen.id)} onClose={() => go('detail', { id: screen.id })}
          onPosted={async () => { await loadStatuses(); go('detail', { id: screen.id }); setToast('Änderungen gespeichert'); }} />
      )}
      {screen.name === 'groups' && (
        <Groups me={me} groups={groups} groupId={groupId} setGroupId={setGroupId} tick={tick}
          onBack={() => go('feed')} reloadGroups={reloadGroups} toast={setToast} />
      )}
      {screen.name === 'profile' && (
        <Profile me={me} group={group} onBack={() => go('feed')} onSaved={setMe} toast={setToast}
          onLogout={async () => { await api.logout(); clearCache(); location.reload(); }} />
      )}
      <Toast text={toast} onDone={() => setToast('')} />
    </div>
  );
}
