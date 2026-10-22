const CACHE_NAME = "story-imoveis-pwa-v25";
const APP_SHELL = [
  "/",
  "/Style.css",
  "/script.js?v=2",
  "/extras.js?v=1",
  "/story-set.js?v=2",
  "/templates.js?v=1",
  "/workflow.js?v=1",
  "/export-formats.js?v=2",
  "/properties.js?v=1",
  "/logo-library.js?v=1",
  "/cloud-profiles.js?v=1",
  "/auth.js?v=2",
  "/autofill.js?v=5",
  "/brand-theme.js?v=4",
  "/mobile-wizard.js?v=9",
  "/realty-profile.js?v=3",
  "/org-design.js?v=1",
  "/professional-ui.js?v=13",
  "/manifest.webmanifest?v=3",
  "/pwa-icon-pro-192.png",
  "/pwa-icon-pro-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/analisar-imovel") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
