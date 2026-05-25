const CACHE = 'gym-v1';
const PRECACHE = ['./', './index.html', './manifest.json', './icon.svg'];

/* ── Install: pre-cache the shell ── */
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

/* ── Activate: remove old caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch ── */
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* Navigation requests → always serve the cached app shell */
  if (request.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(cached => cached || fetch(request))
    );
    return;
  }

  /* Static image CDNs (YouTube thumbnails, Wikipedia images) → cache-first */
  if (
    url.hostname === 'img.youtube.com' ||
    url.hostname === 'upload.wikimedia.org'
  ) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        }).catch(() => new Response('', { status: 408 }));
      })
    );
    return;
  }

  /* Same-origin assets (manifest, icon) → cache-first */
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        });
      })
    );
    return;
  }

  /* External APIs (Wikipedia, wger) → network-first, cache fallback */
  e.respondWith(
    fetch(request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
