const CACHE = 'uptempo-offline-timetables-v2';
const offlinePage = new URL('offline.html', self.registration.scope).href;
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.add(new Request(offlinePage, {cache:'reload'}));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || !event.request.url.startsWith(self.registration.scope)) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.open(CACHE)).match(offlinePage)));
});
