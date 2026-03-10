const CACHE_NAME = 'azkar-cache-v7';
const urlsToCache = [
  '/zikr/',
  '/zikr/index.html',
  '/zikr/manifest.json',
  '/zikr/icon.png',
  '/zikr/icon.ico',
  'https://raw.githubusercontent.com/ysrbkht/zikr/main/azkar.json',
  'https://raw.githubusercontent.com/ysrbkht/zikr/main/morning.mp3',
  'https://raw.githubusercontent.com/ysrbkht/zikr/main/evening.mp3',
  '/zikr/fonts/Compset-Bold.ttf',
  '/zikr/fonts/TraditionalArabicBold.ttf',
  '/zikr/fonts/UthmanTahaNaskhBold.ttf',
  '/zikr/fonts/lotus-Bold.ttf',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});
