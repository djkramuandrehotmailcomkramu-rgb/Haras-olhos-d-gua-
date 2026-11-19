const V = 'gpsthomas-v6';
const TILES = ['tile.openstreetmap.org', 'arcgisonline.com'];
// PNG transparente 1x1
const VAZIO = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII='), (ch) => ch.charCodeAt(0));

// Não pula a espera sozinho: o app mostra "Nova versão disponível" e o usuário decide quando atualizar.
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('gpsthomas-') && k !== V && k !== 'gpsthomas-tiles').map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Mapas: cache primeiro (inclui os mapas baixados em "Mapas offline"). Sem internet e sem o bloco salvo, devolve um bloco vazio
  // para o mapa não mostrar erro.
  if (TILES.some((h) => url.hostname.endsWith(h))) {
    e.respondWith(
      caches.open('gpsthomas-tiles').then((c) =>
        c.match(req, { ignoreVary: true }).then((hit) =>
          hit ||
          fetch(req)
            .then((r) => { if (r.ok) c.put(req, r.clone()); return r; })
            .catch(() => new Response(VAZIO, { status: 200, headers: { 'content-type': 'image/png' } })),
        ),
      ),
    );
    return;
  }
  if (url.origin !== location.origin) return;
  // Aplicativo: rede primeiro (sempre a versão mais nova) e, sem internet, a cópia guardada.
  e.respondWith(
    fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(V).then((k) => k.put(req, cp)); } return r; })
      .catch(() => caches.match(req).then((m) => m || caches.match('/'))),
  );
});
