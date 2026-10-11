import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { Avatar, useExtras, homeOf, placeOf } from './common.jsx';
import { Back, Chat, Nav, Pin, Send, Share, Trash, WeatherIcon } from './Icons.jsx';
import { statusTexts, kindOf } from './Feed.jsx';
import { dayLabel, hhmm } from './time.js';
import { googleMapsUrl, appleMapsUrl, isApple } from './services.js';
import MapView from './MapView.jsx';

export default function Detail({ s, me, onBack, onToggle, onDelete, onEdit, onEnd, onShare, tick }) {
  const t = statusTexts(s, me);
  const k = kindOf(s);
  const { wx, drive } = useExtras(s, me);
  const [chatOpen, setChatOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef();
  const isHost = s.profile_id === me.id;
  const joined = s.participants.some(p => p.profile_id === me.id);
  const people = [s.author, ...s.participants.map(p => p.profiles)].filter(Boolean);
  const place = placeOf(s);
  const hasPlace = s.place_mode !== 'none' && s.place_name;

  useEffect(() => {
    if (!chatOpen) return;
    api.listMessages(s.id).then(setMsgs).catch(() => {});
  }, [chatOpen, s.id, tick]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    await api.sendMessage(s.id, body);
    setMsgs(await api.listMessages(s.id));
  };

  return (
    <div style={{ paddingBottom: 'calc(120px + var(--safe-bottom))' }}>
      <div className="map">
        {place ? <MapView place={place} home={homeOf(me)} /> : <div className="map-empty">{hasPlace ? s.place_name : 'Ort noch offen'}</div>}
        <button className="icon-btn map-back" onClick={onBack} aria-label="Zurück"><Back size={22} /></button>
        <button className="icon-btn map-back" style={{ left: 'auto', right: 16 }} onClick={() => onShare(s)} aria-label="Status teilen"><Share size={20} /></button>
      </div>

      <div style={{ padding: '24px 20px' }} className="stack">
        <div className="col" style={{ gap: 6 }}>
          <span style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 700 }}>
            {t.live && k !== 'plan' ? t.time : `${dayLabel(new Date(s.starts_at))} · ${hhmm(s.starts_at)} – ${hhmm(s.ends_at)} Uhr`}
          </span>
          <h1 className="h1">{s.icon} {t.title}</h1>
          <span className="soft">{t.sub}</span>
          {s.note && <span className="soft" style={{ marginTop: 6, fontSize: 16, lineHeight: '22px' }}>„{s.note}“</span>}
        </div>

        <div className="list" style={{ marginTop: 8 }}>
          <div className="list-item">
            <span className="muted"><Pin size={22} /></span>
            <div className="col" style={{ gap: 2 }}>
              <span style={{ fontWeight: 600 }}>{hasPlace ? s.place_name : 'Ort noch offen'}</span>
              <span className="small muted">
                {s.place_mode === 'meet' ? 'Treffpunkt' : hasPlace && s.place_address && !drive ? s.place_address : hasPlace ? (drive ? `${drive.km} km · ca. ${drive.min} Min. mit dem Auto` : (homeOf(me) ? 'Fahrzeit wird berechnet …' : 'Heimadresse im Profil eintragen für die Fahrzeit')) : 'Wird im Chat ausgemacht'}
              </span>
            </div>
          </div>
          <div className="list-item">
            <span className="muted"><WeatherIcon kind={wx?.kind || 'cloud'} size={22} /></span>
            <div className="col" style={{ gap: 2 }}>
              <span style={{ fontWeight: 600 }}>{wx ? `${wx.label}, ${wx.temp} °C` : 'Wetter noch nicht verfügbar'}</span>
              <span className="small muted">{wx ? `Regenrisiko ${wx.rain} %` : 'Vorhersage gibt es für die nächsten 7 Tage'}</span>
            </div>
          </div>
        </div>

        {hasPlace && (s.place_lat != null || s.place_address) && (
          isApple()
            ? <div className="grid2">
                <a className="btn white block" href={googleMapsUrl(s)} target="_blank" rel="noopener"><Nav /> Google Maps</a>
                <a className="btn white block" href={appleMapsUrl(s)} target="_blank" rel="noopener"><Nav /> Apple Karten</a>
              </div>
            : <a className="btn white block" href={googleMapsUrl(s)} target="_blank" rel="noopener"><Nav /> Route starten</a>
        )}

        <div className="stack" style={{ marginTop: 12 }}>
          <h2 className="label" style={{ margin: 0 }}>Dabei ({people.length})</h2>
          {people.map(p => (
            <div key={p.id} className="row"><Avatar p={p} me={me} lg /><span style={{ fontWeight: 600 }}>{p.id === me.id ? 'Du' : p.first_name}</span></div>
          ))}
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

        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => onShare(s)}><Share size={18} /> Status teilen</button>
        {isHost && k === 'plan' && (
          <button className="btn ghost block" onClick={onEdit}>Status bearbeiten</button>
        )}
        {isHost && k !== 'plan' && t.live && (
          <button className="btn ghost block" onClick={() => onEnd(s)}>Jetzt beenden</button>
        )}
        {isHost && (
          <button className="btn danger block" style={{ marginTop: 8 }} onClick={() => { if (confirm('Status löschen?')) onDelete(s.id); }}>
            <Trash size={18} /> Status löschen
          </button>
        )}
      </div>

      <div className="bottom"><div className="bottom-inner">
        {isHost
          ? <div className="btn ghost block" style={{ cursor: 'default' }}>Das ist dein Status</div>
          : <button className={'fab'} style={joined ? { background: 'transparent', color: '#fff', border: '1px solid #3A3A3A' } : undefined}
              onClick={() => onToggle(s)}>{joined ? `${t.joinedLabel} · Absagen` : t.joinLabel}</button>}
      </div></div>
    </div>
  );
}
