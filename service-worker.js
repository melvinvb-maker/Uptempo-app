// App files: network first so updates arrive straight away, with the cached copy as fallback without signal.
// Images (also artist photos from other sites): served from the cache and refreshed in the background.
const CACHE = 'uptempo-app-v14';
const IMAGES = 'uptempo-images-v1';
const MAX_IMAGES = 400;
const scope = self.registration.scope;
const offlinePage = new URL('offline.html', scope).href;
const shell = ['./', 'index.html', 'offline.html', 'manifest.json', 'app.js?v=festivalgids-12', 'festival-guide.js?v=4',
  'artist-bios.js', 'timetable-photos.js', 'auto-photos.js', 'confused-editions.mjs', 'firebase-config.js',
  'uptempo-192.png', 'uptempo-512.png', 'apple-touch-icon.png'].map(path => new URL(path, scope).href);

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.add(new Request(offlinePage, {cache:'reload'}));
  await Promise.all(shell.map(url => cache.add(new Request(url, {cache:'reload'})).catch(() => {})));
  await self.skipWaiting();
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  const keep = [CACHE, IMAGES];
  for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
  await self.clients.claim();
})()));

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request) || await cache.match(request, {ignoreSearch:true});
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match(offlinePage);
    throw error;
  }
}

async function trimImages(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_IMAGES))) await cache.delete(key);
}

async function imageFromCache(event) {
  const cache = await caches.open(IMAGES);
  const cached = await caches.match(event.request);
  const refresh = fetch(event.request).then(response => {
    if (response.ok || response.type === 'opaque') cache.put(event.request, response.clone()).then(() => trimImages(cache));
    return response;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => {}));
    return cached;
  }
  return refresh;
}

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  if (request.destination === 'image') return event.respondWith(imageFromCache(event));
  if (request.url.startsWith(scope)) event.respondWith(networkFirst(request));
});
