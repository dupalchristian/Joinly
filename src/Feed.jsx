import { useEffect, useState } from 'react';
import { Avatar, useExtras, WeatherBadge, placeText } from './common.jsx';
import { Pin, Plus, Users } from './Icons.jsx';
import { dayLabel, hhmm, longDate, startOfDay } from './time.js';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  return now;
}

function StatusCard({ s, me, onOpen, onToggle }) {
  const { wx, drive } = useExtras(s, me);
  const isHost = s.profile_id === me.id;
  const people = [s.author, ...s.participants.map(p => p.profiles)].filter(Boolean);
  const joined = s.participants.some(p => p.profile_id === me.id);
  return (
    <article className="card">
      <button className="card-main" onClick={onOpen} aria-label={`${s.activity} – Details öffnen`}>
        <div className="icon-tile" aria-hidden="true">{s.icon}</div>
        <div className="col grow" style={{ gap: 3 }}>
          <span className="time">{hhmm(s.starts_at)} – {hhmm(s.ends_at)} Uhr</span>
          <span className="title">{s.activity}</span>
          <span className="soft" style={{ fontSize: 14 }}>{isHost ? 'Du bist' : s.author?.first_name} offen dafür</span>
        </div>
        <WeatherBadge wx={wx} />
      </button>
      <div className="place"><Pin size={16} /><span>{placeText(s, drive)}</span></div>
      <div className="row between">
        <div className="row" style={{ gap: 10 }}>
          <div className="avatars">{people.slice(0, 5).map(p => <Avatar key={p.id} p={p} me={me} />)}</div>
          <span className="soft" style={{ fontSize: 14, fontWeight: 600 }}>{people.length} dabei</span>
        </div>
        {isHost
          ? <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Dein Status</span>
          : <button className={'btn' + (joined ? ' on' : '')} onClick={onToggle} aria-pressed={joined}>{joined ? 'Dabei ✓' : 'Bin dabei'}</button>}
      </div>
    </article>
  );
}

export default function Feed({ me, groups, groupId, setGroupId, statuses, loading, onOpen, onToggle, onCreate, onGroups, onProfile }) {
  const now = useClock();
  const group = groups.find(g => g.id === groupId);
  const active = groups.filter(g => g.status === 'active');
  const pending = groups.filter(g => g.status === 'pending');

  const interests = me.interests;
  const visible = statuses.filter(s => new Date(s.ends_at) > now &&
    (!interests || s.profile_id === me.id || interests.includes(s.activity)));

  const sections = [];
  for (const s of visible) {
    const key = startOfDay(s.starts_at < now.toISOString() ? now : s.starts_at).getTime();
    let sec = sections.find(x => x.key === key);
    if (!sec) { sec = { key, label: dayLabel(new Date(key), now), items: [] }; sections.push(sec); }
    sec.items.push(s);
  }
  sections.sort((a, b) => a.key - b.key);

  return (
    <div className="screen">
      <div className="row between" style={{ paddingTop: 6 }}>
        <img src="logo.png" alt="Joinly – offen für …" className="logo" />
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn" onClick={onGroups} aria-label="Gruppen"><Users /></button>
          <button onClick={onProfile} aria-label="Profil" style={{ all: 'unset', cursor: 'pointer' }}>
            <div className="avatar me lg" style={{ border: 'none' }}>Du</div>
          </button>
        </div>
      </div>

      <div className="col" style={{ marginTop: 28, gap: 4 }}>
        <span className="clock">{hhmm(now)}</span>
        <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>{longDate(now)}</span>
      </div>

      {active.length > 1 && (
        <div className="chips" style={{ marginTop: 22 }} role="tablist" aria-label="Gruppe wählen">
          {active.map(g => (
            <button key={g.id} role="tab" aria-selected={g.id === groupId}
              className={'chip' + (g.id === groupId ? ' on' : '')} onClick={() => setGroupId(g.id)}>{g.name}</button>
          ))}
        </div>
      )}
      {active.length === 1 && <div className="label" style={{ marginTop: 22 }}>{group?.name}</div>}

      {pending.length > 0 && (
        <div className="banner" style={{ marginTop: 16 }}>
          Deine Anfrage für {pending.map(g => `„${g.name}“`).join(', ')} wartet noch auf die Freigabe durch den Admin.
        </div>
      )}

      {loading && <div className="spinner" aria-label="Lädt" />}

      {!loading && group && sections.length === 0 && (
        <div className="empty">Gerade ist niemand offen für etwas.<br />Sei der Erste – was hättest du Lust zu machen?</div>
      )}
      {!loading && !group && (
        <div className="empty">
          {pending.length ? 'Sobald du freigegeben bist, siehst du hier, worauf deine Freunde Lust haben.' : 'Du bist noch in keiner Gruppe.'}
          <div style={{ marginTop: 16 }}><button className="btn white" onClick={onGroups}>Gruppe erstellen</button></div>
        </div>
      )}

      {sections.map(sec => (
        <section key={sec.key} className="section stack" aria-label={sec.label}>
          <h2 className="label" style={{ margin: 0 }}>{sec.label}</h2>
          {sec.items.map(s => (
            <StatusCard key={s.id} s={s} me={me} onOpen={() => onOpen(s.id)} onToggle={() => onToggle(s)} />
          ))}
        </section>
      ))}

      {group && (
        <div className="bottom"><div className="bottom-inner">
          <button className="fab" onClick={onCreate}><Plus /> Ich bin offen für …</button>
        </div></div>
      )}
    </div>
  );
}
