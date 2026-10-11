import { api } from './api.js';
import { VAPID_PUBLIC } from './config.js';

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

function keyBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// unsupported | install | denied | on | off
export async function pushState() {
  if (isIOS() && !standalone()) return 'install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  try {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
  } catch { return 'off'; }
}

export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) });
  await api.savePushSubscription(sub.toJSON());
  return 'on';
}

// Beim Start: vorhandene Anmeldung erneut speichern (falls sie sich geändert hat)
export async function refreshPush() {
  try {
    if ((await pushState()) !== 'on') return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await api.savePushSubscription(sub.toJSON());
  } catch { /* egal */ }
}
