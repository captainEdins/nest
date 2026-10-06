/*
 * NEST service worker — DECISION D-017 (Phase 4, issue #49).
 *
 * A conservative, honest offline shell:
 *   - install   → precache the app-shell basics (entry HTML, manifest, logos,
 *                 the icons the manifest lists);
 *   - fetch     → network-first for navigations and same-origin GETs (fresh
 *                 data always wins; the cache is only an offline fallback),
 *                 cache-first ONLY for the precached static shell assets;
 *   - never     → cache POSTs or /api/* — money data must never go stale
 *                 (the offline banner + payment outbox already own offline
 *                 UX; this worker never fights them);
 *   - activate  → delete every cache that is not the current version.
 *
 * Vanilla, dependency-free. Registered only in production builds
 * (src/components/nest/providers.tsx) — never in dev, where Turbopack HMR
 * and a caching worker would serve stale chunks and break the dev loop.
 */

/** Bump to invalidate every previous shell cache. */
const CACHE_VERSION = "v1";
const CACHE_NAME = `nest-static-${CACHE_VERSION}`;

/**
 * The precached app shell. Pathnames only (same origin). The icon files are
 * exactly what manifest.webmanifest + layout metadata reference.
 */
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/nest-logo.svg",
  "/logo.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  // Clean old caches (any name that is not the current version), then take
  // control of open clients so the new worker applies immediately.
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Cache-first — ONLY for the precached shell assets (logos, icons, manifest). */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

/**
 * Network-first — try the network (fresh wins); on failure fall back to the
 * last-seen same-origin copy (offline shell). Successful responses are
 * stored so the offline fallback improves over a session. /api/* never
 * reaches here (see the fetch listener guard).
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (offline) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw offline; // nothing cached and offline — surface the failure
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never touch mutations or cross-origin traffic — pass straight through.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Money/data endpoints are NEVER intercepted or cached — offline UX is
  // owned by the offline banner + outbox, and stale balances are worse
  // than no balance.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations (the SPA shell is the single "/" route): network-first —
  // a fresh shell always wins; the precached copy is the offline fallback.
  if (request.mode === "navigate" || url.pathname === "/") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Precached static shell assets (manifest, logos, icons): cache-first.
  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Every other same-origin GET (chunks, images, fonts): network-first.
  event.respondWith(networkFirst(request));
});
