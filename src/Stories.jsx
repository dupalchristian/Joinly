import { useEffect, useRef, useState } from 'react';
import { Avatar, useExtras, placeText, Emo } from './common.jsx';
import { statusTexts, goingPeople } from './status.js';
import RsvpBar, { answerSummary } from './Rsvp.jsx';
import { Close, Pin, WeatherIcon, Plus } from './Icons.jsx';
import { dayLabel, hhmm } from './time.js';

const DURATION = 6000;

// Personen mit Status (wie bei WhatsApp/Instagram): eigener Kreis zuerst, dann wer gerade frei ist, dann nach Uhrzeit
export function buildStories(statuses, members, me, now = new Date()) {
  const byPerson = new Map();
  for (const s of statuses) {
    if (!byPerson.has(s.profile_id)) byPerson.set(s.profile_id, { person: s.author, statuses: [] });
    byPerson.get(s.profile_id).statuses.push(s);
  }
  const rows = [...byPerson.values()].map(r => {
    r.statuses.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    r.live = r.statuses.some(s => new Date(s.starts_at) <= now);
    r.first = r.statuses[0].starts_at;
    return r;
  });
  const mine = rows.find(r => r.person?.id === me.id) || { person: me, statuses: [], live: false };
  const others = rows.filter(r => r.person?.id !== me.id)
    .sort((a, b) => (b.live - a.live) || a.first.localeCompare(b.first));
  const idle = members.filter(m => m.status === 'active' && m.profile.id !== me.id && !byPerson.has(m.profile.id))
    .map(m => ({ person: m.profile, statuses: [], live: false }));
  return [{ ...mine, person: { ...me, ...(mine.person || {}) } }, ...others, ...idle];
}

export function StoryRow({ stories, me, badges = {}, onOpen, onCreate }) {
  return (
    <div className="stories" role="list" aria-label="Status deiner Freunde">
      {stories.map((r, i) => {
        const isMe = r.person.id === me.id;
        const has = r.statuses.length > 0;
        const label = isMe ? 'Du' : r.person.first_name;
        return (
          <div key={r.person.id} role="listitem" className="story">
            <button className="story-btn" onClick={() => (has ? onOpen(i) : isMe ? onCreate() : null)}
              aria-label={has ? `${label}: ${r.statuses.length} Status ansehen` : isMe ? 'Status erstellen' : `${label} hat gerade nichts geplant`}
              style={!has && !isMe ? { opacity: 0.45, cursor: 'default' } : undefined}>
              <Avatar p={r.person} me={me} size={62} ring={has ? (r.live ? 'live' : 'soon') : null} badge={badges[r.person.id]} />
              {has && <span className="story-badge" aria-hidden="true"><Emo i={r.statuses[0].icon} /></span>}
              {isMe && !has && <span className="story-badge plus" aria-hidden="true"><Plus size={14} /></span>}
            </button>
            <span className="story-name">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function StorySlide({ s, me }) {
  const { wx, drive } = useExtras(s, me);
  const t = statusTexts(s, me);
  return (
    <div className="col" style={{ gap: 14, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 88, lineHeight: 1 }} aria-hidden="true"><Emo i={s.icon} /></div>
      <h2 className="h1" style={{ fontSize: 32 }}>{t.title}</h2>
      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
        {t.live && (s.kind || 'plan') !== 'plan' ? t.time : `${dayLabel(new Date(s.starts_at))} · ${hhmm(s.starts_at)} – ${hhmm(s.ends_at)} Uhr`}
      </span>
      {s.note && <p className="soft" style={{ margin: 0, fontSize: 18, lineHeight: '26px' }}>„{s.note}“</p>}
      <div className="row" style={{ gap: 16, justifyContent: 'center', flexWrap: 'wrap', color: 'var(--soft)' }}>
        {(s.place_mode !== 'none' && s.place_name) && <span className="row" style={{ gap: 6 }}><Pin size={16} />{placeText(s, drive)}</span>}
        {wx && <span className="row" style={{ gap: 6 }}><WeatherIcon kind={wx.kind} size={16} />{wx.label}, {wx.temp}°</span>}
      </div>
    </div>
  );
}

export function StoryViewer({ stories, start, me, onClose, onRespond, onDetails }) {
  const seq = stories.flatMap((r, pi) => r.statuses.map((s, si) => ({ s, person: r.person, pi, si, n: r.statuses.length })));
  const startIdx = Math.max(0, seq.findIndex(x => x.pi === start));
  const [idx, setIdx] = useState(startIdx);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const t0 = useRef(Date.now());
  const cur = seq[idx];

  useEffect(() => { t0.current = Date.now(); setProgress(0); }, [idx]);
  useEffect(() => {
    if (paused || !cur) return;
    const begin = Date.now() - progress * DURATION;
    const iv = setInterval(() => {
      const p = (Date.now() - begin) / DURATION;
      if (p >= 1) { clearInterval(iv); next(); } else setProgress(p);
    }, 50);
    return () => clearInterval(iv);
  }, [idx, paused]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function next() { if (idx < seq.length - 1) setIdx(idx + 1); else onClose(); }
  function prev() { if (idx > 0) setIdx(idx - 1); else { t0.current = Date.now(); setProgress(0); } }

  if (!cur) return null;
  const s = cur.s;
  const isHost = s.profile_id === me.id;
  const people = goingPeople(s);
  const t = statusTexts(s, me);

  return (
    <div className="story-viewer" role="dialog" aria-modal="true" aria-label={`Status von ${cur.person.first_name}`}>
      <div className="story-bars">
        {Array.from({ length: cur.n }, (_, i) => (
          <div key={i} className="story-bar"><div style={{ width: `${i < cur.si ? 100 : i === cur.si ? progress * 100 : 0}%` }} /></div>
        ))}
      </div>
      <div className="row between" style={{ padding: '10px 16px' }}>
        <div className="row" style={{ gap: 10 }}>
          <Avatar p={cur.person} me={me} size={36} />
          <div className="col">
            <span style={{ fontWeight: 700 }}>{isHost ? 'Du' : cur.person.first_name}</span>
            <span className="small muted">{t.sub}</span>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Schließen"><Close /></button>
      </div>

      <div className="story-stage"
        onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
        <button className="story-tap left" onClick={prev} aria-label="Vorheriger Status" />
        <button className="story-tap right" onClick={next} aria-label="Nächster Status" />
        <StorySlide key={s.id} s={s} me={me} />
      </div>

      <div className="story-foot">
        <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
          <div className="avatars">{people.slice(0, 6).map(p => <Avatar key={p.id} p={p} me={me} />)}</div>
          <span className="soft small">{answerSummary(s)}</span>
        </div>
        {!isHost && <div onPointerDown={() => setPaused(true)}><RsvpBar s={s} me={me} onRespond={onRespond} showLate={false} /></div>}
        <button className="btn ghost block" onClick={() => onDetails(s.id)}>{isHost ? 'Dein Status · Details' : 'Details'}</button>
      </div>
    </div>
  );
}
