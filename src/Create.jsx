import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { DEFAULT_ACTIVITIES } from './activities.js';
import IconPicker from './IconPicker.jsx';
import { homeOf, Emo } from './common.jsx';
import { Bell, Close, WeatherIcon } from './Icons.jsx';
import PlaceSearch from './PlaceSearch.jsx';
import { weatherFor, searchPlaces, FALLBACK_POS } from './services.js';
import MapView from './MapView.jsx';
import { addDays, combine, dayChip, dayDiff, dayKey, dayName, hhmm, multiDay, nextHalfHour, parseDay, startOfDay, timeOptions } from './time.js';

const TIMES = timeOptions();
const plus2h = (t) => { const i = TIMES.indexOf(t); return TIMES[Math.min(TIMES.length - 1, (i < 0 ? 0 : i) + 4)]; };

export default function Create({ me, group, onClose, onPosted, existing, prefill, onIdea }) {
  const ex = existing;
  const pre = prefill;
  const now = new Date();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfDay(now), i)), []);
  const [groupActs, setGroupActs] = useState([]);
  const [act, setAct] = useState(ex ? { name: ex.activity, icon: ex.icon } : pre ? { name: pre.title.slice(0, 40), icon: pre.icon || '✨' } : DEFAULT_ACTIVITIES[0]);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState('');
  const [custom, setCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState('✨');
  const [startDay, setStartDay] = useState(() => ex ? startOfDay(new Date(ex.starts_at)) : pre?.from ? parseDay(pre.from) : startOfDay(now));
  const [multi, setMulti] = useState(() => ex ? multiDay(ex) : !!(pre?.to && pre.to !== pre.from));
  const [endDay, setEndDay] = useState(() => ex && multiDay(ex) ? startOfDay(new Date(new Date(ex.ends_at).getTime() - 60000)) : pre?.to ? parseDay(pre.to) : null);
  const [pickDate, setPickDate] = useState(() => dayDiff(startDay, now) > 6);
  const first = pre ? '10:00' : TIMES.includes(nextHalfHour(now)) ? nextHalfHour(now) : '09:00';
  const [from, setFrom] = useState(ex ? hhmm(ex.starts_at) : first);
  const [to, setTo] = useState(ex ? hhmm(ex.ends_at) : pre ? '18:00' : plus2h(first));
  const [mode, setMode] = useState(ex ? ex.place_mode : 'search');
  const [place, setPlace] = useState(ex && ex.place_mode === 'search' && ex.place_lat != null
    ? { name: ex.place_name, sub: ex.place_address, lat: ex.place_lat, lng: ex.place_lng } : null);
  const [typed, setTyped] = useState('');
  const [meet, setMeet] = useState(ex && ex.place_mode === 'meet' ? ex.place_name || '' : '');
  const [note, setNote] = useState(ex?.note || pre?.note?.slice(0, 120) || '');
  const [wx, setWx] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { api.listGroupActivities(group.id).then(setGroupActs).catch(() => {}); }, [group.id]);

  const lastDay = multi && endDay && endDay > startDay ? endDay : startDay;
  const start = combine(startDay, from);
  const end = combine(lastDay, to);
  const day = days.findIndex(d => +d === +startDay);
  const pos = (mode === 'search' && place) || homeOf(me) || FALLBACK_POS;

  useEffect(() => {
    setWx(undefined);
    if (end <= start) return;
    let live = true;
    weatherFor(pos.lat, pos.lng, start.toISOString(), end.toISOString())
      .then(w => live && setWx(w)).catch(() => live && setWx(null));
    return () => { live = false; };
  }, [+startDay, +lastDay, from, to, pos.lat, pos.lng]);

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
      // Ort eingetippt, aber keinen Vorschlag angetippt? Dann automatisch den besten Treffer nehmen.
      let pl = place;
      if (mode === 'search' && !pl && typed.trim().length >= 3) {
        const hits = await searchPlaces(typed.trim(), homeOf(me)).catch(() => []);
        pl = hits[0] || null;
      }
      const meetText = mode === 'meet' ? meet.trim() : (mode === 'search' && !pl ? typed.trim() : '');
      const placeData = mode === 'search' && pl
        ? { place_mode: 'search', place_name: pl.name, place_address: pl.sub || null, place_lat: pl.lat, place_lng: pl.lng }
        : meetText
          ? { place_mode: 'meet', place_name: meetText, place_address: null, place_lat: null, place_lng: null }
          : { place_mode: 'none', place_name: null, place_address: null, place_lat: null, place_lng: null };
      const data = { activity: chosen.name, icon: chosen.icon, ...(pre?.ideaId ? { idea_id: pre.ideaId } : {}),
        starts_at: start.toISOString(), ends_at: end.toISOString(), note: note.trim() || null, ...placeData };
      if (isEdit) await api.updateStatus(ex.id, data);
      else await api.createStatus({ group_id: group.id, ...data });
      if (pre?.ideaId) await api.updateIdea(pre.ideaId, { stage: 'planned' }).catch(() => {});
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
        <h1 className="h2">{isEdit ? 'Status bearbeiten' : pre ? 'Als Aktivität planen' : 'Ich bin offen für …'}</h1>
      </div>

      <section className="stack">
        <h2 className="label" style={{ margin: 0 }}>Aktivität</h2>
        <div className="chips wrap">
          {favorites.map(a => (
            <button key={a.name} className={'chip accent' + (!custom && act.name === a.name ? ' on' : '')}
              onClick={() => { setAct(a); setCustom(false); }}><Emo i={a.icon} /> {a.name}</button>
          ))}
          {!favorites.some(f => f.name === act.name) && !custom && (
            <button className="chip accent on"><Emo i={act.icon} /> {act.name}</button>
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
                  onClick={() => { setAct(a); setShowAll(false); setFilter(''); }}><Emo i={a.icon} /> {a.name}</button>
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
            <IconPicker value={customIcon} onChange={setCustomIcon} />
            <span className="small muted">Eigene Aktivitäten stehen danach für die ganze Gruppe zur Auswahl.</span>
          </div>
        )}
      </section>

      <section className="stack">
        <h2 className="label" style={{ margin: 0 }}>Wann</h2>
        <div className="chips">
          {days.map((d, i) => (
            <button key={i} className={'chip accent' + (!pickDate && i === day ? ' on' : '')} onClick={() => { setStartDay(d); setPickDate(false); if (endDay && endDay <= d) setEndDay(addDays(d, 1)); }}>
              {dayChip(d, now)}{i > 1 ? ` ${d.getDate()}.` : ''}
            </button>
          ))}
          <button className={'chip accent' + (pickDate ? ' on' : '')} onClick={() => setPickDate(true)}>📅 Datum</button>
        </div>
        {pickDate && (
          <label className="field">Datum
            <input className="input" type="date" value={dayKey(startDay)} min={dayKey(now)}
              onChange={(e) => { if (!e.target.value) return; const d = parseDay(e.target.value); setStartDay(d); if (endDay && endDay <= d) setEndDay(addDays(d, 1)); }} />
          </label>
        )}
        <label className="row small soft" style={{ gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={multi} onChange={(e) => { setMulti(e.target.checked); if (e.target.checked && (!endDay || endDay <= startDay)) setEndDay(addDays(startDay, 2)); }}
            style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
          Geht über mehrere Tage (z. B. Urlaub)
        </label>
        {multi && (
          <label className="field">Bis einschließlich
            <input className="input" type="date" value={endDay ? dayKey(endDay) : ''} min={dayKey(addDays(startDay, 1))}
              onChange={(e) => e.target.value && setEndDay(parseDay(e.target.value))} />
          </label>
        )}
        <div className="grid2">
          <label className="field">{multi ? 'Los geht’s um' : 'Von'}
            <select className="input" value={from} onChange={(e) => { setFrom(e.target.value); if (!multi && e.target.value >= to) setTo(plus2h(e.target.value)); }}>
              {TIMES.map(t => <option key={t} value={t}>{t} Uhr</option>)}
            </select>
          </label>
          <label className="field">{multi ? 'Ende am letzten Tag' : 'Bis'}
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
          <span className="time">Wetter {multi ? `ab ${dayName(startDay, now)}` : `${dayName(startDay, now)}, ${from} – ${to} Uhr`}</span>
          <span style={{ fontSize: 17, fontWeight: 700 }}>
            {wx === undefined ? 'Wird geladen …' : wx === null ? (dayDiff(startDay, now) > 6 ? 'Noch zu weit weg für eine Vorhersage' : 'Keine Vorhersage') : wx.label}
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
          <>
            <PlaceSearch label="Ort suchen" placeholder="z. B. See, Park, Restaurant" value={place} onPick={setPlace} onText={(v) => { setTyped(v); if (place && v !== place.name) setPlace(null); }} near={homeOf(me)} />
            {place
              ? <div className="map" style={{ height: 170, borderRadius: 14, overflow: 'hidden' }}><MapView place={place} /></div>
              : typed.trim().length >= 3 && <span className="small muted">Tipp einen Vorschlag an, damit der Ort auf der Karte erscheint.</span>}
          </>
        )}
        {mode === 'meet' && (
          <label className="field">Treffpunkt beschreiben
            <input className="input" value={meet} onChange={(e) => setMeet(e.target.value)} placeholder="z. B. Eingang Stadtpark, in der Stadt" maxLength={80} />
          </label>
        )}
      </section>

      <label className="field">Kurze Notiz (optional)
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="z. B. Eher gemütlich, danach Kaffee?" />
      </label>

      <div className="row muted" style={{ alignItems: 'flex-start', fontSize: 14, lineHeight: '20px' }}>
        <Bell size={18} />
        <span>{isEdit ? 'Alle, die schon zugesagt haben, sehen die Änderung sofort.' : pre ? 'Alle, die bei der Idee Lust hatten, bekommen eine Nachricht. Danach können sie wie gewohnt zu- oder absagen.' : `Alle in „${group.name}“ sehen deinen Status sofort. Wer Push für ${chosen.name || 'diese Aktivität'} eingeschaltet hat, bekommt eine Nachricht.`}</span>
      </div>
      {err && <div className="banner" style={{ color: 'var(--danger)' }}>{err}</div>}

      {!isEdit && !pre && onIdea && (
        <button className="btn ghost block" onClick={() => onIdea({ title: chosen.name || '', icon: chosen.icon, note: note.trim() })}>
          🪣 Noch kein Datum? Als Idee auf die Bucket List
        </button>
      )}

      <div className="bottom"><div className="bottom-inner">
        <button className="fab" disabled={!ok} onClick={post} style={!ok ? { opacity: 0.5 } : undefined}>
          {busy ? 'Wird gespeichert …' : isEdit ? 'Änderungen speichern' : pre ? 'Termin festmachen' : 'Status posten'}
        </button>
      </div></div>
    </div>
  );
}
