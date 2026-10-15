import { useEffect, useRef, useState } from 'react';
import { searchPlaces } from './services.js';

// Suchfeld mit Vorschlägen aus OpenStreetMap
export default function PlaceSearch({ label, placeholder, value, onPick, onText, near }) {
  const [q, setQ] = useState(value?.name || '');
  const [res, setRes] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef();

  useEffect(() => { setQ(value?.name || ''); }, [value?.name]);

  const change = (v) => {
    setQ(v);
    onText?.(v);
    setOpen(true);
    clearTimeout(timer.current);
    if (v.trim().length < 3) { setRes([]); return; }
    timer.current = setTimeout(async () => {
      try { setRes(await searchPlaces(v, near)); } catch { setRes([]); }
    }, 350);
  };

  return (
    <div className="stack" style={{ gap: 6 }}>
      <label className="field">{label}
        <input className="input" value={q} placeholder={placeholder} autoComplete="off"
          onChange={(e) => change(e.target.value)} onFocus={() => setOpen(true)} />
      </label>
      {!open && value?.sub && q === value.name && <span className="small muted">{value.sub}</span>}
      {open && res.length > 0 && (
        <div className="results">
          {res.map((r, i) => (
            <button type="button" key={i} className="result" onClick={() => { onPick(r); setQ(r.name); setOpen(false); setRes([]); }}>
              <div style={{ fontWeight: 600 }}>{r.name}</div>
              {r.sub && <div className="small muted">{r.sub}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
