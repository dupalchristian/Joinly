// Kostenlose Dienste ohne Schlüssel:
// Wetter: Open-Meteo · Ortssuche: Photon (OpenStreetMap) · Fahrzeit: OSRM

// Zwischenspeicher im Speicher und auf dem Handy, damit Wetter und Fahrzeit beim Öffnen sofort da sind
const cache = new Map();
const cached = async (key, ttlMs, fn) => {
  let hit = cache.get(key);
  if (!hit) { try { hit = JSON.parse(localStorage.getItem('joinly-svc:' + key)); } catch { hit = null; } }
  if (hit && Date.now() - hit.t < ttlMs) { cache.set(key, hit); return hit.v; }
  if (!cache.has('p:' + key)) cache.set('p:' + key, fn().finally(() => cache.delete('p:' + key)));
  const v = await cache.get('p:' + key);
  const entry = { t: Date.now(), v };
  cache.set(key, entry);
  try { localStorage.setItem('joinly-svc:' + key, JSON.stringify(entry)); } catch { /* egal */ }
  return v;
};

// Standard, wenn niemand eine Heimadresse hinterlegt hat (München)
export const FALLBACK_POS = { lat: 48.137, lng: 11.575 };

const WMO = (code) => {
  if (code === 0 || code === 1) return { kind: 'sun', label: 'Sonnig' };
  if (code === 2) return { kind: 'cloud', label: 'Leicht bewölkt' };
  if (code === 3) return { kind: 'cloud', label: 'Bewölkt' };
  if (code === 45 || code === 48) return { kind: 'cloud', label: 'Nebel' };
  if (code >= 71 && code <= 77) return { kind: 'snow', label: 'Schnee' };
  if (code === 85 || code === 86) return { kind: 'snow', label: 'Schneeschauer' };
  if (code >= 95) return { kind: 'rain', label: 'Gewitter' };
  return { kind: 'rain', label: 'Regen' };
};

// Wetter für Ort und Zeitfenster: Regen ja/nein + Temperatur
export async function weatherFor(lat, lng, startIso, endIso) {
  const la = lat.toFixed(2), lo = lng.toFixed(2);
  const data = await cached('w' + la + lo, 30 * 60 * 1000, async () => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}` +
      '&hourly=temperature_2m,precipitation_probability,weather_code&timezone=auto&forecast_days=8';
    const r = await fetch(url);
    if (!r.ok) throw new Error('Wetter nicht erreichbar');
    return r.json();
  });
  const start = new Date(startIso).getTime(), end = new Date(endIso).getTime();
  const offset = (data.utc_offset_seconds ?? 0) * 1000;
  const idx = [];
  data.hourly.time.forEach((t, i) => {
    const ms = Date.parse(t + 'Z') - offset; // Ortszeit -> UTC
    if (ms >= start - 30 * 60000 && ms <= end) idx.push(i);
  });
  if (!idx.length) return null; // weiter als 7 Tage entfernt
  const temps = idx.map(i => data.hourly.temperature_2m[i]);
  const rain = Math.max(...idx.map(i => data.hourly.precipitation_probability[i] ?? 0));
  const codes = idx.map(i => data.hourly.weather_code[i]);
  const worst = Math.max(...codes);
  let w = WMO(worst);
  if (w.kind === 'rain' && rain < 35) w = { kind: 'cloud', label: 'Bewölkt, eher trocken' };
  const avg = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
  return { ...w, temp: avg, rain, dry: w.kind !== 'rain' && w.kind !== 'snow' };
}

// Ortssuche (OpenStreetMap)
export async function searchPlaces(q, near) {
  if (!q || q.trim().length < 3) return [];
  const bias = near ? `&lat=${near.lat}&lon=${near.lng}` : '';
  const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=de&limit=6${bias}`);
  if (!r.ok) return [];
  const j = await r.json();
  return j.features.map(f => {
    const p = f.properties;
    const sub = [p.street && (p.street + (p.housenumber ? ' ' + p.housenumber : '')), p.postcode, p.city || p.town || p.village || p.county]
      .filter(Boolean).join(', ');
    return { name: p.name || p.street || p.city || 'Ort', sub, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
  });
}

// Entfernung und Fahrzeit mit dem Auto
export async function driveInfo(from, to) {
  if (!from || !to) return null;
  const key = ['d', from.lat.toFixed(3), from.lng.toFixed(3), to.lat.toFixed(3), to.lng.toFixed(3)].join(',');
  return cached(key, 24 * 3600 * 1000, async () => {
    try {
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`);
      const j = await r.json();
      const route = j.routes?.[0];
      if (!route) return null;
      return { km: Math.max(1, Math.round(route.distance / 1000)), min: Math.max(1, Math.round(route.duration / 60)) };
    } catch {
      return null;
    }
  });
}

export const isApple = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;

// Ziel als Text (Name + Adresse), damit die Karten-App den richtigen Ort mit Namen anzeigt.
// Ohne Adresse: Koordinaten, sonst nur der Name.
function destination(s) {
  if (s.place_address) return `${s.place_name}, ${s.place_address}`;
  if (s.place_lat != null) return `${s.place_lat},${s.place_lng}`;
  return s.place_name || '';
}

export function googleMapsUrl(s) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination(s))}&travelmode=driving`;
}

export function appleMapsUrl(s) {
  const ll = s.place_lat != null ? `&ll=${s.place_lat},${s.place_lng}` : '';
  return `https://maps.apple.com/?daddr=${encodeURIComponent(destination(s))}&dirflg=d${ll}`;
}
