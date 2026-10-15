import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const esc = (t) => String(t || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Karte mit Ziel (goldener Pin), Zuhause (weißer Punkt) und Live-Standorten (Kreise mit Initial/Bild)
export default function MapView({ place, home, markers = [] }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO'
    }).addTo(m);
    // Falls die dunkle Karte nicht lädt: normale OpenStreetMap-Karte nehmen
    let errors = 0, switched = false;
    dark.on('tileerror', () => {
      if (switched || ++errors < 3) return;
      switched = true;
      m.removeLayer(dark);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    });
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    m.setView([48.137, 11.575], 11);
    // iPhone: Größe nach dem Einblenden neu berechnen, sonst bleibt die Karte grau
    const t1 = setTimeout(() => m.invalidateSize(), 150);
    const t2 = setTimeout(() => m.invalidateSize(), 600);
    const onResize = () => m.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', onResize); m.remove(); map.current = null; };
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
