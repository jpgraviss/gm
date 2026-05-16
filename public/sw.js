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
