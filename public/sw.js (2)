// Lifebencher Match service worker.
// Do not intercept the document or JS. A failed service-worker fetch shows a blank white page.
const CACHE_NAME = 'lifebencher-v4';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') return;
  const path = new URL(event.request.url).pathname;
  if (path === '/' || path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.json')) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
