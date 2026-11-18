// Chess Guru service worker. Makes the app work offline once it has been opened.
// Built into dist/sw.js by the swPlugin in vite.config.ts, which fills in VERSION and PRECACHE.
//
// - App files (HTML, JS, CSS, icons, Stockfish, opening and puzzle data) are downloaded and
//   cached when the worker installs.
// - The Maia model and ONNX Runtime (about 37 MB) are cached the first time they are used,
//   so people who never play Maia levels don't download them. (maia3-js caches the model
//   itself; this worker caches ONNX Runtime.)
// - Page loads try the network first (to get updates) and fall back to the cached app offline.
// - A new version waits until the app asks it to take over (the "update ready" banner).

const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__
const APP_CACHE = `chess-guru-app-${VERSION}`
const RUNTIME_CACHE = 'chess-guru-runtime'
// /maia/ is not listed: maia3-js keeps the model in its own cache, which caches.match() also searches.
const RUNTIME_PATHS = ['/ort/', '/engine/', '/assets/', '/icons/']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(PRECACHE)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('chess-guru-app-') && key !== APP_CACHE) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // e.g. the Lichess API: always live

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(
        async () =>
          (await caches.match('/index.html', { ignoreVary: true })) ??
          (await caches.match('/', { ignoreVary: true })) ??
          Response.error(),
      ),
    )
    return
  }

  event.respondWith(
    (async () => {
      // ignoreVary: the server may send "Vary: Origin", and module scripts send an Origin header
      // that the install-time requests didn't, which would otherwise make every lookup miss.
      const cached = await caches.match(req, { ignoreVary: true })
      if (cached) return cached
      const res = await fetch(req)
      if (res.ok && RUNTIME_PATHS.some((p) => url.pathname.startsWith(p))) {
        const cache = await caches.open(RUNTIME_CACHE)
        cache.put(req, res.clone()).catch(() => {})
      }
      return res
    })(),
  )
})
