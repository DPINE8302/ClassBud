// sw.js - Service Worker for ClassBuddy v1.5

const CACHE_NAME = 'classbuddy-cache-v1.5';
const URLS_TO_CACHE = [
  '/',
  'index.html',
  'manifest.json',
  'icon.svg',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;700&display=swap',
];

// Install event: open cache and add all core files to it.
// This version is more robust, as it caches assets individually
// and won't fail the entire installation if one asset (like an optional icon) is missing.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching assets individually.');
      const promises = URLS_TO_CACHE.map(url => {
        return cache.add(url).catch(err => {
          // Log the error, but don't let it stop the SW installation.
          console.warn(`SW: Failed to cache '${url}'. The app will still work offline, but this asset might be unavailable.`, err);
        });
      });
      return Promise.all(promises);
    })
  );
});

// Activate event: remove old, unused caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event: serve from cache if available, otherwise fetch from network (Cache-first strategy)
self.addEventListener('fetch', event => {
  // We only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // If the resource is in the cache, return it
        if (cachedResponse) {
          return cachedResponse;
        }

        // If the resource is not in the cache, fetch it from the network
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response.
            // A response that is not "ok" (e.g., 404) or an opaque response (for cross-origin requests) should still be passed through.
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Clone the response because it's a one-time-use stream
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // Add the new resource to the cache for next time
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
            console.error('Service Worker: Fetch failed. This is expected if offline and the resource is not cached.', error);
            // This will result in a browser error page, which is acceptable for non-cached assets when offline.
        });
      })
  );
});
