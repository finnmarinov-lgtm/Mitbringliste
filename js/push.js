// Erinnerungen per Benachrichtigung: dieses Gerät an- und abmelden (Web Push über den Service Worker).
import { VAPID_PUBLIC } from './push-schluessel.js';

export const pushMoeglich = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function schluesselBytes(b64) {
  const s = (b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

// Wartet höchstens 10 Sekunden auf den aktiven Service Worker
function bereit() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, nein) => setTimeout(() => nein(Object.assign(new Error('kein_sw'), { code: 'kein_sw' })), 10000)),
  ]);
}

export async function aboHolen() {
  if (!pushMoeglich()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function abonnieren() {
  const erlaubnis = await Notification.requestPermission();
  if (erlaubnis !== 'granted') {
    throw Object.assign(new Error(erlaubnis), { code: erlaubnis === 'denied' ? 'blockiert' : 'abgebrochen' });
  }
  const reg = await bereit();
  return (await reg.pushManager.getSubscription())
    || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluesselBytes(VAPID_PUBLIC) });
}
