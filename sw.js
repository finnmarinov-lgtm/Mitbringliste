// Service Worker: macht die Mitbringliste installierbar und zeigt sie auch ohne Netz an.
// Online wird immer die neueste Fassung geholt, der Speicher ist nur der Notfall.
const CACHE = 'mitbringliste-v3';
const DATEIEN = ['./', './index.html', './style.css', './manifest.webmanifest', './icon.svg', './icon-192.png',
  './js/app.js', './js/api.js', './js/aufteilen.js', './js/termine.js', './js/vorlage.js', './js/push.js', './js/push-schluessel.js', './js/regeln.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

// Nur eigene alte Speicher löschen: Petri Heil und Feuer Frei liegen unter derselben Adresse
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('mitbringliste-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // Supabase und die Ferien-Schnittstelle laufen direkt durch
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) {
      const kopie = res.clone();
      caches.open(CACHE).then(c => c.put(req, kopie)).catch(() => {});
    }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
});

// Erinnerung anzeigen (verschickt von erinnerung/senden.js)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { text: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titel || 'Mitbringliste', {
    body: d.text || '', icon: 'icon-192.png', tag: d.tag || 'mitbringliste', data: { url: d.url || './' },
  }));
});

// Tipp auf die Benachrichtigung: App öffnen oder nach vorn holen
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const ziel = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(fenster => {
    const offen = fenster.find(f => f.url.startsWith(self.registration.scope));
    return offen ? offen.focus() : clients.openWindow(ziel);
  }));
});
