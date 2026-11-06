const APP_CACHE_NAME = 'azkar-static-v3';
const AUDIO_CACHE_NAME = 'azkar-audio-v1';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './azkar.json',
  './icon.png',
  './icon.ico',
  './fonts/UthmanTahaNaskhBold.ttf',
  './fonts/lotus-Bold.ttf',
  './fonts/Compset-Bold.ttf',
  './fonts/Vazirmatn-Regular.ttf',
  './fonts/Vazirmatn-Medium.ttf',
  './fonts/Vazirmatn-Bold.ttf'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE_NAME).then(cache =>
      Promise.allSettled(urlsToCache.map(url => cache.add(url)))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.map(name => {
        if (name.startsWith('azkar-') && name !== APP_CACHE_NAME && name !== AUDIO_CACHE_NAME) {
          return caches.delete(name);
        }
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Audio: the app downloads these into the audio cache itself and plays them from there.
  // Here we only answer a download request from the network (or from the cache if present).
  if (/\/(morning|evening)\.mp3$/.test(url.pathname)) {
    event.respondWith(
      caches.open(AUDIO_CACHE_NAME).then(cache =>
        cache.match(req.url).then(hit => hit || fetch(req))
      )
    );
    return;
  }

  // App files (html, data, fonts, icons): cache first, refresh in the background
  if (url.origin === location.origin) {
    event.respondWith(
      caches.open(APP_CACHE_NAME).then(cache =>
        cache.match(req, { ignoreSearch: true }).then(hit => {
          const network = fetch(req).then(res => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          }).catch(() => hit || (req.mode === 'navigate' ? cache.match('./index.html') : new Response('Offline', { status: 503 })));
          return hit || network;
        })
      )
    );
    return;
  }

  // anything else: network, with an offline fallback for navigation
  event.respondWith(
    fetch(req).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : new Response('Network error', { status: 408 }))
  );
});
