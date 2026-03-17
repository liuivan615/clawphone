const CACHE_NAME = "clawphone-v1";
const STATIC_ASSETS = ["/", "/manifest.json", "/icons/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip API and WebSocket requests
  if (
    request.url.includes("/api/") ||
    request.url.includes("/ws") ||
    request.method !== "GET"
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match("/")))
      .then((r) => r || new Response("Offline", { status: 503 }))
  );
});
