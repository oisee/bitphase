const CACHE_BUCKET = 'app-cache-__BUILD_VERSION__';

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_BUCKET)
			.then((cache) => cache.add('/index.html'))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((key) => key !== CACHE_BUCKET).map((key) => caches.delete(key))
				)
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	event.respondWith(
		fetch(event.request)
			.then((networkResponse) => {
				if (networkResponse && networkResponse.ok) {
					const responseToCache = networkResponse.clone();
					caches.open(CACHE_BUCKET).then((cache) => {
						cache.put(event.request, responseToCache);
					});
				}
				return networkResponse;
			})
			.catch(() => caches.match(event.request))
	);
});
