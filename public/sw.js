// Do not intercept the document or JavaScript. A failed worker fetch shows a white screen.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Let the browser load the app. Do not cache index.html or JS.
});
