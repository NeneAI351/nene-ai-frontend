const CACHE = 'nene-ai-shell-v49';

const SHELL = [
  './',
  './index.html',
  './auth-config.js?v=49',
  './account-setup.js?v=49',
  './terms.html',
  './privacy.html',
  './delete-account.html',
  './privacy-help.html',
  './privacy-actions.js?v=49',
  './privacy-pages.css?v=49',
  './profile.js?v=49',
  './auth.js?v=49',
  './characters.js?v=49',
  './script-writer.js?v=49',
  './video-editor.js?v=49',
  './editor-model.js?v=49',
  './editor-store.js?v=49',
  './editor-media.js?v=49',
  './editor-billing.js?v=49',
  './video-editor.css?v=49',
  './paid-access.js?v=49',
  './ad-studio.js?v=49',
  './social-content.js?v=49',
  './prompt-assist.js?v=49',
  './video-studio.js?v=49',
  './output-report.js?v=49',
  './story-studio.js?v=49',
  './video-studio.css?v=49',
  './layout.js?v=49',
  './layout.css?v=49',
  './director.js?v=49',
  './studio-ui.js?v=49',
  './studio-ui.css?v=49',
  './manifest.webmanifest',
  './brand-logo.svg',
  './brand-mark.svg?v=49',
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






