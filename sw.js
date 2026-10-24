const CACHE = 'nene-ai-shell-v36';

const SHELL = [
  './',
  './index.html',
  './auth-config.js?v=36',
  './account-setup.js?v=36',
  './terms.html',
  './privacy.html',
  './delete-account.html',
  './privacy-help.html',
  './privacy-actions.js?v=36',
  './privacy-pages.css?v=36',
  './profile.js?v=36',
  './auth.js?v=36',
  './characters.js?v=36',
  './script-writer.js?v=36',
  './paid-access.js?v=36',
  './ad-studio.js?v=36',
  './social-content.js?v=36',
  './prompt-assist.js?v=36',
  './video-studio.js?v=36',
  './story-studio.js?v=36',
  './video-studio.css?v=36',
  './layout.js?v=36',
  './layout.css?v=36',
  './director.js?v=36',
  './studio-ui.js?v=36',
  './studio-ui.css?v=36',
  './manifest.webmanifest',
  './manifest.webmanifest?v=36',
  './brand-logo.svg',
  './brand-mark.svg?v=36',
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






