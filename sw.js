// sw.js - Service Worker بهینه‌شده برای کش مطمئن

const APP_CACHE_NAME = 'azkar-static-v1';
const AUDIO_CACHE_NAME = 'azkar-audio-v1';

// ✅ لیست فایل‌ها با URLهای تمیز (بدون فاصله)
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

const EXTERNAL_ASSETS = [
  'https://raw.githubusercontent.com/ysrbkht/zikr/main/azkar.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700;800&family=Amiri:wght@400;700&display=swap'
];

// ===== نصب =====
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE_NAME).then(cache => {
      console.log('📦 Caching static assets...');
      // کش کردن فایل‌های داخلی با مدیریت خطا
      const internal = Promise.allSettled(
        STATIC_ASSETS.map(url => 
          cache.add(url).catch(err => console.log('⚠️ Failed to cache internal:', url, err.message))
        )
      );
      // کش کردن فایل‌های خارجی
      const external = Promise.allSettled(
        EXTERNAL_ASSETS.map(url => 
          cache.add(url).catch(err => console.log('⚠️ Failed to cache external:', url, err.message))
        )
      );
      return Promise.all([internal, external]);
    }).then(() => console.log('✅ Caching complete'))
  );
});

// ===== فعال‌سازی =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName.startsWith('azkar-') && 
              cacheName !== APP_CACHE_NAME && 
              cacheName !== AUDIO_CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ===== درخواست‌ها (Fetch) =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;

  // 🔊 فایل‌های صوتی: کش اختصاصی
  if (url.includes('morning.mp3') || url.includes('evening.mp3')) {
    event.respondWith(
      caches.open(AUDIO_CACHE_NAME).then(async cache => {
        // پشتیبانی از Range requests برای پلیر
        if (request.headers.get('Range')) {
          return fetch(request);
        }
        const cached = await cache.match(request);
        if (cached) {
          console.log('🎵 Audio from cache:', url);
          return cached;
        }
        console.log('🌐 Audio from network:', url);
        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.put(request, response.clone());
          }
          return response;
        } catch (e) {
          console.error('Audio fetch error:', e);
          return new Response('Audio not available offline', { status: 408 });
        }
      })
    );
    return;
  }

  // 📦 فایل‌های استاتیک: Cache First با به‌روزرسانی پس‌زمینه
  if (url.includes('fonts') || url.includes('icon') || 
      url.includes('azkar.json') || url.includes('css') || 
      url.includes('manifest.json') || url.endsWith('.html') ||
      url.includes('fontawesome')) {
    
    event.respondWith(
      caches.open(APP_CACHE_NAME).then(async cache => {
        const cached = await cache.match(request);
        
        if (cached) {
          // به‌روزرسانی نامحسوس در پس‌زمینه
          fetch(request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
          }).catch(() => {});
          return cached;
        }
        
        // اگر در کش نبود، از شبکه بگیر
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (e) {
          console.log('⚠️ Network fetch failed, no cache available');
          return new Response('آفلاین هستید', { 
            status: 408, 
            headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
          });
        }
      })
    );
    return;
  }

  // 🌐 سایر درخواست‌ها: Network First
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return caches.match('./index.html');
      }
      return new Response('Network error', { status: 408 });
    })
  );
});
