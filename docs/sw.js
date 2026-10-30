/* Rakz — service worker: shows phone notifications sent by the «push» function and opens the right page on tap. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "ركز", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", dir: "rtl", lang: "ar",
    tag: d.tag, renotify: !!d.tag, data: { url: d.url || "/" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin);
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === url.origin) { await w.focus(); w.postMessage({ rakzGo: url.hash.slice(1) || "dashboard" }); return; }
    }
    await self.clients.openWindow(url.href);
  })());
});
