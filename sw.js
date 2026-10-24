const CACHE = 'nene-ai-shell-v33';

const SHELL = [
  './',
  './index.html',
  './auth-config.js?v=33',
  './account-setup.js?v=33',
  './terms.html',
  './privacy.html',
  './delete-account.html',
  './privacy-help.html',
  './privacy-actions.js?v=33',
  './privacy-pages.css?v=33',
  './profile.js?v=33',
  './auth.js?v=33',
  './characters.js?v=33',
  './script-writer.js?v=33',
  './paid-access.js?v=33',
  './ad-studio.js?v=33',
  './social-content.js?v=33',
  './prompt-assist.js?v=33',
  './video-studio.js?v=33',
  './story-studio.js?v=33',
  './video-studio.css?v=33',
  './layout.js?v=33',
  './layout.css?v=33',
  './director.js?v=33',
  './manifest.webmanifest',
  './manifest.webmanifest?v=33',
  './brand-logo.svg',
  './brand-mark.svg?v=33',
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






