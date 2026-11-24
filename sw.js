const CACHE = 'tijian-mobile-20261124-v22';
const FILES = ['./', 'index.html', 'style.css', 'mobile.css', 'core.js', 'seed.js', 'config.js', 'cloud.js', 'app.js', 'manifest.webmanifest', 'operation-page/index.html', 'operation-page/data.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('tijian-mobile-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Use one cached application version so HTML and scripts remain compatible offline.
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    if (new URL(event.request.url).pathname.includes('/operation-page/')) {
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch (_) { return new Response('此操作题资料尚未缓存，请联网打开一次。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
    }
    if (event.request.mode === 'navigate') return cache.match('index.html');
    return fetch(event.request);
  }));
});
