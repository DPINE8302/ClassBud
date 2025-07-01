// sw.js - Service Worker for ClassBuddy v1.5.1

const CACHE_NAME = 'classbuddy-cache-v1.5.1';
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

// Fetch event: Serve from cache if available, otherwise fetch from network (Cache-first strategy)
self.addEventListener('fetch', event => {
  // We only handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // If we have a cached response, return it.
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not, fetch from the network.
      return fetch(event.request).then(networkResponse => {
        // Clone the response because it's a one-time-use stream.
        const responseToCache = networkResponse.clone();

        // Check if the response is valid to be cached.
        // We'll cache successful responses (status 200-299) and opaque responses (from CDNs).
        if (networkResponse.ok || networkResponse.type === 'opaque') {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        
        // Return the original network response to the browser.
        return networkResponse;
      }).catch(error => {
        // This happens when the network request fails, and there's no cached version.
        // This is expected when offline and accessing a resource for the first time.
        console.warn(`Fetch failed for: ${event.request.url}. This is expected if you are offline and the resource is not cached.`, error);
        // We must re-throw the error to let the browser handle it.
        throw error;
      });
    })
  );
});