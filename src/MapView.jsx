import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const esc = (t) => String(t || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Kartenhintergrund: OpenFreeMap „Dark“ – kostenlos, ohne Schlüssel und ohne Limit.
// (CARTO verlangt seit Aug. 2026 einen Schlüssel und zeigt sonst „API KEY REQUIRED“.)
const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const DARK_ATTR = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

// Ersatz, falls die dunkle Karte nicht geht (z. B. altes Handy ohne WebGL)
function addOsm(m) {
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(m);
}

async function addDarkBase(m, alive) {
  let done = false;
  const fallback = (layer) => {
    if (done || !alive()) return;
    done = true;
    if (layer) m.removeLayer(layer);
    addOsm(m);
  };
  try {
    const [{ maplibreGL }, maplibre, worker] = await Promise.all([
      import('@maplibre/maplibre-gl-leaflet'),
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
      import('maplibre-gl/dist/maplibre-gl.css')
    ]);
    if (!alive()) return;
    maplibre.setWorkerUrl(worker.default);
    const layer = maplibreGL({ style: DARK_STYLE, attributionControl: { customAttribution: DARK_ATTR } }).addTo(m);
    const gl = layer.getMaplibreMap();
    const timer = setTimeout(() => fallback(layer), 15000);
    gl.once('load', () => { done = true; clearTimeout(timer); });
    // Fehler vor dem ersten Laden (z. B. Dienst nicht erreichbar) → Ersatzkarte
    gl.on('error', () => { if (!done) { clearTimeout(timer); fallback(layer); } });
  } catch {
    fallback(null);
  }
}

// Karte mit Ziel (goldener Pin), Zuhause (weißer Punkt) und Live-Standorten (Kreise mit Initial/Bild)
export default function MapView({ place, home, markers = [] }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    let alive = true;
    addDarkBase(m, () => alive);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    m.setView([48.137, 11.575], 11);
    // iPhone: Größe nach dem Einblenden neu berechnen, sonst bleibt die Karte grau
    const t1 = setTimeout(() => m.invalidateSize(), 150);
    const t2 = setTimeout(() => m.invalidateSize(), 600);
    const onResize = () => m.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => { alive = false; clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', onResize); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layer.current.clearLayers();
    const pts = [];
    if (place) {
      const pin = L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [30, 30], iconAnchor: [15, 30] });
      L.marker([place.lat, place.lng], { icon: pin }).addTo(layer.current);
      pts.push([place.lat, place.lng]);
    }
    if (home) {
      L.circleMarker([home.lat, home.lng], { radius: 6, color: '#fff', fillColor: '#fff', fillOpacity: 1, weight: 0 }).addTo(layer.current);
      if (!markers.length) pts.push([home.lat, home.lng]);
    }
    for (const mk of markers) {
      const inner = mk.img ? `<img src="${esc(mk.img)}" alt="">` : esc(mk.label);
      const icon = L.divIcon({
        className: '', iconSize: [38, 38], iconAnchor: [19, 19],
        html: `<div class="live-dot${mk.me ? ' me' : ''}" style="background:${esc(mk.color || '#2E2E2E')}">${inner}</div>`
      });
      L.marker([mk.lat, mk.lng], { icon, title: mk.title || '' }).addTo(layer.current);
      pts.push([mk.lat, mk.lng]);
    }
    if (!fitted.current || markers.length) {
      if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 15 });
      else if (pts.length === 1) m.setView(pts[0], 14);
      fitted.current = pts.length > 0;
    }
  }, [place?.lat, place?.lng, home?.lat, home?.lng, JSON.stringify(markers)]);

  return <div ref={el} style={{ height: '100%' }} />;
}
