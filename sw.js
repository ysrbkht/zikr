const APP_CACHE_NAME = 'azkar-app-v1';
const AUDIO_CACHE_NAME = 'azkar-audio-v1';

// فایل‌های ضروری برای اجرای آفلاین
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

// فایل‌های صوتی (در کش جداگانه برای مدیریت بهتر)
const audioUrls = [
  'https://raw.githubusercontent.com/ysrbkht/zikr/main/morning.mp3',
  'https://raw.githubusercontent.com/ysrbkht/zikr/main/evening.mp3'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    Promise.allSettled([
      // کش کردن فایل‌های اصلی
      caches.open(APP_CACHE_NAME).then(cache => 
        Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => console.log('Failed to cache', url, err))
          )
        )
      ),
      // کش کردن فایل‌های صوتی در کش جداگانه
      caches.open(AUDIO_CACHE_NAME).then(cache => 
        Promise.allSettled(
          audioUrls.map(url => 
            cache.add(url).catch(err => console.log('Failed to cache audio', url, err))
          )
        )
      )
    ])
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // حذف کش‌های قدیمی
          if ((cacheName.startsWith('azkar-app-') && cacheName !== APP_CACHE_NAME) ||
              (cacheName.startsWith('azkar-audio-') && cacheName !== AUDIO_CACHE_NAME)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // استراتژی برای فایل‌های صوتی: Cache First
  if (url.includes('morning.mp3') || url.includes('evening.mp3')) {
    event.respondWith(
      caches.open(AUDIO_CACHE_NAME).then(cache => 
        cache.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            // اگر در کش بود، همان را برگردان و در پس‌زمینه آپدیت کن
            fetch(event.request).then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
            }).catch(() => {});
            return cachedResponse;
          }
          // اگر در کش نبود، از شبکه بگیر و کش کن
          return fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        })
      )
    );
  }
  // برای فونت‌ها و فایل‌های استاتیک: Cache First (مشابه بالا)
  else if (url.includes('fonts') || url.includes('icon') || url.includes('azkar.json') || url.includes('css')) {
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
  }
  // برای ناوبری و سایر درخواست‌ها: Stale-While-Revalidate
  else {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              caches.open(APP_CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
            }
          }).catch(() => {});
          return cachedResponse;
        }
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(APP_CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        }).catch(async () => {
          // اگر شبکه قطع بود و درخواست ناوبری بود، index.html را برگردان
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
  }
});
