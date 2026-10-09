// Minimal service worker: makes the app installable and keeps brand/placeholder images available offline.
// Pages are always network-first (marketplace data must be fresh); we only cache static brand assets.
const CACHE = "mph-static-v2";
const PRECACHE = ["/brand/logo-wordmark.webp", "/brand/logo-mark.webp", "/seed/placeholder.svg", "/offline.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }
  if (url.pathname.startsWith("/brand/") || url.pathname.startsWith("/seed/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
