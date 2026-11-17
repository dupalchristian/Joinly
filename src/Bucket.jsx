import { useState } from 'react';
import { Emo, Avatar } from './common.jsx';
import { Back, Close } from './Icons.jsx';
import IconPicker from './IconPicker.jsx';
import { MONTH_NAMES, addDays, dayKey, parseDay, rangeText, startOfDay, whenText } from './time.js';

// ---------- Hilfen ----------

const votesOf = (i, r) => (i.idea_votes || []).filter(v => v.response === r);
const myVote = (i, me) => (i.idea_votes || []).find(v => v.profile_id === me.id)?.response || null;
// Wer hat Lust: Ersteller zählt immer mit
const fans = (i) => [i.author, ...votesOf(i, 'yes').filter(v => v.profile_id !== i.profile_id).map(v => v.profiles)].filter(Boolean);
const score = (i) => fans(i).length * 2 + votesOf(i, 'maybe').length;
const canManage = (i, me, group) => i.profile_id === me.id || group?.role === 'admin';
const okCount = (o) => (o.idea_option_votes || []).filter(v => v.ok).length;
const bestOption = (i) => {
  const opts = i.idea_options || [];
  if (!opts.length) return null;
  const max = Math.max(...opts.map(okCount));
  return max > 0 ? opts.find(o => okCount(o) === max) : null;
};
const needsMyVote = (i, me) => i.stage === 'poll' && (i.idea_options || []).length > 0 &&
  !(i.idea_options || []).some(o => (o.idea_option_votes || []).some(v => v.profile_id === me.id));
const plannedStatus = (i) => (i.statuses || [])[0] || null;

const SEEN_KEY = (g) => 'joinly-bucket-seen:' + g;
const readSeen = (g) => { try { return localStorage.getItem(SEEN_KEY(g)) || ''; } catch { return ''; } };
export const markBucketSeen = (g) => { try { localStorage.setItem(SEEN_KEY(g), new Date().toISOString()); } catch { /* egal */ } };

// Grobe Zeitangaben: „Irgendwann“, nächste Jahreszeiten, oder ein Monat
function seasonChoices(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth() + 1;
  const list = [
    ['Frühling', [3, 4, 5]], ['Sommer', [6, 7, 8]], ['Herbst', [9, 10, 11]]
  ].map(([n, ms]) => `${n} ${m > ms[2] ? y + 1 : y}`);
  list.push(m >= 3 ? `Winter ${y}/${String(y + 1).slice(2)}` : `Winter ${y - 1}/${String(y).slice(2)}`);
  return ['Irgendwann', 'Dieses Jahr', 'Nächstes Jahr', ...list.sort((a, b) => a.slice(-4).localeCompare(b.slice(-4)))];
}
const resolveTimeframe = (t, now = new Date()) =>
  t === 'Dieses Jahr' ? String(now.getFullYear()) : t === 'Nächstes Jahr' ? String(now.getFullYear() + 1) : t;

// ---------- Streifen im Feed ----------

