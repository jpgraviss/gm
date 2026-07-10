var CACHE_NAME = 'gravhub-v2'
// /favicon.ico is NOT served (Next.js App Router serves the favicon via
// app/icon.png through its own generated route) — cache.addAll() fails
// atomically if any entry 404s, which was silently breaking install/activate
// entirely. Bumped the cache name so existing installs pick up the fix.
var STATIC_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
]

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS)
    }).then(function () {
      return self.skipWaiting()
    })
  )
})

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME })
          .map(function (n) { return caches.delete(n) })
      )
    }).then(function () {
      return self.clients.claim()
    })
  )
})

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url)

  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // API requests: network-first with 3s timeout, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      Promise.race([
        fetch(event.request).then(function (response) {
          if (response.ok) {
            var clone = response.clone()
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, clone)
            })
          }
          return response
        }),
        new Promise(function (_, reject) {
          setTimeout(function () { reject(new Error('timeout')) }, 3000)
        })
      ]).catch(function () {
        return caches.match(event.request)
      })
    )
    return
  }

  // Static assets & pages: cache-first, network fallback
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) return cached
        return fetch(event.request).then(function (response) {
          if (response.ok) {
            var clone = response.clone()
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, clone)
            })
          }
          return response
        })
      })
    )
    return
  }

  // HTML navigation: network-first, cache fallback
  if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request).then(function (response) {
        if (response.ok) {
          var clone = response.clone()
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone)
          })
        }
        return response
      }).catch(function () {
        return caches.match(event.request)
      })
    )
    return
  }
})

// Push notifications (existing functionality)
self.addEventListener('push', function (event) {
  var data = { title: 'GravHub', body: 'You have a new notification', url: '/' }
  if (event.data) {
    try { data = Object.assign(data, event.data.json()) } catch (e) { /* use defaults */ }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        if (windowClients[i].url.includes(url) && 'focus' in windowClients[i]) {
          return windowClients[i].focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
