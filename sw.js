const CACHE = 'nene-ai-shell-v30';

const SHELL = [
  './',
  './index.html',
  './auth-config.js?v=30',
  './account-setup.js?v=30',
  './terms.html',
  './privacy.html',
  './profile.js?v=30',
  './auth.js?v=30',
  './characters.js?v=30',
  './script-writer.js?v=30',
  './paid-access.js?v=30',
  './ad-studio.js?v=30',
  './social-content.js?v=30',
  './prompt-assist.js?v=30',
  './video-studio.js?v=30',
  './story-studio.js?v=30',
  './video-studio.css?v=30',
  './layout.js?v=30',
  './layout.css?v=30',
  './director.js?v=30',
  './manifest.webmanifest',
  './manifest.webmanifest?v=30',
  './brand-logo.svg',
  './brand-mark.svg?v=30',
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