// Immer sichtbar – auch während des Ladens oder wenn die Liste noch leer ist
export function BucketStrip({ ideas, me, groupId, onOpen }) {
  const open = (ideas || []).filter(i => i.stage !== 'planned');
  const vote = open.find(i => needsMyVote(i, me));
  const seen = readSeen(groupId);
  const fresh = open.filter(i => i.profile_id !== me.id && (!seen || i.created_at > seen)).length;
  const top = [...open].sort((a, b) => score(b) - score(a)).slice(0, 3);
  const sub = vote ? `„${vote.title}“: bitte abstimmen`
    : open.length ? `${open.length} ${open.length === 1 ? 'Idee' : 'Ideen'}${fresh ? ` · ${fresh} neu` : ''}`
    : 'Sammelt Ideen für irgendwann';
  return (
    <button className="bucket-strip" onClick={onOpen} aria-label={`Bucket List: ${sub}`}>
      <span className="bucket-ico" aria-hidden="true">🪣</span>
      <span className="col grow" style={{ gap: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Bucket List</span>
        <span className={'small ' + (vote || fresh ? 'accent' : 'muted')} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
      </span>
      <span className="row" style={{ gap: 2, fontSize: 18 }} aria-hidden="true">{top.map(i => <Emo key={i.id} i={i.icon} />)}</span>
      <span className="muted" aria-hidden="true" style={{ fontSize: 20, marginLeft: 4 }}>›</span>
    </button>
  );
}

// ---------- Liste ----------

function InterestButtons({ i, me, onVote, compact }) {
  const mine = myVote(i, me);
  if (i.profile_id === me.id) return null;
  const h = compact ? 36 : 44;
  return (
    <div className="grid2" style={{ gap: 6 }}>
      <button className={'rsvp-btn yes' + (mine === 'yes' ? ' on' : '')} style={{ height: h }} aria-pressed={mine === 'yes'}
        onClick={(e) => { e.stopPropagation(); onVote(i, mine === 'yes' ? null : 'yes'); }}>🙌 Hätte Lust</button>
      <button className={'rsvp-btn maybe' + (mine === 'maybe' ? ' on' : '')} style={{ height: h }} aria-pressed={mine === 'maybe'}
        onClick={(e) => { e.stopPropagation(); onVote(i, mine === 'maybe' ? null : 'maybe'); }}>🤔 Vielleicht</button>
    </div>
  );
}

function IdeaCard({ i, me, onOpen, onVote }) {
  const f = fans(i);
  const maybe = votesOf(i, 'maybe').length;
  const st = plannedStatus(i);
  const best = bestOption(i);
  return (
    <div className="card" style={{ gap: 12 }}>
      <button className="card-main" onClick={() => onOpen(i.id)}>
        <div className="icon-tile" aria-hidden="true"><Emo i={i.icon} /></div>
        <div className="col grow" style={{ gap: 3, minWidth: 0 }}>
          <span className="title">{i.title}</span>
          <span className="small muted">
            {i.stage === 'planned' && st ? `✓ ${whenText(st)}`
              : i.stage === 'poll' ? (best ? `Termin gesucht · vorne: ${rangeText(best.starts_on, best.ends_on)}` : 'Termin gesucht')
              : i.timeframe || 'Irgendwann'}
          </span>
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <div className="avatars">{f.slice(0, 5).map(p => <Avatar key={p.id} p={p} me={me} />)}</div>
            <span className="small soft">{f.length} hätte{f.length === 1 ? '' : 'n'} Lust{maybe ? ` · ${maybe} vielleicht` : ''}</span>
          </div>
        </div>
        {needsMyVote(i, me) && <span className="tag late" style={{ alignSelf: 'flex-start' }}>Abstimmen</span>}
      </button>
      {i.stage === 'idea' && <InterestButtons i={i} me={me} onVote={onVote} compact />}
    </div>
  );
}

export function BucketList({ me, group, ideas, onBack, onNew, onOpen, onVote }) {
  const list = ideas || [];
  const polls = list.filter(i => i.stage === 'poll');
  const open = list.filter(i => i.stage === 'idea').sort((a, b) => score(b) - score(a) || b.created_at.localeCompare(a.created_at));
  const done = list.filter(i => i.stage === 'planned');
  const sec = (label, items) => items.length > 0 && (
    <section className="stack" aria-label={label}>
      <h2 className="label" style={{ margin: 0 }}>{label}</h2>
      {items.map(i => <IdeaCard key={i.id} i={i} me={me} onOpen={onOpen} onVote={onVote} />)}
    </section>
  );
  return (
    <div className="screen stack" style={{ gap: 24 }}>
      <div className="row between" style={{ paddingTop: 6 }}>
        <div className="row">
          <button className="icon-btn" onClick={onBack} aria-label="Zurück"><Back /></button>
          <div className="col">
            <h1 className="h2">Bucket List</h1>
            {group && <span className="small muted">{group.name}</span>}
          </div>
        </div>
        <button className="btn primary" onClick={onNew}>+ Idee</button>
      </div>
      {ideas === null && <div className="banner">Die Bucket List wird gerade eingerichtet. Schau gleich nochmal vorbei.</div>}
      {ideas && list.length === 0 && (
        <div className="empty">Noch keine Ideen.<br />Worauf hättest du irgendwann mal Lust? Urlaub, Festival, Fallschirmspringen …</div>
      )}
      {sec('Termin wird gesucht', polls)}
      {sec('Ideen', open)}
      {sec('✓ Geplant', done)}
    </div>
  );
}

// ---------- Neue Idee / bearbeiten ----------

export function IdeaForm({ me, group, existing, prefill, onClose, onSave }) {
  const ex = existing || prefill || {};
  const choices = seasonChoices();
  const [title, setTitle] = useState(ex.title || '');
  const [icon, setIcon] = useState(ex.icon || '✨');
  const [note, setNote] = useState(ex.note || '');
  const initial = ex.timeframe || 'Irgendwann';
  const isMonth = (t) => MONTH_NAMES.some(m => t.startsWith(m + ' '));
  const [tf, setTf] = useState(isMonth(initial) ? 'Monat' : initial);
  const [month, setMonth] = useState(() => {
    if (isMonth(initial)) { const [m, y] = initial.split(' '); return `${y}-${String(MONTH_NAMES.indexOf(m) + 1).padStart(2, '0')}`; }
    return dayKey(addDays(new Date(), 60)).slice(0, 7);
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const shown = choices.includes(tf) || tf === 'Monat' ? choices : [tf, ...choices];
  const monthLabel = () => { const [y, m] = month.split('-').map(Number); return `${MONTH_NAMES[m - 1]} ${y}`; };
  const ok = title.trim() && !busy && (tf !== 'Monat' || /^\d{4}-\d{2}$/.test(month));

  const save = async () => {
    if (!ok) return;
    setBusy(true); setErr('');
    try {
      await onSave({ title: title.trim(), icon, note: note.trim() || null, timeframe: tf === 'Monat' ? monthLabel() : resolveTimeframe(tf) });
    } catch (e) { setErr('Hat nicht geklappt: ' + e.message); setBusy(false); }
  };

  return (
    <div className="screen stack" style={{ gap: 26 }}>
      <div className="row" style={{ paddingTop: 6 }}>
        <button className="icon-btn" onClick={onClose} aria-label="Abbrechen"><Close /></button>
        <h1 className="h2">{existing ? 'Idee bearbeiten' : 'Neue Idee'}</h1>
      </div>
      <label className="field">Worauf hättest du Lust?
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="z. B. Urlaub zusammen, Festival, Fallschirmspringen" autoFocus={!existing} />
      </label>
      <section className="stack">
        <span className="small muted">Symbol</span>
        <IconPicker value={icon} onChange={setIcon} />
      </section>
      <section className="stack">
        <h2 className="label" style={{ margin: 0 }}>Ungefähr wann?</h2>
        <div className="chips wrap">
          {shown.map(c => <button key={c} className={'chip accent' + (tf === c ? ' on' : '')} onClick={() => setTf(c)}>{c}</button>)}
          <button className={'chip accent' + (tf === 'Monat' ? ' on' : '')} onClick={() => setTf('Monat')}>📅 Monat wählen</button>
        </div>
        {tf === 'Monat' && (
          <label className="field">Monat
            <input className="input" type="month" value={month} min={dayKey(new Date()).slice(0, 7)} onChange={(e) => setMonth(e.target.value)} />
          </label>
        )}
        <span className="small muted">Muss noch nicht feststehen. Den genauen Termin findet ihr später zusammen.</span>
      </section>
      <label className="field">Details (optional)
        <textarea className="input" rows={3} style={{ height: 'auto', paddingTop: 12, paddingBottom: 12, resize: 'none' }} value={note}
          onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="z. B. Eine Woche Kroatien, Ferienhaus für alle" />
      </label>
      {!existing && <span className="small muted">Alle in „{group.name}“ sehen die Idee und können sagen, ob sie Lust hätten.</span>}
      {err && <div className="banner" style={{ color: 'var(--danger)' }}>{err}</div>}
      <div className="bottom"><div className="bottom-inner">
        <button className="fab" disabled={!ok} onClick={save} style={!ok ? { opacity: 0.5 } : undefined}>
          {busy ? 'Einen Moment …' : existing ? 'Speichern' : 'Auf die Bucket List'}
        </button>
      </div></div>
    </div>
  );
}

// ---------- Detail einer Idee ----------

function PeopleLine({ label, people, me }) {
  if (!people.length) return null;
  return (
    <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
      <span className="small muted" style={{ minWidth: 92 }}>{label}</span>
      <div className="avatars">{people.slice(0, 8).map(p => <Avatar key={p.id} p={p} me={me} />)}</div>
      <span className="small soft">{people.map(p => p.id === me.id ? 'Du' : p.first_name).join(', ')}</span>
    </div>
  );
}

function OptionRow({ o, me, best, members, manage, onVote, onDelete }) {
  const mine = (o.idea_option_votes || []).find(v => v.profile_id === me.id);
  const yes = (o.idea_option_votes || []).filter(v => v.ok);
  const no = (o.idea_option_votes || []).filter(v => !v.ok);
  const name = (id) => id === me.id ? 'Du' : members.find(m => m.profile.id === id)?.profile.first_name || '…';
  return (
    <div className="card" style={{ gap: 10, ...(best ? { boxShadow: 'inset 0 0 0 1.5px var(--accent)' } : {}) }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 2 }}>
          <span style={{ fontWeight: 700 }}>{rangeText(o.starts_on, o.ends_on)}</span>
          <span className="small muted">
            {yes.length} passt{no.length ? ` · ${no.length} passt nicht` : ''}{best ? ' · ⭐ passt den meisten' : ''}
          </span>
          {yes.length > 0 && <span className="small soft">✓ {yes.map(v => name(v.profile_id)).join(', ')}</span>}
        </div>
        {manage && <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => onDelete(o)} aria-label="Zeitraum löschen"><Close size={16} /></button>}
      </div>
      <div className="grid2" style={{ gap: 6 }}>
        <button className={'rsvp-btn yes' + (mine?.ok === true ? ' on' : '')} style={{ height: 40 }} aria-pressed={mine?.ok === true}
          onClick={() => onVote(o, mine?.ok === true ? null : true)}>Passt</button>
        <button className={'rsvp-btn no' + (mine?.ok === false ? ' on' : '')} style={{ height: 40 }} aria-pressed={mine?.ok === false}
          onClick={() => onVote(o, mine?.ok === false ? null : false)}>Passt nicht</button>
      </div>
    </div>
  );
}

function AddOption({ onAdd, first }) {
  const base = startOfDay(addDays(new Date(), 14));
  const [from, setFrom] = useState(dayKey(base));
  const [to, setTo] = useState(dayKey(addDays(base, 2)));
  const [busy, setBusy] = useState(false);
  const ok = from && to && to >= from && !busy;
  return (
    <div className="card" style={{ gap: 12 }}>
      <span style={{ fontWeight: 700 }}>{first ? 'Welche Zeiträume schlägst du vor?' : 'Weiteren Zeitraum vorschlagen'}</span>
      <div className="grid2">
        <label className="field">Von
          <input className="input" type="date" value={from} min={dayKey(new Date())}
            onChange={(e) => { const v = e.target.value; setFrom(v); if (v && (!to || to < v)) setTo(v); }} />
        </label>
        <label className="field">Bis
          <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <button className="btn ghost block" style={{ height: 46 }} disabled={!ok}
        onClick={async () => { setBusy(true); try { await onAdd(from, to); const n = addDays(parseDay(to), 7); setFrom(dayKey(n)); setTo(dayKey(addDays(n, (parseDay(to) - parseDay(from)) / 86400000))); } finally { setBusy(false); } }}>
        + {from === to ? 'Diesen Tag' : 'Diesen Zeitraum'} hinzufügen
      </button>
      <span className="small muted">Für einen einzelnen Tag einfach „Von“ und „Bis“ gleich lassen.</span>
    </div>
  );
}

export function IdeaDetail({ i, me, group, members, onBack, onVote, onEdit, onDelete, onStartPoll, onAddOption, onDeleteOption, onVoteOption, onPlan, onOpenStatus, toast }) {
  const [adding, setAdding] = useState(false);
  if (!i) return null;
  const manage = canManage(i, me, group);
  const f = fans(i);
  const maybe = votesOf(i, 'maybe').map(v => v.profiles).filter(Boolean);
  const opts = [...(i.idea_options || [])].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const best = bestOption(i);
  const st = plannedStatus(i);
  const isAuthor = i.profile_id === me.id;

  return (
    <div className="screen stack" style={{ gap: 24 }}>
      <div className="row between" style={{ paddingTop: 6 }}>
        <button className="icon-btn" onClick={onBack} aria-label="Zurück"><Back /></button>
        {manage && <button className="btn ghost" style={{ height: 38 }} onClick={onEdit}>Bearbeiten</button>}
      </div>

      <div className="col" style={{ gap: 8 }}>
        <div style={{ fontSize: 56, lineHeight: 1 }} aria-hidden="true"><Emo i={i.icon} /></div>
        <h1 className="h1" style={{ fontSize: 30 }}>{i.title}</h1>
        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
          {i.stage === 'planned' && st ? `✓ Geplant · ${whenText(st)}` : i.stage === 'poll' ? 'Termin wird gesucht' : (i.timeframe || 'Irgendwann')}
        </span>
        {i.note && <p className="soft" style={{ margin: 0, lineHeight: '22px' }}>{i.note}</p>}
        <span className="small muted">Idee von {isAuthor ? 'dir' : i.author?.first_name}</span>
      </div>

      {i.stage !== 'planned' && <InterestButtons i={i} me={me} onVote={onVote} />}

      <section className="stack" style={{ gap: 12 }}>
        <PeopleLine label="🙌 Hätte Lust" people={f} me={me} />
        <PeopleLine label="🤔 Vielleicht" people={maybe} me={me} />
      </section>

      {i.stage === 'planned' && st && (
        <button className="btn primary block" onClick={() => onOpenStatus(st.id)}>Zur Aktivität</button>
      )}

      {i.stage === 'poll' && (
        <section className="stack" aria-label="Terminfindung">
          <h2 className="label" style={{ margin: 0 }}>Wann passt es dir?</h2>
          {opts.length === 0 && <span className="small muted">Noch keine Zeiträume vorgeschlagen.</span>}
          {opts.map(o => (
            <OptionRow key={o.id} o={o} me={me} best={best?.id === o.id} members={members} manage={manage}
              onVote={onVoteOption} onDelete={onDeleteOption} />
          ))}
          {manage && (adding || opts.length === 0
            ? <AddOption onAdd={onAddOption} first={opts.length === 0} />
            : <button className="btn ghost block" onClick={() => setAdding(true)}>+ Weiteren Zeitraum vorschlagen</button>)}
        </section>
      )}

      {manage && i.stage === 'idea' && (
        <section className="stack">
          <button className="btn primary block" onClick={onStartPoll}>📅 Termin finden</button>
          <button className="btn ghost block" onClick={() => onPlan(null)}>Datum steht schon: Als Aktivität planen</button>
          <span className="small muted">Bei „Termin finden“ schlägst du Zeiträume vor und alle stimmen ab, was passt. Wer Lust hat, bekommt eine Nachricht.</span>
        </section>
      )}

      {manage && i.stage === 'poll' && (
        <section className="stack">
          <button className="btn primary block" disabled={!opts.length} onClick={() => onPlan(best || opts[0] || null)}>
            {best ? `Termin festmachen: ${rangeText(best.starts_on, best.ends_on)}` : 'Termin festmachen'}
          </button>
          {opts.length > 1 && (
            <div className="chips wrap">
              {opts.filter(o => o.id !== best?.id).map(o => (
                <button key={o.id} className="chip" onClick={() => onPlan(o)}>Stattdessen {rangeText(o.starts_on, o.ends_on)}</button>
              ))}
            </div>
          )}
          <span className="small muted">Daraus wird eine normale Aktivität mit Datum, Ort und Zusagen. Sie erscheint dann in der Übersicht.</span>
        </section>
      )}

      {!manage && i.stage === 'idea' && (
        <span className="small muted">{i.author?.first_name} kann einen Termin suchen, sobald genug Leute Lust haben.</span>
      )}

      {manage && (
        <button className="btn danger block" onClick={async () => { if (confirm('Idee wirklich löschen?')) { try { await onDelete(); } catch (e) { toast('Hat nicht geklappt: ' + e.message); } } }}>
          Idee löschen
        </button>
      )}
    </div>
  );
}
