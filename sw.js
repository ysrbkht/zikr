// sw.js - Service Worker برای کش کردن کامل اپلیکیشن اذکار

const APP_CACHE_NAME = 'azkar-static-v1';
const AUDIO_CACHE_NAME = 'azkar-audio-v1';

// لیست فایل‌های استاتیک برای کش اولیه
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  '/zikr/icon.png',
  '/zikr/icon.ico',
  '/zikr/fonts/UthmanTahaNaskhBold.ttf',
  '/zikr/fonts/lotus-Bold.ttf',
  '/zikr/fonts/Compset-Bold.ttf'
];

// فایل‌های خارجی (با حذف فاصله‌های اضافی)
const EXTERNAL_ASSETS = [
  'https://raw.githubusercontent.com/ysrbkht/zikr/main/azkar.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700;800&family=Amiri:wght@400;700&display=swap'
];

// ===== نصب: کش کردن فایل‌های استاتیک =====
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE_NAME).then(cache => {
      // کش کردن فایل‌های داخلی
      const internalCache = Promise.allSettled(
        STATIC_ASSETS.map(url => 
          cache.add(url).catch(err => console.log('❌ Failed to cache internal:', url, err))
        )
      );
      
      // کش کردن فایل‌های خارجی
      const externalCache = Promise.allSettled(
        EXTERNAL_ASSETS.map(url => 
          cache.add(url).catch(err => console.log('❌ Failed to cache external:', url, err))
        )
      );
      
      return Promise.all([internalCache, externalCache]);
    })
  );
});

// ===== فعال‌سازی: پاک کردن کش‌های قدیمی =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // حذف کش‌های قدیمی اپلیکیشن (غیر از نسخه فعلی و کش صوتی)
          if (cacheName.startsWith('azkar-') && 
              cacheName !== APP_CACHE_NAME && 
              cacheName !== AUDIO_CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Claim clients برای فعال‌سازی فوری
      return self.clients.claim();
    })
  );
});

// ===== درخواست‌ها: استراتژی Cache First با fallback به Network =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;

  // 🔊 فایل‌های صوتی: کش اختصاصی با پشتیبانی از Range requests
  if (url.includes('morning.mp3') || url.includes('evening.mp3')) {
    event.respondWith(
      caches.open(AUDIO_CACHE_NAME).then(async cache => {
        // برای درخواست‌های Range (جستجو در فایل صوتی)
        if (request.headers.get('Range')) {
          return fetch(request);
        }
        
        // تلاش برای دریافت از کش
        const cached = await cache.match(request);
        if (cached) {
          console.log('🎵 Serving audio from cache:', url);
          return cached;
        }
        
        // دریافت از شبکه و کش کردن
        console.log('🌐 Fetching audio from network:', url);
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // 📦 فایل‌های استاتیک: Cache First با به‌روزرسانی در پس‌زمینه
  if (url.includes('fonts') || 
      url.includes('icon') || 
      url.includes('azkar.json') || 
      url.includes('css') || 
      url.includes('manifest.json') || 
      url.endsWith('.html') ||
      url.includes('fontawesome')) {
    
    event.respondWith(
      caches.open(APP_CACHE_NAME).then(async cache => {
        const cached = await cache.match(request);
        
        if (cached) {
          // به‌روزرسانی در پس‌زمینه (Stale-While-Revalidate)
          fetch(request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
          }).catch(() => {});
          return cached;
        }
        
        // اگر در کش نبود، از شبکه بگیر و کش کن
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      })
    );
    return;
  }

  // 🌐 سایر درخواست‌ها: Network First با fallback به کش
  event.respondWith(
    fetch(request).catch(async () => {
      // اگر آفلاین بود، تلاش کن از کش بگیر
      const cached = await caches.match(request);
      if (cached) return cached;
      
      // برای ناوبری‌ها، صفحه اصلی را نشان بده
      if (request.mode === 'navigate') {
        return caches.match('./index.html');
      }
      
      return new Response('آفلاین هستید', { 
        status: 408, 
        headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
      });
    })
  );
});

// ===== پیام‌ها: مدیریت دانلود دستی فایل‌های صوتی =====
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_AUDIO') {
    event.waitUntil(
      caches.open(AUDIO_CACHE_NAME).then(cache => {
        return Promise.allSettled(
          event.data.urls.map(url => 
            fetch(url).then(response => {
              if (response.ok) {
                return cache.put(url, response);
              }
            }).catch(err => console.log('Audio cache failed:', url, err))
          )
        );
      }).then(() => {
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'AUDIO_CACHE_COMPLETE' });
          });
        });
      })
    );
  }
});
