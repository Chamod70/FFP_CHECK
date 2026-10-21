const CACHE_NAME = 'ffp-cache-v1';

// Install event - activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
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

// Fetch event - Stale-While-Revalidate & Network-First for navigation
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Only handle GET requests strictly on the SAME origin
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }

  // Vite HMR and dev websocket should bypass service worker
  if (request.url.includes('/@vite/') || request.url.includes('/@react-refresh') || request.url.includes('hot-update')) {
    return;
  }

  // For HTML navigation requests (page loads / refreshes)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Network failed! Return cached page so user stays working offline
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const fallback = await caches.match('/');
          if (fallback) return fallback;
          return caches.match('/index.html');
        })
    );
    return;
  }

  // For scripts, styles, images, and other static assets: Cache with Network Fallback / Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request failed, return cached response if present
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
