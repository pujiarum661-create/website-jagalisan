const CACHE_NAME = 'jaga-lisan-offline-v1';
const FILES = [
  './', './index.html', './materi.html', './dalil.html', './permasalahan.html',
  './penyelesaian.html', './kesimpulan.html', './kuis.html', './style.css',
  './script.js', './assets/images/logo.svg', './assets/images/hero.svg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      throw error;
    }
  })());
});
