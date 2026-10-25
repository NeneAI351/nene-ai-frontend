const CACHE = 'nene-ai-shell-v42';

const SHELL = [
  './',
  './index.html',
  './auth-config.js?v=42',
  './account-setup.js?v=42',
  './terms.html',
  './privacy.html',
  './delete-account.html',
  './privacy-help.html',
  './privacy-actions.js?v=42',
  './privacy-pages.css?v=42',
  './profile.js?v=42',
  './auth.js?v=42',
  './characters.js?v=42',
  './script-writer.js?v=42',
  './video-editor.js?v=42',
  './editor-model.js?v=42',
  './editor-store.js?v=42',
  './editor-media.js?v=42',
  './editor-billing.js?v=42',
  './video-editor.css?v=42',
  './paid-access.js?v=42',
  './ad-studio.js?v=42',
  './social-content.js?v=42',
  './prompt-assist.js?v=42',
  './video-studio.js?v=42',
  './story-studio.js?v=42',
  './video-studio.css?v=42',
  './layout.js?v=42',
  './layout.css?v=42',
  './director.js?v=42',
  './studio-ui.js?v=42',
  './studio-ui.css?v=42',
  './manifest.webmanifest',
  './brand-logo.svg',
  './brand-mark.svg?v=42',
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






