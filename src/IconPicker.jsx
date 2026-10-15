import { Emo } from './common.jsx';
import { ICON_GROUPS } from './activities.js';

export default function IconPicker({ value, onChange }) {
  return (
    <div className="stack" style={{ gap: 10, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }} role="radiogroup" aria-label="Symbol wählen">
      {ICON_GROUPS.map(([title, list]) => (
        <div key={title} className="stack" style={{ gap: 6 }}>
          <span className="small muted">{title}</span>
          <div className="emoji-grid">
            {list.map(i => (
              <button key={title + i} type="button" role="radio" aria-checked={i === value} className={i === value ? 'on' : ''} onClick={() => onChange(i)}><Emo i={i} /></button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
