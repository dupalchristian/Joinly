import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { DEFAULT_ACTIVITIES, ICON_CHOICES } from './activities.js';
import { homeOf } from './common.jsx';
import { Bell, Close, WeatherIcon } from './Icons.jsx';
import PlaceSearch from './PlaceSearch.jsx';
import { weatherFor, FALLBACK_POS } from './services.js';
import { addDays, combine, dayChip, dayDiff, dayName, hhmm, nextHalfHour, startOfDay, timeOptions } from './time.js';

const TIMES = timeOptions();
const plus2h = (t) => { const i = TIMES.indexOf(t); return TIMES[Math.min(TIMES.length - 1, (i < 0 ? 0 : i) + 4)]; };

export default function Create({ me, group, onClose, onPosted, existing }) {
  const ex = existing;
  const now = new Date();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfDay(now), i)), []);
  const [groupActs, setGroupActs] = useState([]);
  const [act, setAct] = useState(ex ? { name: ex.activity, icon: ex.icon } : DEFAULT_ACTIVITIES[0]);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState('');
  const [custom, setCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState('✨');
  const [day, setDay] = useState(ex ? Math.min(6, Math.max(0, dayDiff(new Date(ex.starts_at), now))) : 0);
  const first = TIMES.includes(nextHalfHour(now)) ? nextHalfHour(now) : '09:00';
  const [from, setFrom] = useState(ex ? hhmm(ex.starts_at) : first);
  const [to, setTo] = useState(ex ? hhmm(ex.ends_at) : plus2h(first));
  const [mode, setMode] = useState(ex ? ex.place_mode : 'search');
  const [place, setPlace] = useState(ex && ex.place_mode === 'search' && ex.place_lat != null
    ? { name: ex.place_name, sub: ex.place_address, lat: ex.place_lat, lng: ex.place_lng } : null);
  const [meet, setMeet] = useState(ex && ex.place_mode === 'meet' ? ex.place_name || '' : '');
  const [wx, setWx] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { api.listGroupActivities(group.id).then(setGroupActs).catch(() => {}); }, [group.id]);

  const start = combine(days[day], from);
  const end = combine(days[day], to);
  const pos = (mode === 'search' && place) || homeOf(me) || FALLBACK_POS;

  useEffect(() => {
    setWx(undefined);
    if (end <= start) return;
    let live = true;
    weatherFor(pos.lat, pos.lng, start.toISOString(), end.toISOString())
      .then(w => live && setWx(w)).catch(() => live && setWx(null));
    return () => { live = false; };
  }, [day, from, to, pos.lat, pos.lng]);

  const favorites = [...DEFAULT_ACTIVITIES.slice(0, 4), ...groupActs.map(a => ({ name: a.name, icon: a.icon }))];
  const all = DEFAULT_ACTIVITIES.filter(a => a.name.toLowerCase().includes(filter.toLowerCase()));
  const chosen = custom ? { name: customName.trim(), icon: customIcon } : act;
  const timeOk = end > start && end > now;
  const isEdit = !!ex;
  const ok = chosen.name && timeOk && !busy;

  const post = async () => {
    if (!ok) return;
    setBusy(true); setErr('');
    try {
      if (custom) await api.addGroupActivity(group.id, chosen.name, chosen.icon);
      const placeData = mode === 'search' && place
        ? { place_mode: 'search', place_name: place.name, place_address: place.sub || null, place_lat: place.lat, place_lng: place.lng }
        : mode === 'meet' && meet.trim()
          ? { place_mode: 'meet', place_name: meet.trim(), place_address: null, place_lat: null, place_lng: null }
          : { place_mode: 'none', place_name: null, place_address: null, place_lat: null, place_lng: null };
      const data = { activity: chosen.name, icon: chosen.icon,
        starts_at: start.toISOString(), ends_at: end.toISOString(), ...placeData };
      if (isEdit) await api.updateStatus(ex.id, data);
      else await api.createStatus({ group_id: group.id, ...data });
      onPosted();
    } catch (e) {
      setErr((isEdit ? 'Speichern' : 'Posten') + ' hat nicht geklappt: ' + e.message);
      setBusy(false);
    }
  };

  return (
    <div className="screen stack" style={{ gap: 26 }}>
      <div className="row" style={{ paddingTop: 6 }}>
        <button className="icon-btn" onClick={onClose} aria-label="Abbrechen"><Close /></button>
        <h1 className="h2">{isEdit ? 'Status bearbeiten' : 'Ich bin offen für …'}</h1>
      </div>

      <section className="stack">
        <h2 className="label" style={{ margin: 0 }}>Aktivität</h2>
        <div className="chips wrap">
          {favorites.map(a => (
            <button key={a.name} className={'chip accent' + (!custom && act.name === a.name ? ' on' : '')}
              onClick={() => { setAct(a); setCustom(false); }}>{a.icon} {a.name}</button>
          ))}
          {!favorites.some(f => f.name === act.name) && !custom && (
            <button className="chip accent on">{act.icon} {act.name}</button>
          )}
          <button className="chip" onClick={() => { setShowAll(!showAll); setCustom(false); }}>{showAll ? 'Weniger' : 'Mehr …'}</button>
          <button className={'chip accent' + (custom ? ' on' : '')} onClick={() => { setCustom(true); setShowAll(false); }}>+ Eigene</button>
        </div>
        {showAll && (
          <div className="stack">
            <label className="sr" htmlFor="actfilter">Aktivität suchen</label>
            <input id="actfilter" className="input" placeholder="Aktivität suchen …" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="chips wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {all.map(a => (
                <button key={a.name} className={'chip accent' + (act.name === a.name ? ' on' : '')}
                  onClick={() => { setAct(a); setShowAll(false); setFilter(''); }}>{a.icon} {a.name}</button>
              ))}
            </div>
          </div>
        )}
        {custom && (
          <div className="stack">
            <label className="field">Name der Aktivität
              <input className="input" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="z. B. Daydrinking" maxLength={40} />
            </label>
            <span className="small muted">Symbol</span>
            <div className="emoji-grid" role="radiogroup" aria-label="Symbol wählen">
              {ICON_CHOICES.map(i => (
                <button key={i} role="radio" aria-checked={i === customIcon} className={i === customIcon ? 'on' : ''} onClick={() => setCustomIcon(i)}>{i}</button>
              ))}
            </div>
            <span className="small muted">Eigene Aktivitäten stehen danach für die ganze Gruppe zur Auswahl.</span>
          </div>
        )}
      </section>

      <section className="stack">
        <h2 className="label" style={{ margin: 0 }}>Wann</h2>
        <div className="chips">
          {days.map((d, i) => (
            <button key={i} className={'chip accent' + (i === day ? ' on' : '')} onClick={() => setDay(i)}>
              {dayChip(d, now)}{i > 1 ? ` ${d.getDate()}.` : ''}
            </button>
          ))}
        </div>
        <div className="grid2">
          <label className="field">Von
            <select className="input" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value >= to) setTo(plus2h(e.target.value)); }}>
              {TIMES.map(t => <option key={t} value={t}>{t} Uhr</option>)}
            </select>
          </label>
          <label className="field">Bis
            <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
              {TIMES.map(t => <option key={t} value={t}>{t} Uhr</option>)}
            </select>
          </label>
        </div>
        {!timeOk && <span className="small" style={{ color: 'var(--danger)' }}>Bitte ein Zeitfenster in der Zukunft wählen.</span>}
      </section>

      <div className="card" style={{ flexDirection: 'row', alignItems: 'center' }} aria-live="polite">
        <div className="icon-tile" style={{ color: 'var(--accent)' }}><WeatherIcon kind={wx?.kind || 'cloud'} size={24} /></div>
        <div className="col grow" style={{ gap: 2 }}>
          <span className="time">Wetter {dayName(days[day], now)}, {from} – {to} Uhr</span>
          <span style={{ fontSize: 17, fontWeight: 700 }}>
            {wx === undefined ? 'Wird geladen …' : wx === null ? 'Keine Vorhersage' : wx.label}
          </span>
          {wx && <span className="small muted">Regenrisiko {wx.rain} %{mode === 'search' && place ? ` · ${place.name}` : ''}</span>}
        </div>
        {wx && <span style={{ fontSize: 26, fontWeight: 700 }}>{wx.temp}°</span>}
      </div>

      <section className="stack">
        <h2 className="label" style={{ margin: 0 }}>Ort (optional)</h2>
        <div className="seg" role="tablist">
          {[['search', 'Ort suchen'], ['meet', 'Treffpunkt'], ['none', 'Noch offen']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>
          ))}
        </div>
        {mode === 'search' && (
          <PlaceSearch label="Ort suchen" placeholder="z. B. See, Park, Restaurant" value={place} onPick={setPlace} near={homeOf(me)} />
        )}
        {mode === 'meet' && (
          <label className="field">Treffpunkt beschreiben
            <input className="input" value={meet} onChange={(e) => setMeet(e.target.value)} placeholder="z. B. Eingang Stadtpark, in der Stadt" maxLength={80} />
          </label>
        )}
      </section>

      <div className="row muted" style={{ alignItems: 'flex-start', fontSize: 14, lineHeight: '20px' }}>
        <Bell size={18} />
        <span>{isEdit ? 'Alle, die schon zugesagt haben, sehen die Änderung sofort.' : `Alle in „${group.name}“ sehen deinen Status sofort. Push-Nachrichten kommen in der nächsten Version.`}</span>
      </div>
      {err && <div className="banner" style={{ color: 'var(--danger)' }}>{err}</div>}

      <div className="bottom"><div className="bottom-inner">
        <button className="fab" disabled={!ok} onClick={post} style={!ok ? { opacity: 0.5 } : undefined}>
          {busy ? 'Wird gespeichert …' : isEdit ? 'Änderungen speichern' : 'Status posten'}
        </button>
      </div></div>
    </div>
  );
}
