import { useEffect } from 'react';
import { Emo, Avatar } from './common.jsx';
import { Back } from './Icons.jsx';
import { goingPeople } from './status.js';
import { hhmm } from './time.js';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// Verlauf: beendete Aktivitäten mit Teilnehmern und Fotos, nach Monaten gruppiert
export default function History({ me, group, items, badges, reload, tick, onBack, onOpen }) {
  useEffect(() => { reload().catch(() => {}); }, [tick]);

  const months = [];
  for (const s of items) {
    const d = new Date(s.starts_at);
    const key = d.getFullYear() * 12 + d.getMonth();
    let m = months.find(x => x.key === key);
    if (!m) { m = { key, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, items: [] }; months.push(m); }
    m.items.push(s);
  }

  return (
    <div className="screen stack" style={{ gap: 22 }}>
      <div className="row" style={{ paddingTop: 6 }}>
        <button className="icon-btn" onClick={onBack} aria-label="Zurück"><Back /></button>
        <div className="col">
          <h1 className="h2">Verlauf</h1>
          {group && <span className="small muted">{group.name}</span>}
        </div>
      </div>

      {items.length === 0 && <div className="empty">Noch keine beendeten Aktivitäten.<br />Alles, was vorbei ist, landet hier – mit Fotos und wer dabei war.</div>}

      {months.map(m => (
        <section key={m.key} className="stack">
          <h2 className="label" style={{ margin: 0 }}>{m.label} · {m.items.length} {m.items.length === 1 ? 'Aktivität' : 'Aktivitäten'}</h2>
          {m.items.map(s => {
            const d = new Date(s.starts_at);
            const people = goingPeople(s);
            const photos = s.status_photos || [];
            return (
              <button key={s.id} className="card" style={{ all: 'unset', cursor: 'pointer' }} onClick={() => onOpen(s.id)}>
                <div className="card" style={{ gap: 12 }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div className="icon-tile" aria-hidden="true"><Emo i={s.icon} /></div>
                    <div className="col grow" style={{ gap: 3 }}>
                      <span className="time">{WD[d.getDay()]}, {d.getDate()}. {MONTHS[d.getMonth()]} · {hhmm(s.starts_at)} Uhr</span>
                      <span className="title">{s.kind === 'open' ? `Kommt vorbei${s.place_name ? ': ' + s.place_name : ''}` : s.kind === 'free' ? 'Gerade frei' : s.activity}</span>
                      {s.place_name && s.kind !== 'open' && <span className="small muted">{s.place_name}</span>}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <div className="avatars">{people.slice(0, 6).map(p => <Avatar key={p.id} p={p} me={me} badge={badges[p.id]} />)}</div>
                    <span className="soft small">{people.length} dabei{photos.length ? ` · ${photos.length} ${photos.length === 1 ? 'Foto' : 'Fotos'}` : ''}</span>
                  </div>
                  {photos.length > 0 && (
                    <div className="row" style={{ gap: 6 }}>
                      {photos.slice(0, 4).map(f => (
                        <img key={f.id} src={f.url} alt="" loading="lazy" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10 }} />
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
