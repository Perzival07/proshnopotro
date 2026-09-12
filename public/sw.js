/*
 * Service worker for the installed app.
 *
 * Deliberately does almost nothing. Every page here is personal and live --
 * a student's tests, a running exam clock, a one-time upload -- so none of it
 * is ever served from a cache. The one job is a friendly offline page when a
 * page cannot be reached at all, instead of the browser's own error screen.
 *
 * Bump VERSION whenever offline.html or the icons change.
 */
const VERSION = "v1";
const CACHE = `koustav-offline-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith("koustav-offline-") && key !== CACHE).map((key) => caches.delete(key))
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Page loads only. Server actions, uploads, sign-in and every asset go
  // straight to the network untouched.
  if (request.mode !== "navigate" || request.method !== "GET") return;

  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }
    })()
  );
});
