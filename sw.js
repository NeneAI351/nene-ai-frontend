const CACHE = 'nene-ai-shell-v47';

const SHELL = [
  './',
  './index.html',
  './auth-config.js?v=47',
  './account-setup.js?v=47',
  './terms.html',
  './privacy.html',
  './delete-account.html',
  './privacy-help.html',
  './privacy-actions.js?v=47',
  './privacy-pages.css?v=47',
  './profile.js?v=47',
  './auth.js?v=47',
  './characters.js?v=47',
  './script-writer.js?v=47',
  './video-editor.js?v=47',
  './editor-model.js?v=47',
  './editor-store.js?v=47',
  './editor-media.js?v=47',
  './editor-billing.js?v=47',
  './video-editor.css?v=47',
  './paid-access.js?v=47',
  './ad-studio.js?v=47',
  './social-content.js?v=47',
  './prompt-assist.js?v=47',
  './video-studio.js?v=47',
  './story-studio.js?v=47',
  './video-studio.css?v=47',
  './layout.js?v=47',
  './layout.css?v=47',
  './director.js?v=47',
  './studio-ui.js?v=47',
  './studio-ui.css?v=47',
  './manifest.webmanifest',
  './brand-logo.svg',
  './brand-mark.svg?v=47',
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






