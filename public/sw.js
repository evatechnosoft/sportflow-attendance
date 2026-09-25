// Hand-written service worker: offline app shell + cache-first hashed assets.
// Scope-relative so the app works at the site root or under a path (/yoklama/, /yonetim/)
// next to other apps on the same origin. Bump VERSION to drop old caches on the next activate.
const VERSION = 'v2'
const PREFIX = 'yoklama-'
const CACHE = `${PREFIX}${VERSION}`
const SCOPE = new URL(self.registration.scope).pathname
const INDEX = `${SCOPE}index.html`

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([SCOPE, INDEX])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Only this app's old caches: other apps on the same origin keep theirs.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // Network-first so deploys show up immediately; cached shell when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(INDEX, copy))
          }
          return response
        })
        .catch(() => caches.match(INDEX)),
    )
    return
  }

  if (url.pathname.startsWith(`${SCOPE}assets/`)) {
    // Vite asset names are content-hashed, so a cached copy never goes stale.
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
})
