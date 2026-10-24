const CACHE = 'nene-ai-shell-v38';

const SHELL = [
  './',
  './index.html',
  './auth-config.js?v=38',
  './account-setup.js?v=38',
  './terms.html',
  './privacy.html',
  './delete-account.html',
  './privacy-help.html',
  './privacy-actions.js?v=38',
  './privacy-pages.css?v=38',
  './profile.js?v=38',
  './auth.js?v=38',
  './characters.js?v=38',
  './script-writer.js?v=38',
  './video-editor.js?v=38',
  './paid-access.js?v=38',
  './ad-studio.js?v=38',
  './social-content.js?v=38',
  './prompt-assist.js?v=38',
  './video-studio.js?v=38',
  './story-studio.js?v=38',
  './video-studio.css?v=38',
  './layout.js?v=38',
  './layout.css?v=38',
  './director.js?v=38',
  './studio-ui.js?v=38',
  './studio-ui.css?v=38',
  './manifest.webmanifest',
  './brand-logo.svg',
  './brand-mark.svg?v=38',
  './nene-icon-192-v3.png',
  './nene-icon-192-v2.png',
  './nene-icon-512-v3.png',
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






