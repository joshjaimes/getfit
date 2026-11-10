// Offline support: app files are served from cache and refreshed in the background.
const CACHE = 'getfit-v2';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/styles.css', 'vendor/preact.js',
  'js/app.js', 'js/store.js', 'js/calc.js', 'js/data.js', 'js/ui.js', 'js/workout.js', 'js/food.js',
  'js/scan.js', 'js/progress.js', 'js/profile.js', 'js/strava.js', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
const CDN = ['cdn.jsdelivr.net', 'tessdata.projectnaptha.com', 'unpkg.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  if (!same && !CDN.includes(url.hostname)) return; // food database etc. always go to the network
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: same });
    const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; });
    if (hit) { net.catch(() => {}); return hit; }
    return net;
  }));
});
