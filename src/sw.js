/* Service Worker: Offline-Cache und Push-Nachrichten */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Joinly', body: event.data?.text() }; }
  const title = data.title || 'Joinly';
  const basic = { body: data.body || '', icon: data.icon || 'icon-192.png', tag: data.tag, data: { url: data.url || './' } };
  // Android zeigt Knöpfe, Profilbild und kleines Symbol in der Statusleiste; iOS ignoriert, was es nicht kennt
  const rich = {
    ...basic,
    badge: 'badge-96.png',
    renotify: !!data.tag,
    vibrate: [70, 40, 70],
    timestamp: Date.now(),
    actions: (data.actions || []).slice(0, 2)
  };
  event.waitUntil(
    self.registration.showNotification(title, rich).catch(() => self.registration.showNotification(title, basic))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let url = new URL(event.notification.data?.url || './', self.registration.scope);
  // Knopf in der Nachricht („Bin dabei“, „Hätte Lust“): App öffnet und erledigt es direkt
  if (event.action && event.action !== 'open') url.searchParams.set('do', event.action);
  url = url.href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        c.postMessage({ type: 'open', url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
