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
await page.waitForSelector('.banner', { timeout: 30000 });
const tUtil = Date.now() - t0;
ok(tUtil < 4000, `primeira tela útil em ${tUtil} ms (meta < 2000 em 4G; aqui é rede de datacenter)`);
const txt = await page.innerText('main');
ok(/(Bom para|Atenção para|Não é bom para|Sem dados para)/.test(txt), 'CONDIÇÕES: faixa de status por operação');
ok((await page.locator('.tile').count()) === 12, `CONDIÇÕES: ${await page.locator('.tile').count()} blocos de condições (esperado 12)`);
ok((await page.locator('.fd').count()) === 14, 'CONDIÇÕES: faixa de 14 dias');
ok((await page.locator('.hr').count()) === 24, 'CONDIÇÕES: linha do tempo de 24 h');
ok(/Chance/.test(txt) && /Vento/i.test(txt) && /Umidade/i.test(txt), 'CONDIÇÕES: chance, vento e umidade');
for (const nome of ['Plantar', 'Colher', 'Pulverizar']) { await page.getByRole('button', { name: nome }).click(); ok(/(Bom para|Atenção para|Não é bom para|Sem dados para)/.test(await page.innerText('.banner')), `operação ${nome} troca a faixa`); }
await page.locator('.fd').nth(3).click();
ok(/Precisão desta previsão/i.test(await page.innerText('main')), 'PRECISÃO: bloco com bruto, corrigido, modelos e pesos');
ok(/bula/.test(txt), 'aviso de bula/receituário presente');
ok(/bruto/i.test(await page.innerText('main')) && /calibrando|Correção|aprendidos/.test(await page.innerText('main')), 'número bruto/corrigido e estado da calibração visíveis');
ok(/atualizado|offline/.test(await page.innerText('header')), 'selo "atualizado há X"');

const aba = async (nome) => page.locator('nav.bar').getByRole('button', { name: nome }).click();
await aba('Previsão');
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

await aba('Precisão');
ok(/Satélite\/reanálise|reanálise/i.test(await page.innerText('main')) && /não é chuva medida|NÃO é chuva medida/i.test(await page.innerText('main')), 'PRECISÃO: deixa claro que o histórico NÃO é pluviômetro');
await page.getByRole('button', { name: 'Seu pluviômetro' }).click();
ok(/calibrando/i.test(await page.innerText('main')), 'PRECISÃO: pluviômetro mostra "ainda calibrando"');
await aba('Ajustes');
ok(/limites dos sem/i.test(await page.innerText('main')), 'AJUSTES abre');

// offline: service worker precisa estar ativo
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(1500);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.banner');
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForSelector('.banner', { timeout: 20000 }).catch(() => {});
const off = await page.innerText('body');
console.log('offline body:', off.replace(/\s+/g, ' ').slice(0, 160));
ok(/mm/.test(off) && /offline/i.test(off), 'OFFLINE: abre com o último dado salvo e selo "offline"');
await page.screenshot({ path: '/tmp/e2e-offline.png' });
await ctx.setOffline(false);

ok(erros.length === 0, `sem erros de console/página${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO OK');
process.exit(falhas.length ? 1 : 0);
