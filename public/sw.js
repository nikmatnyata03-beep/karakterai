// public/sw.js — NeuralChat Service Worker
// Handles background push notifications and notification click routing

const CACHE_NAME = 'neuralchat-v1';

// ─── Push event: show notification ──────────────────────────
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { title: 'NeuralChat', body: event.data?.text() || '' };
  }

  const title   = payload.title || 'NeuralChat 💬';
  const options = {
    body:      payload.body || 'Kamu punya pesan baru!',
    icon:      payload.icon  || '/icon-192.png',
    badge:     payload.badge || '/icon-72.png',
    tag:       payload.tag   || 'neuralchat-followup',
    renotify:  true,
    vibrate:   [200, 100, 200, 100, 200],
    data:      payload.data  || {},
    actions: [
      { action: 'open',    title: '💬 Buka Chat' },
      { action: 'dismiss', title: '✕ Tutup'      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click: focus or open window ────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const charId = event.notification.data?.charId;
  const targetUrl = charId
    ? `${self.location.origin}/?charId=${encodeURIComponent(charId)}`
    : self.location.origin + '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it and post message
        for (const client of clientList) {
          if ('focus' in client) {
            if (charId) {
              client.postMessage({ type: 'FOCUS_CHAR', charId });
            }
            return client.focus();
          }
        }
        // Otherwise open a new window
        return clients.openWindow(targetUrl);
      })
  );
});

// ─── Activate: claim all clients immediately ─────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
