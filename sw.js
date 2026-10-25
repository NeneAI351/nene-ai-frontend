const CACHE = 'nene-ai-shell-v46';

const SHELL = [
  './',
  './index.html',
  './auth-config.js?v=46',
  './account-setup.js?v=46',
  './terms.html',
  './privacy.html',
  './delete-account.html',
  './privacy-help.html',
  './privacy-actions.js?v=46',
  './privacy-pages.css?v=46',
  './profile.js?v=46',
  './auth.js?v=46',
  './characters.js?v=46',
  './script-writer.js?v=46',
  './video-editor.js?v=46',
  './editor-model.js?v=46',
  './editor-store.js?v=46',
  './editor-media.js?v=46',
  './editor-billing.js?v=46',
  './video-editor.css?v=46',
  './paid-access.js?v=46',
  './ad-studio.js?v=46',
  './social-content.js?v=46',
  './prompt-assist.js?v=46',
  './video-studio.js?v=46',
  './story-studio.js?v=46',
  './video-studio.css?v=46',
  './layout.js?v=46',
  './layout.css?v=46',
  './director.js?v=46',
  './studio-ui.js?v=46',
  './studio-ui.css?v=46',
  './manifest.webmanifest',
  './brand-logo.svg',
  './brand-mark.svg?v=46',
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






