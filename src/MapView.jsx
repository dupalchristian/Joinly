import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function MapView({ place, home }) {
  const el = useRef(null);
  useEffect(() => {
    if (!el.current || !place) return;
    const map = L.map(el.current, { zoomControl: false, attributionControl: true, dragging: true, scrollWheelZoom: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
      attribution: '© OpenStreetMap · © CARTO'
    }).addTo(map);
    const pin = L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [30, 30], iconAnchor: [15, 30] });
    L.marker([place.lat, place.lng], { icon: pin }).addTo(map);
    if (home) {
      L.circleMarker([home.lat, home.lng], { radius: 6, color: '#fff', fillColor: '#fff', fillOpacity: 1, weight: 0 }).addTo(map);
      map.fitBounds(L.latLngBounds([[place.lat, place.lng], [home.lat, home.lng]]), { padding: [50, 50], maxZoom: 14 });
    } else {
      map.setView([place.lat, place.lng], 13);
    }
    return () => map.remove();
  }, [place?.lat, place?.lng, home?.lat, home?.lng]);
  return <div ref={el} style={{ height: '100%' }} />;
}
