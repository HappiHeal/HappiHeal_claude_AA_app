// HappiHeal service worker — app-shell caching only.
// Bump this version string whenever you deploy a new version of index.html
// so returning users get the fresh copy instead of a stale cached one.
const CACHE_VERSION = 'happiheal-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install: pre-cache the app shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up any old cache versions from previous deploys.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: only handle same-origin GET requests. Everything else (Supabase
// auth/data calls, Razorpay checkout, Google Fonts, CDN scripts) passes
// straight through to the network untouched — this worker never caches
// or intercepts third-party or non-GET traffic.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // Network-first for the HTML shell so users get your latest deploy
  // whenever they're online, with the cached copy as an offline fallback.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first for static assets (manifest, icons) — fall back to network.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
