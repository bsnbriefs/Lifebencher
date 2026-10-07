self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = { title: 'Incoming call', body: 'Someone is calling you' };
  try { data = { ...data, ...(event.data ? event.data.json() : {}) }; } catch { /* keep default */ }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, data }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((clients) => {
    const open = clients.find((client) => client.url.includes(self.location.origin));
    if (open) return open.focus();
    return self.clients.openWindow('/#messages');
  }));
});
