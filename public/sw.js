// Kill-switch service worker.
//
// The previous (Next.js PWA) version of Oversight registered a service worker
// that can still be installed in visitors' browsers, intercepting requests and
// serving stale files. This replacement unregisters itself, clears all caches,
// and reloads open tabs so the current site loads fresh.
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    (async function () {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(function (k) { return caches.delete(k); }));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(function (c) { c.navigate(c.url); });
      } catch (e) {
        /* best effort */
      }
    })()
  );
});

// While briefly active, never serve from cache — always hit the network.
self.addEventListener('fetch', function (event) {
  event.respondWith(
    fetch(event.request).catch(function () {
      return new Response('', { status: 504 });
    })
  );
});
