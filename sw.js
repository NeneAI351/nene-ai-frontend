const CACHE = 'nene-ai-shell-v25';

const SHELL = [
  './',
  './index.html',
  './auth-config.js?v=25',
  './account-setup.js?v=25',
  './terms.html',
  './privacy.html',
  './profile.js?v=25',
  './auth.js?v=25',
  './characters.js?v=25',
  './script-writer.js?v=25',
  './paid-access.js?v=25',
  './ad-studio.js?v=25',
  './social-content.js?v=25',
  './layout.js?v=25',
  './layout.css?v=25',
  './director.js?v=25',
  './manifest.webmanifest',
  './manifest.webmanifest?v=25',
  './brand-logo.svg',
  './brand-mark.svg?v=25',
  './nene-icon-192-v2.png',
  './nene-icon-512-v2.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache NENE AI backend/API traffic.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return;

  // Always fetch the HTML shell from the network first. This prevents an older
  // GitHub Pages/service-worker copy from hiding a newly deployed NENE AI build.
  const isShell = request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');

  event.respondWith(
    fetch(request, isShell ? {cache:'no-store'} : undefined)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(
          cached => cached || caches.match('./index.html')
        )
      )
  );
});


