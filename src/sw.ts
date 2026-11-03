/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

// API: mostra o último dado salvo na hora e atualiza em segundo plano (stale-while-revalidate)
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET' && !url.pathname.startsWith('/api/medidas'),
  new StaleWhileRevalidate({ cacheName: 'api-v1' }),
);
registerRoute(({ url }) => url.pathname.startsWith('/api/medidas'), new NetworkFirst({ cacheName: 'api-medidas', networkTimeoutSeconds: 6 }));
// Mapa base e radar: cache curto
registerRoute(
  ({ url }) => /tile\.openstreetmap\.org|arcgisonline\.com/.test(url.hostname),
  new CacheFirst({ cacheName: 'tiles-v1' }),
);

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', (e) => {
  let d: { title?: string; body?: string } = {};
  try {
    d = e.data?.json() ?? {};
  } catch {
    d = { title: 'Chuva Pro', body: e.data?.text() };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || 'Chuva Pro', {
      body: d.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'chuva-pro-alerta',
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow('/'));
});
