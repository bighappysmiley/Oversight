// Kill-switch service worker.
//
// The previous version of this site was a Vite PWA that registered a
// service worker here at /sw.js. That worker pre-cached the old app shell
// and kept serving it from cache, so visitors never saw the new Next.js
// site deployed on Netlify (e.g. the download button still pointed at the
// old .command file).
//
// This replacement worker does the opposite of caching: on activation it
// deletes every cache, unregisters itself, and reloads all open tabs so
// they fetch the live site fresh from the network. After it runs once,
// no service worker remains registered.

self.addEventListener('install', () => {
  // Activate immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Delete every cache the old PWA created.
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));

      // 2. Take control of all open tabs.
      await self.clients.claim();

      // 3. Remove this service worker entirely.
      await self.registration.unregister();

      // 4. Reload every open tab so it loads fresh from the network.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })()
  );
});

// Always go to the network — never serve anything from cache.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
