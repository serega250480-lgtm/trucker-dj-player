const CACHE_NAME = 'road-dj-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      let cachedCount = 0;
      const total = ASSETS.length;
      
      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('Failed to cache asset:', asset, err);
        } finally {
          cachedCount++;
          const percentage = Math.round((cachedCount / total) * 100);
          
          // Notify client pages of progress
          const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
          for (const client of clientsList) {
            client.postMessage({
              type: 'PWA_CACHE_PROGRESS',
              percentage
            });
          }
        }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Pass-through network requests for API endpoints and uploads
  if (e.request.url.includes('/api/') || e.request.url.includes('/uploads/')) {
    return;
  }
  
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});
