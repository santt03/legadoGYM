const SHELL_CACHE = 'legado-shell-v4'
const DATA_CACHE = 'legado-student-data-v4'
const SHELL = ['/alumno', '/', '/manifest.webmanifest', '/favicon.svg']

self.addEventListener('install', (event) => event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())))
self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith('legado-') && key !== SHELL_CACHE && key !== DATA_CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim())
))
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/student/')) {
    event.respondWith(fetch(request).then((response) => { if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(DATA_CACHE).then((cache) => cache.put(request, copy))) } return response }).catch(() => caches.match(request).then((cached) => cached || new Response(JSON.stringify({ error: 'Sin conexión y sin datos guardados' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))))
    return
  }
  if (request.mode === 'navigate' || url.pathname.startsWith('/assets/')) event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { const copy = response.clone(); caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)); return response })))
})
self.addEventListener('message', (event) => { if (event.data?.type === 'CLEAR_STUDENT_CACHE') event.waitUntil(caches.delete(DATA_CACHE)) })
self.addEventListener('push', (event) => { const data = event.data?.json() || {}; event.waitUntil(self.registration.showNotification(data.title || 'Legado Gym', { body: data.body || 'Tenés una novedad en tu espacio.', icon: '/favicon.svg', badge: '/favicon.svg', data: { url: data.url || '/alumno' } })) })
self.addEventListener('notificationclick', (event) => { event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data?.url || '/alumno')) })
