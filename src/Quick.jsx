import { useState } from 'react';
import { api } from './api.js';
import { Close } from './Icons.jsx';
import PlaceSearch from './PlaceSearch.jsx';
import IconPicker from './IconPicker.jsx';
import { homeOf, Emo } from './common.jsx';
import { hhmm } from './time.js';

const PLACES_KEY = 'joinly-open-places';
const readPlaces = () => { try { return JSON.parse(localStorage.getItem(PLACES_KEY)) || []; } catch { return []; } };
const writePlaces = (list) => { try { localStorage.setItem(PLACES_KEY, JSON.stringify(list.slice(0, 5))); } catch { /* egal */ } };

const OPEN_ICONS = ['🔧', '🏠', '🍺', '🔥', '🌳', '☕', '🎮', '🚪'];

// Ende: in X Minuten oder heute um HH:MM
function endOptions(now) {
  const opts = [60, 120, 180].map(m => ({ label: `${m / 60} Std.`, end: new Date(now.getTime() + m * 60000) }));
  for (const h of [18, 20, 22]) {
    const d = new Date(now); d.setHours(h, 0, 0, 0);
    if (d - now > 3.5 * 3600000) opts.push({ label: `bis ${h} Uhr`, end: d });
  }
  return opts;
}

export default function Quick({ kind, me, group, onClose, onPosted }) {
  const now = new Date();
  const opts = endOptions(now);
  const [endIdx, setEndIdx] = useState(1);
  const [note, setNote] = useState('');
  const saved = readPlaces();
  const [mode, setMode] = useState(saved.length ? 'saved' : 'meet');
  const [savedIdx, setSavedIdx] = useState(0);
  const [meet, setMeet] = useState('');
  const [place, setPlace] = useState(null);
  const [icon, setIcon] = useState(saved[0]?.icon || '🔧');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isOpen = kind === 'open';

  const chosenPlace = !isOpen ? null
    : mode === 'saved' ? saved[savedIdx]
    : mode === 'search' ? (place && { place_mode: 'search', place_name: place.name, place_address: place.sub || null, place_lat: place.lat, place_lng: place.lng })
    : meet.trim() ? { place_mode: 'meet', place_name: meet.trim(), place_address: null, place_lat: null, place_lng: null } : null;
  const ok = !busy && (!isOpen || chosenPlace);

  const post = async () => {
    if (!ok) return;
    setBusy(true); setErr('');
    try {
      const placeData = isOpen
        ? { place_mode: chosenPlace.place_mode, place_name: chosenPlace.place_name, place_address: chosenPlace.place_address ?? null,
            place_lat: chosenPlace.place_lat ?? null, place_lng: chosenPlace.place_lng ?? null }
        : { place_mode: 'none', place_name: null };
      await api.createStatus({
        group_id: group.id, kind,
        activity: isOpen ? 'Kommt vorbei' : 'Gerade frei',
        icon: isOpen ? icon : '👋',
        starts_at: now.toISOString(), ends_at: opts[endIdx].end.toISOString(),
        note: note.trim() || null, ...placeData
      });
      if (isOpen) {
        const entry = { ...placeData, icon };
        writePlaces([entry, ...saved.filter(p => p.place_name !== entry.place_name)]);
      }
      onPosted();
    } catch (e) {
      setErr('Hat nicht geklappt: ' + e.message);
      setBusy(false);
    }
  };

  return (
    <div className="screen stack" style={{ gap: 26 }}>
      <div className="row" style={{ paddingTop: 6 }}>
        <button className="icon-btn" onClick={onClose} aria-label="Abbrechen"><Close /></button>
        <h1 className="h2">{isOpen ? 'Kommt vorbei' : 'Ich bin gerade frei'}</h1>
      </div>
      <p className="soft" style={{ margin: '-10px 0 0', lineHeight: '22px' }}>
        {isOpen
          ? 'Du bist irgendwo, wo die anderen einfach dazukommen können, zum Beispiel in deiner Werkstatt oder im Garten.'
          : 'Zeig deinen Freunden, dass du ab jetzt Zeit hast. Wer Lust hat, meldet sich.'}
      </p>

      {isOpen && (
        <section className="stack">
          <h2 className="label" style={{ margin: 0 }}>Wo bist du?</h2>
          {saved.length > 0 && (
            <div className="chips wrap">
              {saved.map((p, i) => (
                <button key={p.place_name} className={'chip accent' + (mode === 'saved' && savedIdx === i ? ' on' : '')}
                  onClick={() => { setMode('saved'); setSavedIdx(i); setIcon(p.icon || '🔧'); }}><Emo i={p.icon} /> {p.place_name}</button>
              ))}
              <button className={'chip' + (mode !== 'saved' ? ' on' : '')} onClick={() => setMode('meet')}>+ Anderer Ort</button>
            </div>
          )}
          {mode !== 'saved' && (
            <>
              <div className="seg" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} role="tablist">
                {[['meet', 'Beschreiben'], ['search', 'Adresse suchen']].map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>
                ))}
              </div>
              {mode === 'meet' && (
                <label className="field">Ort
                  <input className="input" value={meet} onChange={(e) => setMeet(e.target.value)} placeholder="z. B. Meine Werkstatt, Garten" maxLength={60} />
                </label>
              )}
              {mode === 'search' && <PlaceSearch label="Adresse" placeholder="Straße und Ort" value={place} onPick={setPlace} near={homeOf(me)} />}
              <span className="small muted">Symbol</span>
              <IconPicker value={icon} onChange={setIcon} />
              <span className="small muted">Der Ort wird auf diesem Handy gemerkt, damit es nächstes Mal mit einem Tipp geht. Mit „Adresse suchen“ können die anderen direkt hin navigieren.</span>
            </>
          )}
        </section>
      )}

      <section className="stack">
        <h2 className="label" style={{ margin: 0 }}>Wie lange?</h2>
        <div className="chips wrap">
          {opts.map((o, i) => (
            <button key={o.label} className={'chip accent' + (i === endIdx ? ' on' : '')} onClick={() => setEndIdx(i)}>{o.label}</button>
          ))}
        </div>
        <span className="small muted">Ab jetzt bis {hhmm(opts[endIdx].end)} Uhr</span>
      </section>

      <label className="field">Kurze Notiz (optional)
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120}
          placeholder={isOpen ? 'z. B. Grill ist an, bringt was zu trinken mit' : 'z. B. Lust auf Kaffee oder kurz raus'} />
      </label>

      {err && <div className="banner" style={{ color: 'var(--danger)' }}>{err}</div>}
      <div className="bottom"><div className="bottom-inner">
        <button className="fab" disabled={!ok} onClick={post} style={!ok ? { opacity: 0.5 } : undefined}>
          {busy ? 'Einen Moment …' : isOpen ? 'Tür aufmachen' : 'Jetzt frei melden'}
        </button>
      </div></div>
    </div>
  );
}
