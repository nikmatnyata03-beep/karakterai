// sw.js — KarakterAI Service Worker
// Bertanggung jawab untuk:
//   1. Cache app (PWA offline)
//   2. Menerima jadwal notifikasi dari main thread
//   3. Menampilkan notifikasi meski tab di-minimize / pindah tab
//   4. Meneruskan FOLLOWUP_DUE ke tab yang terbuka

const CACHE = 'karakterai-v1';
const CACHE_FILES = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

// ── In-memory scheduled notifications (reset jika SW di-restart browser) ──
// Untuk delay panjang (jam), Option C (catch-up saat buka) yang handle.
// SW ini reliable untuk delay pendek-menengah (< 30 menit aktif).
const scheduled = new Map(); // charId → { timer, charName, followUpIndex }

// ── Install: cache aset utama ─────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(CACHE_FILES).catch(() => {}) // fail silently jika file tidak ada
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: claim semua tab ─────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: serve dari cache dulu, fallback ke network ────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      // Cache response baru untuk kunjungan berikutnya
      if (resp && resp.status === 200 && resp.type === 'basic') {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }))
  );
});

// ── Message dari main thread ──────────────────────────────────────────────
self.addEventListener('message', e => {
  const { type, payload } = e.data || {};

  // Jadwalkan notifikasi + trigger follow-up
  if (type === 'SCHEDULE_NOTIF') {
    const { charId, charName, charAvatar, delayMs, followUpIndex } = payload;

    // Batalkan timer lama untuk karakter ini
    if (scheduled.has(charId)) {
      clearTimeout(scheduled.get(charId).timer);
      scheduled.delete(charId);
    }

    const timer = setTimeout(async () => {
      scheduled.delete(charId);

      // Ambil semua tab/window yang terbuka
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // Cek apakah ada tab yang sedang focused (user aktif)
      const hasActiveFocus = allClients.some(c => c.focused);

      // Tampilkan notifikasi jika user tidak sedang aktif di tab ini
      if (!hasActiveFocus && Notification.permission !== 'denied') {
        await self.registration.showNotification(`${charName} mengirim pesan`, {
          body: 'Tap untuk membuka percakapan',
          icon: charAvatar || '/icon-192.png',
          badge: '/icon-72.png',
          tag: 'followup-' + charId,
          renotify: true,
          data: { charId, followUpIndex },
          actions: [
            { action: 'open',   title: '💬 Buka Chat' },
            { action: 'ignore', title: 'Nanti' }
          ]
        });
      }

      // Kirim event ke semua tab yang terbuka — tab akan generate follow-up sendiri
      allClients.forEach(client => {
        client.postMessage({
          type: 'FOLLOWUP_DUE',
          payload: { charId, followUpIndex }
        });
      });

    }, delayMs);

    scheduled.set(charId, { timer, charName, followUpIndex });
  }

  // Batalkan notifikasi (user sudah membalas)
  if (type === 'CANCEL_NOTIF') {
    const { charId } = payload;
    if (scheduled.has(charId)) {
      clearTimeout(scheduled.get(charId).timer);
      scheduled.delete(charId);
    }
    // Hapus notifikasi yang sudah tampil (jika ada)
    self.registration.getNotifications({ tag: 'followup-' + charId })
      .then(notifs => notifs.forEach(n => n.close()));
  }
});

// ── Klik notifikasi ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'ignore') return;

  const charId = e.notification.data?.charId;

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Fokus tab yang sudah ada
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        if (charId) existing.postMessage({ type: 'OPEN_CHAR', payload: { charId } });
        return;
      }
      // Buka tab baru jika tidak ada yang terbuka
      const url = charId
        ? `${self.location.origin}/?charId=${encodeURIComponent(charId)}`
        : self.location.origin;
      return self.clients.openWindow(url);
    })
  );
});
