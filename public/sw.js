/*
 * Service worker: makes the app load with no network.
 *
 * How it works, in plain terms:
 *  1. When the browser installs this worker it downloads every file of the built app (the list is
 *     stamped in by vite.config.js) into a cache named after a hash of those files.
 *  2. After that, every request for one of those files is answered from the cache, so the app opens
 *     instantly and offline. (Your cards aren't in this cache: they're in IndexedDB.)
 *  3. When a new version of the app is deployed, the file list/hash changes, so the browser sees a
 *     "new" worker. It installs next to the old one and WAITS, so a page already open keeps the files
 *     it started with. The page offers a "Reload" button, which sends 'skip-waiting' to switch over.
 */
const CACHE_NAME = '__CACHE_NAME__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith('flashcards-') && n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()), // start controlling already-open pages (matters on the very first visit)
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { cacheName: CACHE_NAME, ignoreSearch: true }).then(
      (cached) =>
        cached ??
        // Any page navigation (this is a single-page app) gets the cached index.html.
        (request.mode === 'navigate' ? caches.match('./', { cacheName: CACHE_NAME }) : undefined) ??
        fetch(request),
    ),
  );
});
