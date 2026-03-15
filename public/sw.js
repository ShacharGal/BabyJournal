/* Service worker — handles Web Push notifications + Web Share Target */

// ── IndexedDB helpers for Share Target ──

const _DB_NAME = "babyjournal-share";
const _STORE_NAME = "pending-files";
const _RECORD_KEY = "shared";

function _openShareDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(_STORE_NAME);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function _saveSharedFiles(files) {
  const db = await _openShareDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_STORE_NAME, "readwrite");
    tx.objectStore(_STORE_NAME).put(files, _RECORD_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = (e) => { db.close(); reject(e.target.error); };
  });
}

// ── Share Target: intercept POST /share-target ──

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const files = formData.getAll("media").filter((f) => f instanceof File);
          console.log("[ShareTarget] Received", files.length, "file(s)");
          if (files.length > 0) {
            await _saveSharedFiles(files);
          }
        } catch (err) {
          console.error("[ShareTarget] Failed to process share:", err);
        }
        return Response.redirect("/share-target", 303);
      })()
    );
  }
});

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
