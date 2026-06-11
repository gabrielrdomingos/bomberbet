// sw.js — BomberBET Service Worker
const CACHE = 'bomberbet-v1'

// arquivos estáticos a cachear na instalação
const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo_192.png',
  '/logo_512.png',
  'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
]

// ── install: cacheia arquivos estáticos ───────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC))
  )
  self.skipWaiting()
})

// ── activate: limpa caches antigos ───────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── fetch: network-first para API, cache-first para estáticos ─
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // requisições ao Supabase e CDNs sempre vão à rede
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('esm.sh') ||
    url.hostname.includes('flagcdn.com') ||
    url.hostname.includes('fonts.g') ||
    e.request.method !== 'GET'
  ) {
    return // deixa o browser lidar normalmente
  }

  // para arquivos locais: cache-first com fallback à rede
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        // cacheia a resposta para uso futuro
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(cache => cache.put(e.request, clone))
        }
        return res
      }).catch(() => {
        // offline e não cacheado: retorna index.html como fallback
        if (e.request.destination === 'document') {
          return caches.match('/index.html')
        }
      })
    })
  )
})
