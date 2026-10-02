const CACHE_NAME = 'trading-journal-v18';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/palette.css',
  './css/style.css',
  './js/icons.js',
  './js/db.js',
  './js/options.js',
  './js/calc.js',
  './js/app.js',
  './js/ui.js',
  './js/charts.js',
  './js/seed.js',
  './js/privacy.js',
  './js/onboarding.js',
  './js/importer.js',
  './fonts/fonts.css',
  './fonts/inter-latin.woff2',
  './fonts/inter-latin-ext.woff2',
  './js/fx.js',
  './js/habits.js',
  './js/routine.js',
  './js/journal.js',
  './js/propaccounts.js',
  './js/analysis.js',
  './js/collections.js',
  './js/tools.js',
  './js/stats.js',
  './js/home.js',
  './js/settings.js',
  './js/config.js',
  './js/sync.js',
  './js/shortcuts.js',
  './js/haptics.js',
  './js/swipe.js',
  './js/art.js',
  './js/dictate.js',
  './icons/logo-dark.svg',
  './icons/logo-light.svg',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Neue Version wartet, bis die App sie ueber die "Neue Version"-Leiste freigibt (kein Reload mitten im Tippen)
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: sofort aus dem Cache, im Hintergrund aktualisieren
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((res) => {
        if (res && res.status === 200 && new URL(event.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
