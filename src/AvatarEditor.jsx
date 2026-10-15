import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { Avatar } from './common.jsx';

const EMOJIS = ['😎', '🤠', '🥸', '🤓', '🤪', '😈', '🤡', '👻', '💀', '👽', '🤖', '🎃', '🥷', '🧛', '🧟', '🧙', '🦸', '🦹', '🧑‍🚀', '🧑‍🍳', '🧑‍🔬', '🧑‍🎤', '🧑‍🚒', '👷', '🕵️', '💂', '🤴', '👸', '🧔', '👴', '🧢', '🎩',
  '😺', '🦊', '🐻', '🐼', '🐯', '🦁', '🐸', '🐵', '🙈', '🦉', '🐙', '🦄', '🐺', '🐶', '🐧', '🦈', '🐊', '🦖', '🐗', '🐐', '🦥', '🦦',
  '🌻', '🔥', '⚡', '🌊', '🏔️', '🍀', '☮️', '✌️', '🤘', '💪', '🍺', '🍕', '🌿', '🚬', '💸', '💎', '👑', '🎱', '⚽', '🥊', '🏋️', '🎮', '🎸', '🏍️'];
const COLORS = ['#3B4A5A', '#5A3B4A', '#3B5A45', '#5A513B', '#463B5A', '#5A433B', '#3B5557', '#2E2E2E', '#6B5A2E'];

// Foto auf 400×400 zuschneiden und als JPEG verkleinern
async function squareJpeg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas'); c.width = c.height = 400;
    c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 400, 400);
    return await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
  } finally { URL.revokeObjectURL(url); }
}

// value: { avatar_url, avatar_emoji, avatar_color }
export default function AvatarEditor({ me, value, onChange, toast }) {
  const [mode, setMode] = useState(null); // null | 'emoji' | 'figur'
  const [figures, setFigures] = useState([]);
  useEffect(() => { fetch('avatars/list.json').then(r => r.ok ? r.json() : []).then(setFigures).catch(() => {}); }, []);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const preview = { ...me, ...value };

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const blob = await squareJpeg(f);
      const url = await api.uploadAvatar(blob);
      onChange({ ...value, avatar_url: url, avatar_emoji: null });
      setMode(null);
    } catch (err) { toast('Foto hat nicht geklappt: ' + err.message); }
    setBusy(false);
  };

  return (
    <section className="stack" style={{ alignItems: 'center' }}>
      <Avatar p={preview} me={me} size={104} />
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="chip" onClick={() => fileRef.current.click()} disabled={busy}>{busy ? 'Lädt hoch …' : '📷 Foto wählen'}</button>
        {figures.length > 0 && <button className={'chip' + (mode === 'figur' ? ' on' : '')} onClick={() => setMode(mode === 'figur' ? null : 'figur')}>🦸 Figur wählen</button>}
        <button className={'chip' + (mode === 'emoji' ? ' on' : '')} onClick={() => setMode(mode === 'emoji' ? null : 'emoji')}>✨ Avatar erstellen</button>
        {(value.avatar_url || value.avatar_emoji) && (
          <button className="chip" onClick={() => onChange({ ...value, avatar_url: null, avatar_emoji: null })}>Entfernen</button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="sr" aria-label="Foto wählen" />
      {mode === 'figur' && (
        <div className="avatar-pick" role="radiogroup" aria-label="Figur" style={{ width: '100%' }}>
          {figures.map(f => {
            const url = `avatars/${f}.webp`;
            return (
              <button key={f} role="radio" aria-checked={value.avatar_url === url} aria-label={f} className={value.avatar_url === url ? 'on' : ''}
                style={{ background: '#111', padding: 0, overflow: 'hidden' }}
                onClick={() => onChange({ ...value, avatar_url: url, avatar_emoji: null })}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              </button>
            );
          })}
        </div>
      )}
      {mode === 'emoji' && (
        <div className="stack" style={{ width: '100%' }}>
          <div className="avatar-pick" role="radiogroup" aria-label="Symbol" style={{ maxHeight: 290, overflowY: 'auto' }}>
            {EMOJIS.map(e => (
              <button key={e} role="radio" aria-checked={value.avatar_emoji === e} className={value.avatar_emoji === e ? 'on' : ''}
                style={{ background: value.avatar_color || '#2E2E2E' }}
                onClick={() => onChange({ ...value, avatar_url: null, avatar_emoji: e })}>{e}</button>
            ))}
          </div>
          <span className="small muted">Hintergrund</span>
          <div className="color-pick" role="radiogroup" aria-label="Farbe">
            {COLORS.map(c => (
              <button key={c} role="radio" aria-checked={value.avatar_color === c} aria-label={c} className={value.avatar_color === c ? 'on' : ''}
                style={{ background: c }} onClick={() => onChange({ ...value, avatar_color: c, avatar_emoji: value.avatar_emoji || EMOJIS[0], avatar_url: null })} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
