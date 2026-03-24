const APP_CACHE_NAME = 'azkar-static-v1';
const AUDIO_CACHE_NAME = 'azkar-audio-v1';

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
          if ((cacheName.startsWith('azkar-') && cacheName !== APP_CACHE_NAME && cacheName !== AUDIO_CACHE_NAME)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // اگر درخواست فایل صوتی باشد، ابتدا از کش صوتی بررسی کن
  if (url.includes('morning.mp3') || url.includes('evening.mp3')) {
    event.respondWith(
      caches.open(AUDIO_CACHE_NAME).then(cache => 
        cache.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then(networkResponse => {
            // اما ما بعد از دانلود دستی آن را در کش قرار می‌دهیم، نه خودکار
            return networkResponse;
          });
        })
      )
    );
  }
  // برای فایل‌های ایستا (فونت، آیکون، json، css، manifest، html)
  else if (url.includes('fonts') || url.includes('icon') || url.includes('azkar.json') || url.includes('css') || url.includes('manifest.json') || url.endsWith('.html')) {
    event.respondWith(
      caches.open(APP_CACHE_NAME).then(cache => 
        cache.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
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
    event.respondWith(fetch(event.request).catch(() => {
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
      return new Response('Network error', { status: 408 });
    }));
  }
});
