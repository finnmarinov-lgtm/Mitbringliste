// Service Worker: macht die Mitbringliste installierbar und zeigt sie auch ohne Netz an.
// Online wird immer die neueste Fassung geholt, der Speicher ist nur der Notfall.
const CACHE = 'mitbringliste-v1';
const DATEIEN = ['./', './index.html', './style.css', './manifest.webmanifest', './icon.svg', './icon-192.png',
  './js/app.js', './js/api.js', './js/aufteilen.js', './js/termine.js', './js/vorlage.js'];

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
