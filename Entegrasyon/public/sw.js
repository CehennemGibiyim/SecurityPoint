/*
 * SecurityPoint — service worker (PWA).
 *
 * Tasarım kuralları:
 *  - API istekleri (`/api/...`) HİÇBİR ZAMAN önbelleğe alınmaz; veri her zaman ağdan gelir.
 *  - Sayfa gezinmeleri ağ-öncelikli; ağ yoksa çevrimdışı sayfası gösterilir.
 *  - `/_next/static/` gibi içerik hashli varlıklar önbellek-öncelikli (hızlı açılış).
 *  - Alt dizin (GitHub Pages) yayınında kapsam `registration.scope`'tan türetilir.
 *  - Kayıt yalnızca üretim derlemesinde yapılır (geliştirme/HMR etkilenmez).
 */
const CACHE = "securitypoint-v1";

const scopePath = new URL(self.registration.scope).pathname;
const base = scopePath.endsWith("/") ? scopePath.slice(0, -1) : scopePath;

const OFFLINE_URL = `${base}/offline.html`;
const PRECACHE = [
  OFFLINE_URL,
  `${base}/brand/pwa-192.png`,
  `${base}/brand/pwa-512.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Tek bir varlık indirilemezse kurulum yine de tamamlanır.
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") void self.skipWaiting();
});

function isCacheableAsset(pathname) {
  return (
    pathname.includes("/_next/static/") ||
    /\.(?:css|js|mjs|png|jpe?g|gif|svg|ico|webp|woff2?|bin|wasm)$/i.test(pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(`${base}/api/`) || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match(OFFLINE_URL);
          return cached ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (isCacheableAsset(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok && response.type === "basic") {
            const cache = await caches.open(CACHE);
            void cache.put(request, response.clone());
          }
          return response;
        } catch {
          return (await caches.match(request)) ?? Response.error();
        }
      })(),
    );
  }
});
