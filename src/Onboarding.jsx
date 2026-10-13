import { useState } from 'react';
import { api } from './api.js';
import PlaceSearch from './PlaceSearch.jsx';

export const COLORS = ['#3B4A5A', '#5A3B4A', '#3B5A45', '#5A513B', '#463B5A', '#5A433B', '#3B5557'];
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

export function PinField({ value, onChange, label = 'PIN (6 Ziffern)', autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">{label}
      <div style={{ position: 'relative' }}>
        <input className="input" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="one-time-code"
          type={show ? 'text' : 'password'} value={value} autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          style={{ letterSpacing: show ? 4 : 8, fontSize: 20, paddingRight: 90 }} />
        <button type="button" className="chip" onClick={() => setShow(!show)}
          style={{ position: 'absolute', right: 6, top: 5, height: 40 }}>{show ? 'Verbergen' : 'Zeigen'}</button>
      </div>
    </label>
  );
}

// mode: 'register' | 'login' | 'secure' (bestehendes Konto ohne PIN absichern)
export default function Onboarding({ invite, legacyMe, onDone }) {
  const [mode, setMode] = useState(legacyMe ? 'secure' : 'register');
  const [name, setName] = useState(legacyMe?.first_name || '');
  const [phone, setPhone] = useState(legacyMe?.phone || '');
  const [pin, setPin] = useState('');
  const [home, setHome] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [forgot, setForgot] = useState(false);

  const phoneOk = phone.replace(/\D/g, '').length >= 6;
  const pinOk = /^\d{6}$/.test(pin);
  const ok = phoneOk && pinOk && (mode === 'login' || name.trim().length > 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true); setErr('');
    try {
      let me;
      if (mode === 'login') {
        me = await api.login({ phone: phone.trim(), pin });
        if (!me) throw new Error('Zu dieser Nummer gibt es noch kein Profil. Bitte „Neu hier“ wählen.');
      } else {
        me = await api.register({
          first_name: name.trim(), phone: phone.trim(), pin,
          avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)]
        });
        if (home && mode === 'register') me = await api.updateProfile({ home_label: home.name, home_lat: home.lat, home_lng: home.lng });
      }
      onDone(me);
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  };

  const title = mode === 'secure' ? 'Leg deine PIN fest'
    : invite ? `Du bist zu „${invite.group_name}“ eingeladen`
    : mode === 'login' ? 'Willkommen zurück' : 'Willkommen';

  return (
    <form className="screen stack" style={{ gap: 22 }} onSubmit={submit}>
      <img src="logo.png" alt="Joinly – offen für …" className="logo" style={{ height: 56, marginTop: 24, alignSelf: 'flex-start' }} />
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="h1">{title}</h1>
        <p className="soft" style={{ margin: 0, lineHeight: '22px' }}>
          {mode === 'secure'
            ? 'Damit du dich auch in der App auf dem Home-Bildschirm und auf anderen Handys anmelden kannst, brauchst du jetzt eine 6-stellige PIN. Deine Gruppen und Status bleiben erhalten.'
            : mode === 'login'
              ? 'Melde dich mit deiner Handynummer und deiner PIN an.'
              : invite
                ? 'Trag Vorname und Handynummer ein und wähl eine 6-stellige PIN. Danach muss dich der Admin der Gruppe noch freigeben.'
                : 'Zeig deinen Freunden, worauf du gerade Lust hast, und sieh, wer mitmacht.'}
        </p>
      </div>

      {mode !== 'secure' && (
        <div className="seg" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setErr(''); }}>Neu hier</button>
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr(''); }}>Ich habe schon ein Konto</button>
        </div>
      )}

      {mode !== 'login' && (
        <label className="field">Vorname
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40} />
        </label>
      )}
      <label className="field">Handynummer
        <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+49 …" />
      </label>
      <PinField value={pin} onChange={setPin} label={mode === 'login' ? 'PIN' : 'PIN wählen (6 Ziffern, gut merken)'} />

      {mode === 'register' && (
        <>
          <PlaceSearch label="Heimadresse (optional, für Entfernung und Fahrzeit)" placeholder="Straße und Ort" value={home} onPick={setHome} />
          <p className="small muted" style={{ margin: 0 }}>Deine Adresse sieht niemand, sie wird nur für die Fahrzeit genutzt.</p>
        </>
      )}

      {mode === 'login' && (
        <button type="button" className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setForgot(!forgot)}>PIN vergessen?</button>
      )}
      {forgot && mode === 'login' && (
        <div className="banner">Kein Problem: Der Admin deiner Gruppe kann dir unter „Gruppen“ eine neue PIN geben.</div>
      )}

      {isIOS() && !standalone() && (
        <div className="banner">
          Tipp fürs iPhone: Leg Joinly danach über Teilen → „Zum Home-Bildschirm“ ab und melde dich dort mit derselben Nummer und PIN an.
        </div>
      )}

      {err && <div className="banner" style={{ color: 'var(--danger)' }}>{err}</div>}
      <div className="bottom"><div className="bottom-inner">
        <button className="fab" type="submit" disabled={!ok || busy} style={!ok ? { opacity: 0.5 } : undefined}>
          {busy ? 'Einen Moment …' : mode === 'login' ? 'Anmelden' : mode === 'secure' ? 'PIN speichern' : 'Los geht’s'}
        </button>
      </div></div>
    </form>
  );
}
