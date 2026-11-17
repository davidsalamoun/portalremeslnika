/**
 * Zdroj service workeru (běží v prohlížeči mimo stránku). `vite.config.ts` ho při buildu doplní o seznam všech
 * souborů aplikace a verzi a uloží jako `dist/sw.js`. Aplikace se tak po prvním načtení otevře i bez signálu.
 *
 * - Soubory aplikace (skripty, styly, ikony) se uloží při instalaci a čtou se z mezipaměti.
 * - Stránka (index.html) se bere ze sítě, a když síť do 3 s neodpoví, z mezipaměti.
 * - Data (Supabase, /api) jdou vždy přímo na síť – service worker je neukládá.
 */
export function serviceWorkerSource(version: string, files: string[]): string {
  return `// Vygenerováno při buildu (vite.config.ts, src/sw/serviceWorkerSource.ts) – neupravovat ručně.
const VERSION = ${JSON.stringify(version)};
const FILES = ${JSON.stringify(files)};
const APP_CACHE = 'remeslnik-app-' + VERSION;
const PAGE = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(FILES.map((f) => '/' + f))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('remeslnik-app-') && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function pageFromNetwork(request) {
  return fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(APP_CACHE).then((cache) => cache.put(PAGE, copy));
    }
    return response;
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    if (request.mode === 'navigate') {
      // Síť má přednost (nová verze aplikace), při slabém nebo žádném signálu stránka z mezipaměti
      event.respondWith(
        new Promise((resolve) => {
          let settled = false;
          const fromCache = () =>
            caches.match(PAGE).then((cached) => {
              if (!settled && cached) {
                settled = true;
                resolve(cached);
              }
              return cached;
            });
          const timer = setTimeout(fromCache, 3000);
          pageFromNetwork(request)
            .then((response) => {
              clearTimeout(timer);
              if (!settled) {
                settled = true;
                resolve(response);
              }
            })
            .catch(() => {
              clearTimeout(timer);
              fromCache().then((cached) => {
                if (!settled) {
                  settled = true;
                  resolve(cached || Response.error());
                }
              });
            });
        })
      );
      return;
    }
    event.respondWith(caches.match(request, { ignoreSearch: true }).then((cached) => cached || fetch(request)));
    return;
  }


});
`;
}
