const CACHE = 'nene-ai-shell-v41';

const SHELL = [
  './',
  './index.html',
  './auth-config.js?v=41',
  './account-setup.js?v=41',
  './terms.html',
  './privacy.html',
  './delete-account.html',
  './privacy-help.html',
  './privacy-actions.js?v=41',
  './privacy-pages.css?v=41',
  './profile.js?v=41',
  './auth.js?v=41',
  './characters.js?v=41',
  './script-writer.js?v=41',
  './video-editor.js?v=41',
  './editor-model.js?v=41',
  './editor-store.js?v=41',
  './editor-media.js?v=41',
  './editor-billing.js?v=41',
  './video-editor.css?v=41',
  './paid-access.js?v=41',
  './ad-studio.js?v=41',
  './social-content.js?v=41',
  './prompt-assist.js?v=41',
  './video-studio.js?v=41',
  './story-studio.js?v=41',
  './video-studio.css?v=41',
  './layout.js?v=41',
  './layout.css?v=41',
  './director.js?v=41',
  './studio-ui.js?v=41',
  './studio-ui.css?v=41',
  './manifest.webmanifest',
  './brand-logo.svg',
  './brand-mark.svg?v=41',
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






