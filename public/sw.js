self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = { title: 'Incoming call', body: 'Incoming voice call', url: '/#messages' };
  try { data = { ...data, ...(event.data ? event.data.json() : {}) }; } catch { /* keep default */ }
  const title = data.type === 'incoming_call' ? data.title || 'Incoming voice call' : data.title;
  const body = data.type === 'incoming_call' ? (data.callType === 'video' ? 'Incoming video call' : 'Incoming voice call') : data.body;
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: data.callId ? `call-${data.callId}` : 'lifebencher',
    renotify: true,
    data
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/#messages';
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((clients) => {
    const open = clients.find((client) => client.url.includes(self.location.origin));
    if (open) {
      open.postMessage({ type: 'incoming_call', callId: event.notification.data?.callId });
      return open.focus();
    }
    return self.clients.openWindow(url);
  }));
});
