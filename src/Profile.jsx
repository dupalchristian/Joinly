import { useEffect, useState } from 'react';
import { api } from './api.js';
import { DEFAULT_ACTIVITIES } from './activities.js';
import { Back } from './Icons.jsx';
import PlaceSearch from './PlaceSearch.jsx';
import { enablePush, pushState } from './push.js';
import AvatarEditor from './AvatarEditor.jsx';

export default function Profile({ me, group, onBack, onSaved, toast }) {
  const [name, setName] = useState(me.first_name || '');
  const [phone, setPhone] = useState(me.phone || '');
  const [av, setAv] = useState({ avatar_url: me.avatar_url || null, avatar_emoji: me.avatar_emoji || null, avatar_color: me.avatar_color || '#2E2E2E' });
  const [home, setHome] = useState(me.home_lat != null ? { name: me.home_label, lat: me.home_lat, lng: me.home_lng } : null);
  const [all, setAll] = useState(!me.interests);
  const [interests, setInterests] = useState(me.interests || []);
  const [push, setPush] = useState(me.push_activities || []);
  const [pushFree, setPushFree] = useState(me.push_free !== false);
  const [pstate, setPstate] = useState('…');
  useEffect(() => { pushState().then(setPstate); }, []);
  const turnOn = async () => { try { setPstate(await enablePush()); } catch (e) { toast('Push hat nicht geklappt: ' + e.message); } };
  const [groupActs, setGroupActs] = useState([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { if (group) api.listGroupActivities(group.id).then(setGroupActs).catch(() => {}); }, [group?.id]);

  const acts = [...DEFAULT_ACTIVITIES.slice(0, 4), ...groupActs, ...(showAll ? DEFAULT_ACTIVITIES.slice(4) : [])]
    .filter((a, i, arr) => arr.findIndex(b => b.name === a.name) === i);
  const extra = [...interests, ...push].filter(n => !acts.some(a => a.name === n));
  const toggle = (list, set, n) => set(list.includes(n) ? list.filter(x => x !== n) : [...list, n]);

  const save = async () => {
    const me2 = await api.updateProfile({
      first_name: name.trim() || me.first_name, phone: phone.trim() || me.phone, ...av,
      home_label: home?.name ?? null, home_lat: home?.lat ?? null, home_lng: home?.lng ?? null,
      interests: all ? null : interests, push_activities: push, push_free: pushFree
    });
    onSaved(me2);
    toast('Gespeichert');
  };

  return (
    <div className="screen stack" style={{ gap: 26 }}>
      <div className="row" style={{ paddingTop: 6 }}>
        <button className="icon-btn" onClick={onBack} aria-label="Zurück"><Back /></button>
        <h1 className="h2">Profil & Einstellungen</h1>
      </div>

      <AvatarEditor me={me} value={av} onChange={setAv} toast={toast} />

      <section className="stack">
        <label className="field">Vorname<input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
        <label className="field">Handynummer<input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <PlaceSearch label="Heimadresse (für Entfernung und Fahrzeit)" placeholder="Straße und Ort" value={home} onPick={setHome} />
      </section>

      <section className="stack">
        <h2 className="label" style={{ margin: 0 }}>Was möchtest du sehen?</h2>
        <div className="row between">
          <span>Alle Aktivitäten anzeigen</span>
          <button className={'switch' + (all ? ' on' : '')} role="switch" aria-checked={all} aria-label="Alle Aktivitäten anzeigen" onClick={() => setAll(!all)} />
        </div>
        {!all && (
          <>
            <span className="small muted">Nur diese Aktivitäten erscheinen in deinem Feed:</span>
            <div className="chips wrap">
              {[...acts, ...extra.map(n => ({ name: n, icon: '' }))].map(a => (
                <button key={a.name} className={'chip accent' + (interests.includes(a.name) ? ' on' : '')} onClick={() => toggle(interests, setInterests, a.name)}>{a.icon} {a.name}</button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="stack">
        <h2 className="label" style={{ margin: 0 }}>Push-Nachrichten</h2>
        {pstate === 'on' && <div className="banner">Push ist auf diesem Handy eingeschaltet ✓</div>}
        {pstate === 'off' && <button className="btn primary block" onClick={turnOn}>Push auf diesem Handy einschalten</button>}
        {pstate === 'install' && <div className="banner">Auf dem iPhone funktioniert Push nur, wenn Joinly auf dem Home-Bildschirm liegt: in Safari Teilen → „Zum Home-Bildschirm“, dann Joinly von dort öffnen.</div>}
        {pstate === 'denied' && <div className="banner">Mitteilungen sind für Joinly blockiert. Du kannst sie in den Einstellungen deines Handys wieder erlauben.</div>}
        {pstate === 'unsupported' && <div className="banner">Dieser Browser unterstützt leider keine Push-Nachrichten.</div>}
        <div className="row between">
          <span>Wenn jemand „gerade frei“ ist oder „Kommt vorbei“ postet</span>
          <button className={'switch' + (pushFree ? ' on' : '')} role="switch" aria-checked={pushFree} aria-label="Push bei gerade frei und Kommt vorbei" onClick={() => setPushFree(!pushFree)} />
        </div>
        <span className="small muted">Wenn jemand bei deinem Status zusagt, bekommst du immer eine Nachricht. Außerdem bei diesen Aktivitäten:</span>
        <div className="chips wrap">
          {acts.map(a => (
            <button key={a.name} className={'chip accent' + (push.includes(a.name) ? ' on' : '')} onClick={() => toggle(push, setPush, a.name)}>{a.icon} {a.name}</button>
          ))}
        </div>
        <button className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll(!showAll)}>{showAll ? 'Weniger Aktivitäten' : 'Alle Aktivitäten zeigen'}</button>
      </section>

      {api.demo && (
        <button className="btn ghost block" onClick={() => { api.reset(); location.reload(); }}>Demo zurücksetzen</button>
      )}

      <div className="bottom"><div className="bottom-inner">
        <button className="fab" onClick={save}>Speichern</button>
      </div></div>
    </div>
  );
}
