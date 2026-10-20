const CACHE_NAME = "escoltas-coahuila-v6";
const APP_FILES = ["./", "./index.html", "./manifest.json", "./icon.svg"];
const EXTERNAL_FILES = [
  "https://cdn.tailwindcss.com/3.4.17",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
];
const TRUSTED_EXTERNAL_HOSTS = new Set(["cdn.tailwindcss.com", "fonts.googleapis.com", "fonts.gstatic.com"]);

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES);
    await Promise.all(EXTERNAL_FILES.map(async url => {
      try {
        const response = await fetch(new Request(url, { mode: "no-cors" }));
        if (response.ok || response.type === "opaque") await cache.put(url, response);
      } catch (_) {
        // The local guide still installs if an optional CDN is unavailable.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("escoltas-coahuila-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    if (!TRUSTED_EXTERNAL_HOSTS.has(url.hostname)) return;
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request) || await cache.match(url.href);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
        return response;
      } catch (_) {
        return new Response("Recurso no disponible sin conexión", { status: 503, statusText: "Offline" });
      }
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        await cache.put("./index.html", response.clone());
        return response;
      } catch (_) {
        return (await caches.match("./index.html")) || (await caches.match("./"));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
