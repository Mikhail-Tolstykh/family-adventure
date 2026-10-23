// Offline support: every file the game loads is kept in a cache.
// The page itself is fetched fresh when online (so updates arrive) and from the cache when offline.
const CACHE = 'family-adventure-v1';

self.addEventListener('install', (e) => {
  // Cache the whole game on the first visit: the page, its script and every image in the asset list.
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const html = await (await fetch('./')).text();
    const scripts = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
    const images = (await (await fetch('assets/manifest.json')).json()).map((k) => `assets/${k}.png`);
    await c.addAll(['./', 'manifest.webmanifest', 'assets/manifest.json', 'icons/icon-192.png', ...scripts, ...images]);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const fresh = fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  });
  // Pages and the asset list: network first. Everything else (hashed code, images): cache first.
  const networkFirst = req.mode === 'navigate' || req.url.endsWith('manifest.json');
  e.respondWith(networkFirst
    ? fresh.catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./')))
    : caches.match(req).then((r) => { fresh.catch(() => {}); return r || fresh; }));
});
