const CACHE = 'nene-ai-shell-v54';

const SHELL = [
  './',
  './index.html',
  './auth-config.js?v=53',
  './account-setup.js?v=50',
  './terms.html',
  './privacy.html',
  './delete-account.html',
  './privacy-help.html',
  './privacy-actions.js?v=50',
  './privacy-pages.css?v=50',
  './profile.js?v=50',
  './auth.js?v=52',
  './characters.js?v=50',
  './script-writer.js?v=50',
  './video-editor.js?v=51',
  './editor-model.js?v=50',
  './editor-store.js?v=50',
  './editor-mp4.js?v=51',
  './editor-media.js?v=51',
  './editor-billing.js?v=50',
  './video-editor.css?v=50',
  './paid-access.js?v=54',
  './ad-studio.js?v=50',
  './social-content.js?v=50',
  './prompt-assist.js?v=50',
  './video-studio.js?v=50',
  './output-report.js?v=50',
  './story-studio.js?v=50',
  './video-studio.css?v=50',
  './layout.js?v=50',
  './layout.css?v=50',
  './director.js?v=50',
  './studio-ui.js?v=50',
  './studio-ui.css?v=50',
  './manifest.webmanifest',
  './brand-logo.svg',
  './brand-mark.svg?v=50',
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
          cached => cached || (isShell ? caches.match('./index.html') : new Response('This app file is unavailable offline. Reconnect and refresh NENE AI.', {status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}}))
        )
      )
  );
});






