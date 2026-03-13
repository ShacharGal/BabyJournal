/* Service worker — handles Web Push notifications only */

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  console.log("[SW] Push received:", data);
  event.waitUntil(
    self.registration.showNotification(data.title || "BabyJournal", {
      body: data.body || "New memory added!",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked");
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return clients.openWindow(event.notification.data?.url || "/");
    })
  );
});
