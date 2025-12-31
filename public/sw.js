self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Placeholder for offline caching and sync queue wiring.
self.addEventListener("fetch", () => {
  // Add offline strategy here later.
});
