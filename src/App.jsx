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

const GROUP_KEY = 'joinly-group';
const readGroup = () => { try { return localStorage.getItem(GROUP_KEY); } catch { return null; } };
const writeGroup = (id) => { try { localStorage.setItem(GROUP_KEY, id); } catch { /* egal */ } };

function takeInviteCode() {
  const p = new URLSearchParams(location.search);
  const code = p.get('invite');
  if (code) history.replaceState(null, '', location.pathname);
  return code;
}

export default function App() {
  const [boot, setBoot] = useState({ loading: true, error: '' });
  const [me, setMe] = useState(null);
  const [invite, setInvite] = useState(null);       // { code, group_name }
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupIdRaw] = useState(readGroup());
  const [statuses, setStatuses] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [screen, setScreen] = useState({ name: 'feed' });
  const [toast, setToast] = useState('');
  const [tick, setTick] = useState(0);

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

  // Start
  useEffect(() => {
    (async () => {
      try {
        const code = takeInviteCode();
        const { me } = await api.init();
        let inv = null;
        if (code) {
          const info = await api.inviteInfo(code);
          if (info) inv = { code, ...info };
          else setToast('Dieser Einladungslink ist ungültig.');
        }
        setInvite(inv);
        setMe(me);
        if (me) {
          if (inv) { await api.requestJoin(inv.code); setToast(`Anfrage für „${inv.group_name}“ gesendet`); setInvite(null); }
          const gs = await reloadGroups();
          if (gs.length === 0) setScreen({ name: 'groups' });
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
  }, [groupId]);

  // Feed laden + Live-Updates
  useEffect(() => {
    if (!me || !groupId) return;
    let live = true;
    setLoadingFeed(true);
    loadStatuses().catch(e => setToast(e.message)).finally(() => live && setLoadingFeed(false));
    let t;
    const unsub = api.subscribe(groupId, () => {
      clearTimeout(t);
      t = setTimeout(() => { loadStatuses().catch(() => {}); reloadGroups().catch(() => {}); setTick(x => x + 1); }, 250);
    });
    const onFocus = () => { loadStatuses().catch(() => {}); reloadGroups().catch(() => {}); };
    window.addEventListener('focus', onFocus);
    return () => { live = false; unsub(); clearTimeout(t); window.removeEventListener('focus', onFocus); };
  }, [me?.id, groupId]);

  // Ausstehende Freigabe regelmäßig prüfen
  useEffect(() => {
    if (!me || !groups.some(g => g.status === 'pending')) return;
    const t = setInterval(() => reloadGroups().catch(() => {}), 20000);
    return () => clearInterval(t);
  }, [me?.id, groups]);

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
      if (!joined) setToast(`Du bist bei ${s.activity} dabei`);
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

  if (!me) return (
    <div className="app">
      <Onboarding invite={invite} onDone={async (m) => {
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
        <Feed me={me} groups={groups} groupId={groupId} setGroupId={setGroupId} statuses={statuses} loading={loadingFeed && !statuses.length}
          onOpen={(id) => go('detail', { id })} onToggle={toggleJoin} onCreate={() => go('create')}
          onGroups={() => go('groups')} onProfile={() => go('profile')} />
      )}
      {screen.name === 'detail' && sel && (
        <Detail s={sel} me={me} tick={tick} onBack={() => go('feed')} onToggle={toggleJoin} onEdit={() => go('edit', { id: sel.id })}
          onDelete={async (id) => { await api.deleteStatus(id); await loadStatuses(); go('feed'); setToast('Status gelöscht'); }} />
      )}
      {screen.name === 'detail' && !sel && <Feed me={me} groups={groups} groupId={groupId} setGroupId={setGroupId} statuses={statuses} loading
        onOpen={(id) => go('detail', { id })} onToggle={toggleJoin} onCreate={() => go('create')} onGroups={() => go('groups')} onProfile={() => go('profile')} />}
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
        <Profile me={me} group={group} onBack={() => go('feed')} onSaved={setMe} toast={setToast} />
      )}
      <Toast text={toast} onDone={() => setToast('')} />
    </div>
  );
}
