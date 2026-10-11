import { useEffect, useState } from 'react';
import { api } from './api.js';
import { DEFAULT_ACTIVITIES } from './activities.js';
import { Back } from './Icons.jsx';
import PlaceSearch from './PlaceSearch.jsx';

export default function Profile({ me, group, onBack, onSaved, toast }) {
  const [name, setName] = useState(me.first_name || '');
  const [phone, setPhone] = useState(me.phone || '');
  const [home, setHome] = useState(me.home_lat != null ? { name: me.home_label, lat: me.home_lat, lng: me.home_lng } : null);
  const [all, setAll] = useState(!me.interests);
  const [interests, setInterests] = useState(me.interests || []);
  const [push, setPush] = useState(me.push_activities || []);
  const [groupActs, setGroupActs] = useState([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { if (group) api.listGroupActivities(group.id).then(setGroupActs).catch(() => {}); }, [group?.id]);

  const acts = [...DEFAULT_ACTIVITIES.slice(0, 4), ...groupActs, ...(showAll ? DEFAULT_ACTIVITIES.slice(4) : [])]
    .filter((a, i, arr) => arr.findIndex(b => b.name === a.name) === i);
  const extra = [...interests, ...push].filter(n => !acts.some(a => a.name === n));
  const toggle = (list, set, n) => set(list.includes(n) ? list.filter(x => x !== n) : [...list, n]);

  const save = async () => {
    const me2 = await api.updateProfile({
      first_name: name.trim() || me.first_name, phone: phone.trim() || me.phone,
      home_label: home?.name ?? null, home_lat: home?.lat ?? null, home_lng: home?.lng ?? null,
      interests: all ? null : interests, push_activities: push
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
        <h2 className="label" style={{ margin: 0 }}>Push-Nachricht bei …</h2>
        <span className="small muted">Wähl aus, bei welchen Aktivitäten du benachrichtigt werden willst. Die Nachrichten selbst kommen mit der nächsten Version.</span>
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
