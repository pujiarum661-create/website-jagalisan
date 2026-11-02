const CACHE_NAME = "jaga-lisan-offline-v1";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./materi.html",
  "./dalil.html",
  "./permasalahan.html",
  "./penyelesaian.html",
  "./kesimpulan.html",
  "./kuis.html",
  "./style.css",
  "./script.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        FILES_TO_CACHE.map((file) => cache.add(file))
      );
      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith("jaga-lisan-offline-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
