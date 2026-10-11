import { useState } from 'react';
import { api } from './api.js';
import PlaceSearch from './PlaceSearch.jsx';

const COLORS = ['#3B4A5A', '#5A3B4A', '#3B5A45', '#5A513B', '#463B5A', '#5A433B', '#3B5557'];

export default function Onboarding({ invite, onDone }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [home, setHome] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const ok = name.trim().length > 0 && phone.replace(/\D/g, '').length >= 6;

  const submit = async (e) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true); setErr('');
    try {
      const me = await api.saveProfile({
        first_name: name.trim(), phone: phone.trim(),
        avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)],
        home_label: home?.name ?? null, home_lat: home?.lat ?? null, home_lng: home?.lng ?? null
      });
      onDone(me);
    } catch (e2) {
      setErr('Das hat nicht geklappt: ' + e2.message);
      setBusy(false);
    }
  };

  return (
    <form className="screen stack" style={{ gap: 24 }} onSubmit={submit}>
      <img src="logo.png" alt="Joinly – offen für …" className="logo" style={{ height: 56, marginTop: 24, alignSelf: 'flex-start' }} />
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="h1">{invite ? `Du bist zu „${invite.group_name}“ eingeladen` : 'Willkommen'}</h1>
        <p className="soft" style={{ margin: 0, lineHeight: '22px' }}>
          {invite
            ? 'Trag kurz deinen Vornamen und deine Handynummer ein. Danach muss dich der Admin der Gruppe noch freigeben.'
            : 'Zeig deinen Freunden, worauf du gerade Lust hast, und sieh, wer mitmacht.'}
        </p>
      </div>
      <label className="field">Vorname
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40} />
      </label>
      <label className="field">Handynummer
        <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+49 …" />
      </label>
      <PlaceSearch label="Heimadresse (optional, für Entfernung und Fahrzeit)" placeholder="Straße und Ort"
        value={home} onPick={setHome} />
      <p className="small muted" style={{ margin: 0 }}>Deine Adresse sieht niemand, sie wird nur für die Fahrzeit genutzt.</p>
      {err && <div className="banner" style={{ color: 'var(--danger)' }}>{err}</div>}
      <div className="bottom"><div className="bottom-inner">
        <button className="fab" type="submit" disabled={!ok || busy}>{busy ? 'Einen Moment …' : 'Los geht’s'}</button>
      </div></div>
    </form>
  );
}
