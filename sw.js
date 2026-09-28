// Service Worker: オフライン起動用のキャッシュ。
// 更新するときは VERSION を上げる（js/version.js と合わせる）。古いキャッシュは activate で消える。
const VERSION = '1.0.1';
const CACHE = `people-app-${VERSION}`;
const FONT_CACHE = 'people-fonts';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/version.js',
  'js/nav.js',
  'js/store.js',
  'js/text.js',
  'js/ui.js',
  'js/prefectures.js',
  'js/views/home.js',
  'js/views/place.js',
  'js/views/placeEdit.js',
  'js/views/person.js',
  'js/views/search.js',
  'js/views/settings.js',
  'js/views/import.js',
  'vendor/Sortable.min.js',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' で HTTP キャッシュを通さず最新を取る（GitHub Pages は max-age=600）
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('people-app-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: 手元にあればすぐ返し、裏で更新
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    })
  );
});
