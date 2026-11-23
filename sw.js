/* Поршик · сервис-воркер: игра работает и без сети.
   Стратегия: сначала сеть, при неудаче — кэш. Версия кэша
   поднимается вручную при изменении файлов. */

const VERSION = 'porshik-v2';
const ASSETS = [
  './',
  './index.html',
  './play.html',
  './love.html',
  './404.html',
  './assets/css/base.css',
  './assets/css/site.css',
  './assets/css/game.css',
  './assets/js/content.js',
  './assets/js/rules.js',
  './assets/js/sim.js',
  './assets/js/render.js',
  './assets/js/audio.js',
  './assets/js/themes.js',
  './assets/js/game.js',
  './assets/js/site.js',
  './assets/js/love.js',
  './assets/fonts/nunito-cyrillic-wght-normal.woff2',
  './assets/fonts/nunito-latin-wght-normal.woff2',
  './assets/fonts/caveat-cyrillic-wght-normal.woff2',
  './assets/fonts/caveat-latin-wght-normal.woff2',
  './assets/img/favicon.svg',
  './assets/img/icon-192.png',
  './assets/img/hero.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && url.pathname.match(/\.(?:css|js|woff2|png|jpg|svg|webmanifest|html)$/)) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
  );
});
