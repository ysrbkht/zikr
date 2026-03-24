const APP_CACHE_NAME = 'azkar-static-v1';

// فقط فایل‌های ضروری و ایستا (بدون فایل صوتی)
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://raw.githubusercontent.com/ysrbkht/zikr/main/azkar.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap',
  '/zikr/icon.png',
  '/zikr/icon.ico',
  '/zikr/fonts/UthmanTahaNaskhBold.ttf',
  '/zikr/fonts/lotus-Bold.ttf',
  '/zikr/fonts/Compset-Bold.ttf'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE_NAME).then(cache => 
      Promise.allSettled(
        urlsToCache.map(url => 
          cache.add(url).catch(err => console.log('Failed to cache', url, err))
        )
      )
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== APP_CACHE_NAME && cacheName.startsWith('azkar-')) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // استراتژی Cache First برای فایل‌های ایستا
  if (url.includes('fonts') || url.includes('icon') || url.includes('azkar.json') || url.includes('css') || url.includes('manifest.json') || url.endsWith('.html')) {
    event.respondWith(
      caches.open(APP_CACHE_NAME).then(cache => 
        cache.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            // در پس‌زمینه آپدیت کن
            fetch(event.request).then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
            }).catch(() => {});
            return cachedResponse;
          }
          return fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        })
      )
    );
  } else {
    // برای فایل‌های صوتی و غیره، فقط از شبکه (بدون کش)
    event.respondWith(fetch(event.request).catch(() => {
      // اگر ناوبری بود و قطع اینترنت، index.html را از کش برگردان
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
      return new Response('Network error', { status: 408 });
    }));
  }
});
