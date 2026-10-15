import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { Emo, Avatar, useExtras, homeOf, placeOf } from './common.jsx';
import { Back, Chat, Nav, Pin, Send, Share, Trash, WeatherIcon, Close } from './Icons.jsx';
import { statusTexts, kindOf, yesList, maybeList, noList, myAnswer, respOf, isLive } from './status.js';
import { dayLabel, hhmm } from './time.js';
import { googleMapsUrl, appleMapsUrl, isApple } from './services.js';
import RsvpBar from './Rsvp.jsx';
import MapView from './MapView.jsx';
import { shrinkImage } from './images.js';

const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? 'gerade eben' : m < 60 ? `vor ${m} Min.` : `vor ${Math.round(m / 60)} Std.`;
};

export default function Detail({ s, me, badges = {}, onBack, onRespond, onDelete, onEdit, onEnd, onShare, sharing, onToggleShare, tick, toast }) {
  const t = statusTexts(s, me);
  const k = kindOf(s);
  const { wx, drive } = useExtras(s, me);
  const [chatOpen, setChatOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [locs, setLocs] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(0);
  const [big, setBig] = useState(null);
  const endRef = useRef();
  const fileRef = useRef();
  const isHost = s.profile_id === me.id;
  const ended = new Date(s.ends_at) <= new Date();
  const live = isLive(s);
  const mine = myAnswer(s, me);
  const going = isHost || (mine && respOf(mine) === 'yes');
  const place = placeOf(s);
  const hasPlace = s.place_mode !== 'none' && s.place_name;
  const allPeople = [s.author, ...(s.participants || []).map(p => p.profiles)].filter(Boolean);
  const personOf = (id) => allPeople.find(p => p.id === id);

  useEffect(() => {
    if (!chatOpen) return;
    api.listMessages(s.id).then(setMsgs).catch(() => {});
  }, [chatOpen, s.id, tick]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);
  useEffect(() => { api.listPhotos(s.id).then(setPhotos).catch(() => {}); }, [s.id, tick]);
  useEffect(() => {
    if (!live) { setLocs([]); return; }
    const load = () => api.listLocations(s.id).then(setLocs).catch(() => {});
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, [s.id, live, tick]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    await api.sendMessage(s.id, body);
    setMsgs(await api.listMessages(s.id));
  };

  const addPhotos = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setUploading(files.length);
    for (const f of files) {
      try { await api.uploadStatusPhoto(s.id, await shrinkImage(f, 1600)); }
      catch (err) { toast?.('Foto hat nicht geklappt: ' + err.message); }
      setUploading(n => n - 1);
    }
    setPhotos(await api.listPhotos(s.id));
  };

  const freshLocs = locs.filter(l => Date.now() - new Date(l.updated_at) < 30 * 60000);
  const markers = freshLocs.map(l => {
    const p = personOf(l.profile_id) || { first_name: '?' };
    return { lat: l.lat, lng: l.lng, me: l.profile_id === me.id, img: p.avatar_url, color: p.avatar_color,
      label: l.profile_id === me.id ? 'Du' : (p.avatar_emoji || p.first_name.charAt(0)), title: p.first_name };
  });
  const showMap = place || markers.length > 0;

  const Person = ({ p, extra }) => (
    <div className="row">
      <Avatar p={p} me={me} lg badge={badges[p.id]} />
      <span style={{ fontWeight: 600 }}>{p.id === me.id ? 'Du' : p.first_name}</span>
      {extra}
    </div>
  );

  return (
    <div style={{ paddingBottom: 'calc(40px + var(--safe-bottom))' }}>
      <div className="map">
        {showMap ? <MapView place={place} home={homeOf(me)} markers={markers} /> : <div className="map-empty">{hasPlace ? s.place_name : 'Ort noch offen'}</div>}
        <button className="icon-btn map-back" onClick={onBack} aria-label="Zurück"><Back size={22} /></button>
        {!ended && <button className="icon-btn map-back" style={{ left: 'auto', right: 16 }} onClick={() => onShare(s)} aria-label="Status teilen"><Share size={20} /></button>}
      </div>

      <div style={{ padding: '24px 20px' }} className="stack">
        <div className="col" style={{ gap: 6 }}>
          <span style={{ fontSize: 14, color: ended ? 'var(--muted)' : 'var(--accent)', fontWeight: 700 }}>
            {ended ? `Beendet · ${dayLabel(new Date(s.starts_at))}, ${hhmm(s.starts_at)} Uhr`
              : t.live && k !== 'plan' ? t.time : `${dayLabel(new Date(s.starts_at))} · ${hhmm(s.starts_at)} – ${hhmm(s.ends_at)} Uhr`}
          </span>
          <h1 className="h1"><Emo i={s.icon} /> {t.title}</h1>
          <span className="soft">{t.sub}</span>
          {s.note && <span className="soft" style={{ marginTop: 6, fontSize: 16, lineHeight: '22px' }}>„{s.note}“</span>}
        </div>

        {!isHost && !ended && <RsvpBar s={s} me={me} onRespond={onRespond} />}

        {live && going && (
          <div className="card" style={{ gap: 10 }}>
            <div className="row between">
              <div className="col" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700 }}>📍 Live-Standort</span>
                <span className="small muted">{sharing ? 'Die anderen sehen, wo du gerade bist.' : 'Zeig den anderen, wo du gerade bist.'}</span>
              </div>
              <button className={'switch' + (sharing ? ' on' : '')} role="switch" aria-checked={!!sharing} aria-label="Standort teilen" onClick={() => onToggleShare(s)} />
            </div>
            {freshLocs.length > 0 && (
              <div className="stack" style={{ gap: 6 }}>
                {freshLocs.map(l => {
                  const p = personOf(l.profile_id);
                  return <span key={l.profile_id} className="small soft">{l.profile_id === me.id ? 'Du' : p?.first_name}: {ago(l.updated_at)}</span>;
                })}
              </div>
            )}
          </div>
        )}

        <div className="list" style={{ marginTop: 4 }}>
          <div className="list-item">
            <span className="muted"><Pin size={22} /></span>
            <div className="col" style={{ gap: 2 }}>
              <span style={{ fontWeight: 600 }}>{hasPlace ? s.place_name : 'Ort noch offen'}</span>
              <span className="small muted">
                {s.place_mode === 'meet' && !s.place_address ? 'Treffpunkt' : hasPlace ? [s.place_address, drive ? `${drive.km} km · ca. ${drive.min} Min. mit dem Auto` : (!homeOf(me) && place ? 'Heimadresse im Profil eintragen für die Fahrzeit' : null)].filter(Boolean).join(' · ') : 'Wird im Chat ausgemacht'}
              </span>
            </div>
          </div>
          {!ended && (
            <div className="list-item">
              <span className="muted"><WeatherIcon kind={wx?.kind || 'cloud'} size={22} /></span>
              <div className="col" style={{ gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{wx ? `${wx.label}, ${wx.temp} °C` : 'Wetter noch nicht verfügbar'}</span>
                <span className="small muted">{wx ? `Regenrisiko ${wx.rain} %` : 'Vorhersage gibt es für die nächsten 7 Tage'}</span>
              </div>
            </div>
          )}
        </div>

        {!ended && hasPlace && (s.place_lat != null || s.place_address) && (
          isApple()
            ? <div className="grid2">
                <a className="btn white block" href={googleMapsUrl(s)} target="_blank" rel="noopener"><Nav /> Google Maps</a>
                <a className="btn white block" href={appleMapsUrl(s)} target="_blank" rel="noopener"><Nav /> Apple Karten</a>
              </div>
            : <a className="btn white block" href={googleMapsUrl(s)} target="_blank" rel="noopener"><Nav /> Route starten</a>
        )}

        <div className="stack" style={{ marginTop: 12 }}>
          <h2 className="label" style={{ margin: 0 }}>{ended ? 'Waren dabei' : 'Dabei'} ({1 + yesList(s).length})</h2>
          <Person p={s.author} extra={<span className="tag">Gastgeber</span>} />
          {yesList(s).map(pa => (
            <Person key={pa.profile_id} p={pa.profiles} extra={pa.late_minutes ? <span className="tag late">+{pa.late_minutes} Min.</span> : null} />
          ))}
          {maybeList(s).length > 0 && <>
            <h2 className="label" style={{ margin: '8px 0 0' }}>Kommen evtl. nach ({maybeList(s).length})</h2>
            {maybeList(s).map(pa => <Person key={pa.profile_id} p={pa.profiles} />)}
          </>}
          {noList(s).length > 0 && (
            <span className="small muted" style={{ marginTop: 4 }}>Abgesagt: {noList(s).map(pa => pa.profile_id === me.id ? 'Du' : pa.profiles?.first_name).join(', ')}</span>
          )}
        </div>

        <div className="stack" style={{ marginTop: 12 }}>
          <div className="row between">
            <h2 className="label" style={{ margin: 0 }}>Fotos ({photos.length})</h2>
            <button className="chip" onClick={() => fileRef.current.click()} disabled={uploading > 0}>
              {uploading > 0 ? `Lädt hoch (${uploading}) …` : '📷 Foto hinzufügen'}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="sr" onChange={addPhotos} aria-label="Fotos hinzufügen" />
          {photos.length > 0
            ? <div className="photo-grid">
                {photos.map(f => <button key={f.id} onClick={() => setBig(f)} aria-label="Foto vergrößern"><img src={f.url} alt="" loading="lazy" /></button>)}
              </div>
            : <span className="small muted">Noch keine Fotos. Halte den Moment fest!</span>}
        </div>

        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => setChatOpen(!chatOpen)}>
          <Chat size={18} /> {chatOpen ? 'Chat schließen' : 'Chat öffnen'}
        </button>
        {chatOpen && (
          <div className="card" style={{ gap: 10 }}>
            {msgs.length === 0 && <span className="small muted">Noch keine Nachrichten.</span>}
            {msgs.map(m => (
              <div key={m.id} className={'bubble' + (m.profile_id === me.id ? ' mine' : '')}>
                {m.profile_id !== me.id && <b>{m.profiles?.first_name}: </b>}{m.body}
              </div>
            ))}
            <div ref={endRef} />
            <form className="row" onSubmit={send} style={{ gap: 8 }}>
              <label className="sr" htmlFor="msg">Nachricht</label>
              <input id="msg" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Nachricht …" maxLength={500} />
              <button className="icon-btn" style={{ background: 'var(--accent)', color: '#000' }} aria-label="Senden"><Send /></button>
            </form>
          </div>
        )}

        {!ended && <button className="btn ghost block" onClick={() => onShare(s)}><Share size={18} /> Status teilen</button>}
        {isHost && k === 'plan' && !ended && <button className="btn ghost block" onClick={onEdit}>Status bearbeiten</button>}
        {isHost && live && <button className="btn ghost block" onClick={() => onEnd(s)}>Jetzt beenden</button>}
        {isHost && (
          <button className="btn danger block" style={{ marginTop: 8 }} onClick={() => { if (confirm('Status endgültig löschen? Er verschwindet auch aus dem Verlauf.')) onDelete(s.id); }}>
            <Trash size={18} /> Status löschen
          </button>
        )}
      </div>

      {big && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Foto" onClick={() => setBig(null)}>
          <img src={big.url} alt="" />
          <div className="row" style={{ marginTop: 16, gap: 10 }} onClick={(e) => e.stopPropagation()}>
            <a className="btn white" href={big.url} target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Öffnen / Speichern</a>
            {(big.profile_id === me.id || isHost) && (
              <button className="btn danger" onClick={async () => { await api.deletePhoto(big); setBig(null); setPhotos(await api.listPhotos(s.id)); }}>Löschen</button>
            )}
            <button className="icon-btn" onClick={() => setBig(null)} aria-label="Schließen"><Close /></button>
          </div>
        </div>
      )}
    </div>
  );
}
