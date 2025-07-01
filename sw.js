
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

// Install event: open cache and add all core files to it
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching core assets');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(error => {
        console.error('Service Worker: Failed to cache files during install:', error);
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

// Fetch event: serve from cache if available, otherwise fetch from network
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
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Clone the response because it's a one-time-use stream
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // Add the new resource to the cache
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
            console.error('Service Worker: Fetch failed. This may happen if offline and the resource is not cached.', error);
            // Optionally, you could return a fallback page here for failed navigations
        });
      })
  );
});
