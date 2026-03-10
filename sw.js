const CACHE_NAME = 'azkar-cache-v2';
const urlsToCache = [
  'index.html',
  'https://raw.githubusercontent.com/YBakhtiar/zikr/main/azkar.json',
  'https://raw.githubusercontent.com/YBakhtiar/zikr/main/icon.png',
  'https://raw.githubusercontent.com/YBakhtiar/zikr/main/icon.ico',
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
