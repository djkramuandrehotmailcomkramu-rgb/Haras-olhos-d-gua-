/* Offline: abre do cache na hora e atualiza em segundo plano. Dados do Supabase nunca passam pelo cache. */
const VERSION = 'safra-1.5.4';
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
const FILES = ['./', 'index.html', 'styles.css', 'foto.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(async c => {
  await c.addAll(FILES);
  await c.add(new Request(CDN, { mode: 'cors' })).catch(() => { });
}).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('safra-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || (u.origin !== location.origin && e.request.url !== CDN && !e.request.url.startsWith('https://cdn.jsdelivr.net/npm/tesseract') && !e.request.url.startsWith('https://cdn.jsdelivr.net/npm/@tesseract'))) return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
