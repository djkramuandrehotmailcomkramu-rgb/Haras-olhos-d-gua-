// Utilitários da suíte de ponta a ponta (Playwright). Uso: npm run build:web && npm run e2e
const http = require('http');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const DIST = path.join(__dirname, '..', 'dist');
const SAIDA = path.join(__dirname, 'saida');
fs.mkdirSync(SAIDA, { recursive: true });

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

/** Servidor estático simples com fallback de página única (SPA). */
function servir(porta = 4180) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let arq = path.join(DIST, p);
    if (!arq.startsWith(DIST) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) arq = path.join(DIST, 'index.html');
    const ext = path.extname(arq);
    const imutavel = /\/(_expo|assets|fonts)\//.test(req.url) || /\.(png|woff2|ttf)$/.test(arq);
    const cab = { 'content-type': TIPOS[ext] ?? 'application/octet-stream', 'cache-control': imutavel ? 'public, max-age=31536000, immutable' : 'no-cache' };
    const comprimivel = /\.(html|js|json|css|svg|webmanifest|ttf)$/.test(arq) && /gzip/.test(req.headers['accept-encoding'] || '');
    if (comprimivel) {
      res.writeHead(200, { ...cab, 'content-encoding': 'gzip', vary: 'accept-encoding' });
      fs.createReadStream(arq).pipe(zlib.createGzip({ level: 6 })).pipe(res);
    } else {
      res.writeHead(200, cab);
      fs.createReadStream(arq).pipe(res);
    }
  });
  return new Promise((ok) => srv.listen(porta, () => ok({ srv, url: `http://localhost:${porta}` })));
}

// ---------- dados de teste: KML da "Fazenda Lagoa Formosa" (Andropogon ~92 ha e Amendoim ~72 ha) ----------
const BASE = [-47.93, -15.78];
const KX = Math.cos((15.78 * Math.PI) / 180) * 111319.49, KY = 111319.49;
const pt = (dx, dy) => [BASE[0] + dx / KX, BASE[1] + dy / KY];
const anel = (pts) => [...pts, pts[0]].map((c) => `${c[0]},${c[1]},0`).join(' ');
const ANDRO = [pt(0, 0), pt(2000, 0), pt(2000, 460), pt(0, 460)];
const AMEN = [pt(0, 600), pt(1200, 600), pt(1200, 1200), pt(0, 1200)];
function escreverKml() {
  const kml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<Placemark><name>Andropogon 92 ha</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${anel(ANDRO)}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
<Placemark><name>Amendoim 72 ha</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${anel(AMEN)}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
</Document></kml>`;
  const f = path.join(SAIDA, 'lagoa.kml');
  fs.writeFileSync(f, kml);
  return f;
}

async function abrirNavegador() {
  return chromium.launch();
}

/** Página de celular com GPS simulado e mapas bloqueados (sem internet externa). */
async function novaPagina(browser, { url, largura, altura, esquema = 'light', onboarding = true, agenteExtra = '', gps = { latitude: BASE[1] + 5 / KY, longitude: BASE[0], accuracy: 4 } } = {}) {
  const ctx = await browser.newContext({
    ...devices['Pixel 7'],
    ...(agenteExtra ? { userAgent: `${devices['Pixel 7'].userAgent} ${agenteExtra}` } : {}),
    ...(largura ? { viewport: { width: largura, height: altura ?? 800 } } : {}),
    colorScheme: esquema, geolocation: gps, permissions: ['geolocation'], acceptDownloads: true,
  });
  const page = await ctx.newPage();
  page.erros = [];
  page.on('pageerror', (e) => page.erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/tile|ERR_|Failed to load resource|net::/.test(m.text())) page.erros.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.addInitScript((ob) => localStorage.setItem('gpsthomas-prefs', JSON.stringify({ state: { onboardingVisto: ob, unidadeArea: 'ha', camada: 'mapa', vozLigada: false }, version: 1 })), onboarding);
  await page.route(/tile\.openstreetmap|arcgisonline/, (r) => r.abort());
  page.ir = async (rota) => { await page.goto(`${url}${rota}`); await page.waitForTimeout(1800); };
  page.ctx = ctx;
  return page;
}

async function importarKml(page, url, fazenda = 'Lagoa Formosa') {
  await page.ir('/mais');
  await page.getByPlaceholder('Ex.: Lagoa Formosa').fill(fazenda);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByText(/Importar KML/).click()]);
  await fc.setFiles(escreverKml());
  await page.waitForTimeout(900);
}

async function estado(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('gpsthomas-dados') || '{"state":{}}').state);
}

class Falha extends Error {}
const check = (cond, msg) => { if (!cond) throw new Falha(msg); };

module.exports = { servir, abrirNavegador, novaPagina, importarKml, estado, check, Falha, BASE, KX, KY, pt, ANDRO, AMEN, SAIDA, DIST };
