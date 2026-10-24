const CACHE = 'nene-ai-shell-v35';

const SHELL = [
  './',
  './index.html',
  './auth-config.js?v=35',
  './account-setup.js?v=35',
  './terms.html',
  './privacy.html',
  './delete-account.html',
  './privacy-help.html',
  './privacy-actions.js?v=35',
  './privacy-pages.css?v=35',
  './profile.js?v=35',
  './auth.js?v=35',
  './characters.js?v=35',
  './script-writer.js?v=35',
  './paid-access.js?v=35',
  './ad-studio.js?v=35',
  './social-content.js?v=35',
  './prompt-assist.js?v=35',
  './video-studio.js?v=35',
  './story-studio.js?v=35',
  './video-studio.css?v=35',
  './layout.js?v=35',
  './layout.css?v=35',
  './director.js?v=35',
  './studio-ui.js?v=35',
  './studio-ui.css?v=35',
  './manifest.webmanifest',
  './manifest.webmanifest?v=35',
  './brand-logo.svg',
  './brand-mark.svg?v=35',
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






