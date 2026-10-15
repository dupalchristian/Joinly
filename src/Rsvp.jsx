import { useState } from 'react';
import { myAnswer, respOf, statusTexts } from './status.js';

const LATE = [null, 5, 10, 15];

// Zusage / Vielleicht / Absage – und nach der Zusage optional „Verspäte mich um …“
export default function RsvpBar({ s, me, onRespond, showLate = true }) {
  const t = statusTexts(s, me);
  const mine = myAnswer(s, me);
  const r = mine ? respOf(mine) : null;
  const late = mine?.late_minutes ?? null;
  const [custom, setCustom] = useState(false);
  const [mins, setMins] = useState('');
  const opts = [
    ['yes', r === 'yes' ? t.joinedLabel : t.joinLabel],
    ['maybe', 'Komme evtl. nach'],
    ['no', 'Absage']
  ];
  const pick = (val) => onRespond(s, val, val === 'yes' ? late : null);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="rsvp" role="radiogroup" aria-label="Deine Antwort">
        {opts.map(([val, label]) => (
          <button key={val} role="radio" aria-checked={r === val} className={'rsvp-btn ' + val + (r === val ? ' on' : '')}
            onClick={() => pick(val)}>{label}</button>
        ))}
      </div>
      {showLate && r === 'yes' && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="small muted" style={{ marginRight: 2 }}>Verspäte mich um</span>
          {LATE.map(m => (
            <button key={String(m)} className={'chip' + ((late ?? null) === m && !custom ? ' on' : '')} style={{ height: 34, padding: '0 12px', fontSize: 13 }}
              onClick={() => { setCustom(false); onRespond(s, 'yes', m); }}>{m ? `${m} Min.` : 'Pünktlich'}</button>
          ))}
          <button className={'chip' + (custom || (late && !LATE.includes(late)) ? ' on' : '')} style={{ height: 34, padding: '0 12px', fontSize: 13 }}
            onClick={() => setCustom(!custom)}>{late && !LATE.includes(late) ? `${late} Min.` : 'Eigene'}</button>
          {custom && (
            <form className="row" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); const n = parseInt(mins, 10); if (n > 0 && n <= 600) { onRespond(s, 'yes', n); setCustom(false); setMins(''); } }}>
              <label className="sr" htmlFor={'late-' + s.id}>Minuten</label>
              <input id={'late-' + s.id} className="input" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="Min." style={{ width: 80, height: 34, fontSize: 14 }} autoFocus />
              <button className="chip on" style={{ height: 34, fontSize: 13 }}>OK</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// Kurze Zusammenfassung: „3 dabei · 1 vielleicht“
export function answerSummary(s) {
  const yes = 1 + (s.participants || []).filter(p => respOf(p) === 'yes').length;
  const maybe = (s.participants || []).filter(p => respOf(p) === 'maybe').length;
  return `${yes} dabei${maybe ? ` · ${maybe} vielleicht` : ''}`;
}
