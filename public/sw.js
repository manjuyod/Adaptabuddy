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

self.addEventListener("push", (event) => {
  const fallback = {
    title: "Adaptabuddy",
    body: "Training reminder",
    url: "/train"
  };

  let payload = fallback;
  try {
    payload = event.data ? { ...fallback, ...(event.data.json() ?? {}) } : fallback;
  } catch {
    // no-op
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url ?? "/train" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification?.data && event.notification.data.url) || "/train";
  event.waitUntil(self.clients.openWindow(targetUrl));
});
