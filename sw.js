var CACHE_NAME = 'bc-shell-v1';
var SHELL_FILES = [
  './',
  './index.html',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/screens.css',
  './js/config.js',
  './js/util.js',
  './js/ui.js',
  './js/store.js',
  './js/auth.js',
  './js/sync.js',
  './js/calc.js',
  './js/router.js',
  './js/screens/accounts.js',
  './js/screens/categories.js',
  './js/screens/quickadd.js',
  './js/main.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
             .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  if (url.pathname.indexOf('/auth/v1/') !== -1 ||
      url.pathname.indexOf('/rest/v1/') !== -1) {
    return;
  }

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request).then(function (response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(e.request, clone);
        });
        return response;
      }).catch(function () {
        return caches.match(e.request);
      })
    );
  }
});
