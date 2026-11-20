const V = 'gpsthomas-v7';
const TILES = ['tile.openstreetmap.org', 'arcgisonline.com'];
// PNG transparente 1x1
const VAZIO = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII='), (ch) => ch.charCodeAt(0));

// Ao instalar, já guarda a página inicial e todos os arquivos do app (JS, fontes, ícones) para abrir sem internet na roça.
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      try {
        const c = await caches.open(V);
        const r = await fetch('/', { cache: 'reload' });
        if (!r.ok) return;
        const html = await r.clone().text();
        await c.put('/', r);
        const urls = new Set(['/manifest.webmanifest', '/fonts/Inter_400Regular.woff2', '/fonts/Inter_500Medium.woff2', '/fonts/Inter_600SemiBold.woff2', '/fonts/Inter_700Bold.woff2']);
        for (const m of html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css|png|ico|woff2|webmanifest))"/g)) urls.add(m[1]);
        await Promise.all([...urls].map((u) => fetch(u).then((x) => (x.ok ? c.put(u, x) : null)).catch(() => null)));
      } catch {}
    })(),
  );
});

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
