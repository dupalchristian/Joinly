# Joinly – offen für …

Web-App (PWA) für Freundeskreise: Jeder zeigt, worauf er wann Lust hat, die anderen machen per Klick mit.

## Aufbau
- **App:** React + Vite, als PWA installierbar (iPhone: Teilen → „Zum Home-Bildschirm“, Android: „App installieren“)
- **Datenbank & Anmeldung:** Supabase (kostenlose Stufe), anonyme Anmeldung pro Gerät, Vorname + Handynummer im Profil
- **Wetter:** Open-Meteo · **Ortssuche:** Photon/OpenStreetMap · **Fahrzeit:** OSRM · **Karte:** OpenStreetMap/CARTO – alles ohne Schlüssel und kostenlos
- **Hosting:** GitHub Pages, wird bei jedem Push auf `main` automatisch veröffentlicht

## Einrichten
1. Supabase-Projekt anlegen, unter *Authentication → Sign In / Providers* „Allow anonymous sign-ins“ einschalten.
2. `supabase/schema.sql` im SQL-Editor ausführen.
3. Project URL und anon key (Settings → API) in `src/config.js` eintragen.
4. GitHub: Settings → Pages → Source „GitHub Actions“.

Ohne Werte in `src/config.js` läuft die App im Demo-Modus mit Beispieldaten.

## Lokal starten
```
npm install
npm run dev
```

## Noch offen (nächste Version)
- Push-Nachrichten für ausgewählte Aktivitäten (Einstellungen werden schon gespeichert)
- SMS-Bestätigung der Handynummer
- Verkehrsmittel wählbar, Wetter-Warnung, Status nur für bestimmte Personen, Rückblick, Mindestteilnehmer
