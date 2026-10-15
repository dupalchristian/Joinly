import { useState } from 'react';
import { api } from './api.js';
import { Avatar, useExtras, WeatherBadge, placeText } from './common.jsx';
import { statusTexts, goingPeople, myAnswer } from './status.js';
import { Nav, Pin } from './Icons.jsx';
import { dayLabel, hhmm } from './time.js';
import { googleMapsUrl, appleMapsUrl, isApple } from './services.js';
import { PinField } from './Onboarding.jsx';

const COLORS = ['#3B4A5A', '#5A3B4A', '#3B5A45', '#5A513B', '#463B5A', '#5A433B', '#3B5557'];

// Ansicht für einen geteilten Status – auch für Leute, die (noch) nicht in der Gruppe sind
export default function PublicStatus({ s, me, onMe, onDone, onReload }) {
  const viewer = me || { id: '__guest__' };
  const { wx, drive } = useExtras(s, me);
  const t = statusTexts(s, viewer);
  const people = goingPeople(s);
  const isHost = me && s.profile_id === me.id;
  const joined = me && !!myAnswer(s, me);
  const over = new Date(s.ends_at) < new Date();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [hasAccount, setHasAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const needsProfile = !me;
  const ok = !needsProfile || ((hasAccount || name.trim()) && phone.replace(/\D/g, '').length >= 6 && /^\d{6}$/.test(pin));

  const join = async () => {
    if (!ok) return;
    setBusy(true); setErr('');
    try {
      if (needsProfile) {
        const m = hasAccount
          ? await api.login({ phone: phone.trim(), pin })
          : await api.register({ first_name: name.trim(), phone: phone.trim(), pin, avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)] });
        onMe(m);
      }
      await api.joinStatusGuest(s.id);
      await onReload();
    } catch (e) {
      setErr('Hat nicht geklappt: ' + e.message);
    }
    setBusy(false);
  };

  const leave = async () => { setBusy(true); try { await api.leave(s.id); await onReload(); } catch (e) { setErr(e.message); } setBusy(false); };
  const hasPlace = s.place_mode !== 'none' && s.place_name;

  return (
    <div className="screen stack" style={{ gap: 22 }}>
      <img src="logo.png" alt="Joinly – offen für …" className="logo" style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      <span className="soft">{s.author?.first_name} aus „{s.group_name}“ lädt dich ein:</span>

      <article className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="icon-tile" aria-hidden="true">{s.icon}</div>
          <div className="col grow" style={{ gap: 3 }}>
            <span className="time" style={t.live ? { color: 'var(--accent)' } : undefined}>
              {t.live && s.kind !== 'plan' ? t.time : `${dayLabel(new Date(s.starts_at))} · ${hhmm(s.starts_at)} – ${hhmm(s.ends_at)} Uhr`}
            </span>
            <span className="title">{t.title}</span>
            <span className="soft" style={{ fontSize: 14 }}>{t.sub}</span>
          </div>
          <WeatherBadge wx={wx} />
        </div>
        {s.note && <div className="soft" style={{ fontSize: 14 }}>„{s.note}“</div>}
        {hasPlace && <div className="place"><Pin size={16} /><span>{placeText(s, drive)}</span></div>}
        <div className="row" style={{ gap: 10 }}>
          <div className="avatars">{people.slice(0, 6).map(p => <Avatar key={p.id} p={p} me={me} />)}</div>
          <span className="soft" style={{ fontSize: 14, fontWeight: 600 }}>{people.map(p => (me && p.id === me.id) ? 'Du' : p.first_name).join(', ')}</span>
        </div>
      </article>

      {hasPlace && (s.place_lat != null || s.place_address) && (isApple()
        ? <div className="grid2">
            <a className="btn white block" href={googleMapsUrl(s)} target="_blank" rel="noopener"><Nav /> Google Maps</a>
            <a className="btn white block" href={appleMapsUrl(s)} target="_blank" rel="noopener"><Nav /> Apple Karten</a>
          </div>
        : <a className="btn white block" href={googleMapsUrl(s)} target="_blank" rel="noopener"><Nav /> Route starten</a>)}

      {over && <div className="banner">Dieser Status ist schon vorbei.</div>}

      {!over && !isHost && !joined && needsProfile && (
        <div className="stack">
          <span className="soft">{hasAccount ? 'Melde dich an, dann bist du dabei.' : 'Trag kurz Name, Nummer und eine 6-stellige PIN ein, dann bist du dabei.'}</span>
          <div className="seg" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} role="tablist">
            <button type="button" role="tab" aria-selected={!hasAccount} className={!hasAccount ? 'on' : ''} onClick={() => setHasAccount(false)}>Neu hier</button>
            <button type="button" role="tab" aria-selected={hasAccount} className={hasAccount ? 'on' : ''} onClick={() => setHasAccount(true)}>Habe ein Konto</button>
          </div>
          {!hasAccount && <label className="field">Vorname<input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40} /></label>}
          <label className="field">Handynummer<input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+49 …" /></label>
          <PinField value={pin} onChange={setPin} label={hasAccount ? 'PIN' : 'PIN wählen (6 Ziffern)'} />
        </div>
      )}

      {joined && (
        <div className="banner">
          Du bist dabei ✓ {s.author?.first_name} sieht das sofort.
          {' '}Damit du auch die anderen Status von „{s.group_name}“ siehst, muss dich der Admin noch freigeben.
        </div>
      )}
      {err && <div className="banner" style={{ color: 'var(--danger)' }}>{err}</div>}

      <button className="btn ghost block" onClick={onDone}>Zu Joinly</button>

      {!over && !isHost && (
        <div className="bottom"><div className="bottom-inner">
          {joined
            ? <button className="fab" style={{ background: 'transparent', color: '#fff', border: '1px solid #3A3A3A' }} onClick={leave} disabled={busy}>{t.joinedLabel} · Absagen</button>
            : <button className="fab" onClick={join} disabled={!ok || busy} style={!ok ? { opacity: 0.5 } : undefined}>{busy ? 'Einen Moment …' : t.joinLabel}</button>}
        </div></div>
      )}
    </div>
  );
}
