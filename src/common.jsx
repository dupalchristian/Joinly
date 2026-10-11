import { useEffect, useState } from 'react';
import { weatherFor, driveInfo, FALLBACK_POS } from './services.js';
import { WeatherIcon } from './Icons.jsx';

export function Avatar({ p, me, lg }) {
  const isMe = me && p?.id === me.id;
  const ini = isMe ? 'Du' : (p?.first_name || '?').charAt(0).toUpperCase();
  return (
    <div className={'avatar' + (isMe ? ' me' : '') + (lg ? ' lg' : '')}
      style={isMe ? undefined : { background: p?.avatar_color || '#2E2E2E' }}
      title={p?.first_name}>{ini}</div>
  );
}

export const homeOf = (me) => (me?.home_lat != null ? { lat: me.home_lat, lng: me.home_lng } : null);
export const placeOf = (s) => (s.place_lat != null ? { lat: s.place_lat, lng: s.place_lng } : null);

// Wetter + Fahrzeit für einen Status
export function useExtras(s, me) {
  const [wx, setWx] = useState(null);
  const [drive, setDrive] = useState(null);
  const home = homeOf(me);
  const place = placeOf(s);
  const pos = place || home || FALLBACK_POS;
  useEffect(() => {
    let live = true;
    weatherFor(pos.lat, pos.lng, s.starts_at, s.ends_at).then(w => live && setWx(w)).catch(() => {});
    if (place && home) driveInfo(home, place).then(d => live && setDrive(d));
    else setDrive(null);
    return () => { live = false; };
  }, [s.id, s.starts_at, s.ends_at, pos.lat, pos.lng, home?.lat, home?.lng]);
  return { wx, drive };
}

export function WeatherBadge({ wx }) {
  if (!wx) return null;
  return <span className="wx"><WeatherIcon kind={wx.kind} />{wx.temp}°</span>;
}

export function placeText(s, drive) {
  if (s.place_mode === 'none' || !s.place_name) return 'Ort noch offen';
  return drive ? `${s.place_name} · ${drive.km} km · ca. ${drive.min} Min.` : s.place_name;
}

export function Toast({ text, onDone }) {
  useEffect(() => { if (!text) return; const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, [text]);
  return text ? <div className="toast" role="status">{text}</div> : null;
}
