importScripts('https://cdn.jsdelivr.net/npm/workbox-cdn@5.1.3/workbox/workbox-sw.js');

workbox.setConfig({
  modulePathPrefix: 'https://cdn.jsdelivr.net/npm/workbox-cdn@5.1.3/workbox/'
});

self.__WB_DISABLE_DEV_LOGS = true;

const { core, routing, strategies, expiration } = workbox;
const { CacheFirst, NetworkFirst, NetworkOnly } = strategies;
const { ExpirationPlugin } = expiration;

const cacheSuffixVersion = '_20260315_mermaid_fix_v1';

core.setCacheNameDetails({
  prefix: 'bycg',
  suffix: cacheSuffixVersion
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (!key.includes(cacheSuffixVersion)) {
          return caches.delete(key);
        }

        return Promise.resolve();
      })
    ))
  );
});

core.skipWaiting();
core.clientsClaim();

routing.registerRoute(
  /.*(cdn.jsdelivr.net|at.alicdn.com)/,
  new CacheFirst({
    cacheName: 'static-cdn' + cacheSuffixVersion,
    fetchOptions: {
      mode: 'cors',
      credentials: 'omit'
    },
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true
      })
    ]
  })
);

routing.registerRoute(
  /\/sw\.js$/,
  new NetworkOnly()
);

routing.registerRoute(
  /.*\.(?:png|jpg|jpeg|svg|gif|webp)$/,
  new CacheFirst({
    cacheName: 'static-image' + cacheSuffixVersion
  })
);

routing.registerRoute(
  /.*\.(css|js)$/,
  new NetworkFirst({
    cacheName: 'static-js-css' + cacheSuffixVersion,
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 80,
        purgeOnQuotaError: true
      })
    ]
  })
);

routing.registerRoute(
  ({ url }) => url.hostname === location.hostname,
  new NetworkFirst({
    cacheName: 'static-other' + cacheSuffixVersion,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        purgeOnQuotaError: true
      })
    ]
  })
);
