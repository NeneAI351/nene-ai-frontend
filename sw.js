const CACHE = 'nene-ai-shell-v48';

const SHELL = [
  './',
  './index.html',
  './auth-config.js?v=48',
  './account-setup.js?v=48',
  './terms.html',
  './privacy.html',
  './delete-account.html',
  './privacy-help.html',
  './privacy-actions.js?v=48',
  './privacy-pages.css?v=48',
  './profile.js?v=48',
  './auth.js?v=48',
  './characters.js?v=48',
  './script-writer.js?v=48',
  './video-editor.js?v=48',
  './editor-model.js?v=48',
  './editor-store.js?v=48',
  './editor-media.js?v=48',
  './editor-billing.js?v=48',
  './video-editor.css?v=48',
  './paid-access.js?v=48',
  './ad-studio.js?v=48',
  './social-content.js?v=48',
  './prompt-assist.js?v=48',
  './video-studio.js?v=48',
  './output-report.js?v=48',
  './story-studio.js?v=48',
  './video-studio.css?v=48',
  './layout.js?v=48',
  './layout.css?v=48',
  './director.js?v=48',
  './studio-ui.js?v=48',
  './studio-ui.css?v=48',
  './manifest.webmanifest',
  './brand-logo.svg',
  './brand-mark.svg?v=48',
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






