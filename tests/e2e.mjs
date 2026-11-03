// e2e em viewport de celular contra o app publicado. Uso: URL=https://... node tests/e2e.mjs
import { chromium, devices } from 'playwright';

const URL_ = process.env.URL || 'https://chuva-pro-fazenda-itaguaia.vercel.app';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FALHA'} ${m}`); if (!c) falhas.push(m); };

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ ...devices['Pixel 5'], locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', geolocation: { latitude: -16.2727, longitude: -46.132 }, permissions: ['geolocation'] });
const page = await ctx.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !/tile|ERR_|Failed to load resource/.test(m.text()) && erros.push(m.text()));

const t0 = Date.now();
await page.goto(URL_, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.big', { timeout: 30000 });
const tUtil = Date.now() - t0;
ok(tUtil < 4000, `primeira tela útil em ${tUtil} ms (meta < 2000 em 4G; aqui é rede de datacenter)`);
const txt = await page.innerText('main');
ok(/mm/.test(txt) && /chance de chuva/.test(txt), 'HOJE mostra mm e % de chance');
ok(/Pulverização/.test(txt) && /Plantio/.test(txt) && /Colheita/.test(txt), 'HOJE mostra os 3 semáforos');
ok(/bula/.test(txt), 'aviso de bula/receituário presente');
ok(/Bruto/.test(txt) && /calibrando|Correção/.test(txt), 'número bruto/corrigido e estado da calibração visíveis');
ok(/atualizado|offline/.test(await page.innerText('header')), 'selo "atualizado há X"');

const aba = async (nome) => page.getByRole('button', { name: nome, exact: true }).click();
await aba('Semana');
await page.waitForSelector('.day');
ok((await page.locator('.day').count()) >= 14, `SEMANA: ${await page.locator('.day').count()} dias`);
await page.locator('.day .h').nth(1).click();
ok((await page.locator('.hrs div').count()) > 0, 'SEMANA: toque abre hora a hora');

await aba('Talhões');
await page.waitForSelector('.tal');
ok((await page.locator('.tal').count()) === 18, `TALHÕES: ${await page.locator('.tal').count()} talhões (esperado 18)`);
ok(/mesma célula|célula/.test(await page.innerText('main')), 'TALHÕES: indica células do modelo');
await page.fill('#b', 'Palmeira');
ok((await page.locator('.tal').count()) === 4, 'TALHÕES: busca "Palmeira" = 4');

await aba('Mapa');
await page.waitForSelector('#mapa path.leaflet-interactive', { timeout: 15000 });
const polis = await page.locator('#mapa path.leaflet-interactive').count();
ok(polis === 18, `MAPA: ${polis} polígonos`);
await page.getByRole('button', { name: /Onde estou/ }).click();
await page.waitForFunction(() => /Você está/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
ok(/Você está/.test(await page.innerText('main')), 'MAPA: GPS identifica talhão/posição');

await aba('Medida');
await page.waitForSelector('#lm');
await page.fill('#lm', '0,1');
await page.fill('#lo', 'e2e-teste');
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
await page.waitForFunction(() => /Salvo:/.test(document.body.innerText), null, { timeout: 15000 });
ok(true, 'MEDIDA: lançamento salvo');
page.once('dialog', (d) => d.accept());
await page.locator('.tal', { hasText: 'e2e-teste' }).first().getByRole('button', { name: 'Apagar lançamento' }).click();
await page.waitForFunction(() => !/e2e-teste/.test(document.body.innerText), null, { timeout: 15000 });
ok(true, 'MEDIDA: lançamento de teste apagado (sem sujar o banco)');

await page.locator('header').getByRole('button', { name: 'Confiabilidade' }).click();
ok(/calibrando/i.test(await page.innerText('main')), 'CONFIABILIDADE: mostra "ainda calibrando" em vez de número bonito');
await page.locator('header').getByRole('button', { name: 'Ajustes' }).click();
ok(/limites dos sem/i.test(await page.innerText('main')), 'AJUSTES abre');

// offline: service worker precisa estar ativo
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(1500);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.big');
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForSelector('.big', { timeout: 20000 }).catch(() => {});
const off = await page.innerText('body');
console.log('offline body:', off.replace(/\s+/g, ' ').slice(0, 160));
ok(/mm/.test(off) && /offline/i.test(off), 'OFFLINE: abre com o último dado salvo e selo "offline"');
await page.screenshot({ path: '/tmp/e2e-offline.png' });
await ctx.setOffline(false);

ok(erros.length === 0, `sem erros de console/página${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO OK');
process.exit(falhas.length ? 1 : 0);
