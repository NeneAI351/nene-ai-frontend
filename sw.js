const CACHE = 'nene-ai-shell-v39';

const SHELL = [
  './',
  './index.html',
  './auth-config.js?v=39',
  './account-setup.js?v=39',
  './terms.html',
  './privacy.html',
  './delete-account.html',
  './privacy-help.html',
  './privacy-actions.js?v=39',
  './privacy-pages.css?v=39',
  './profile.js?v=39',
  './auth.js?v=39',
  './characters.js?v=39',
  './script-writer.js?v=39',
  './video-editor.js?v=39',
  './editor-model.js?v=39',
  './editor-store.js?v=39',
  './editor-media.js?v=39',
  './editor-billing.js?v=39',
  './video-editor.css?v=39',
  './paid-access.js?v=39',
  './ad-studio.js?v=39',
  './social-content.js?v=39',
  './prompt-assist.js?v=39',
  './video-studio.js?v=39',
  './story-studio.js?v=39',
  './video-studio.css?v=39',
  './layout.js?v=39',
  './layout.css?v=39',
  './director.js?v=39',
  './studio-ui.js?v=39',
  './studio-ui.css?v=39',
  './manifest.webmanifest',
  './brand-logo.svg',
  './brand-mark.svg?v=39',
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






