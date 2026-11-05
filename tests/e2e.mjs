// e2e em viewport de celular contra o app publicado. Uso: URL=https://... node tests/e2e.mjs
import { chromium, devices } from 'playwright';

const URL_ = process.env.URL || 'https://chuva-pro-fazenda-itaguaia.vercel.app';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FALHA'} ${m}`); if (!c) falhas.push(m); };
const TEM_STATUS = /(PODE|CUIDADO|NÃO|SEM DADOS)/;

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ ...devices['Pixel 5'], locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', geolocation: { latitude: -16.2727, longitude: -46.132 }, permissions: ['geolocation'] });
const page = await ctx.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !/tile|ERR_|Failed to load resource/.test(m.text()) && erros.push(m.text()));
let reqPrevisao = 0;
page.on('request', (r) => r.url().includes('/api/previsao') && reqPrevisao++);

await page.clock.install();
const t0 = Date.now();
await page.goto(URL_, { waitUntil: 'domcontentloaded' });

// ---- guia de primeiro uso
await page.waitForSelector('.guia', { timeout: 20000 });
ok(/Veja se vai chover/.test(await page.innerText('.guia')), 'GUIA: aparece no primeiro uso');
await page.getByRole('button', { name: 'Próximo' }).click();
await page.getByRole('button', { name: 'Próximo' }).click();
ok(/Escolha o dia e ouça/.test(await page.innerText('.guia')), 'GUIA: 3 passos');
await page.getByRole('button', { name: 'Começar' }).click();

// ---- tela inicial (modo simples)
await page.waitForSelector('.heroi', { timeout: 30000 });
const tUtil = Date.now() - t0;
ok(tUtil < 6000, `primeira tela útil em ${tUtil} ms (datacenter; meta < 2000 em 4G)`);
const txt = await page.innerText('main');
ok(/(Vai chover|Pode chover|Não deve chover|Chance baixa|já passou)/.test(txt), 'SIMPLES: frase grande diz se vai chover');
ok((await page.locator('.trab').count()) === 3, 'SIMPLES: 3 cartões (Pulverização, Plantio, Colheita)');
ok(/(PODE|CUIDADO|NÃO|SEM DADOS)/.test(await page.locator('.trab').first().innerText()), 'SIMPLES: cartão com PODE/CUIDADO/NÃO');
ok((await page.locator('.dia-b').count()) === 7, 'SIMPLES: faixa de 7 dias com desenhos');
ok((await page.locator('.w-ico').count()) >= 8, 'SIMPLES: ícones de clima desenhados');
ok(/Confiança da previsão/i.test(txt) && /(Alta|Média|Baixa)/.test(txt), 'SIMPLES: confiança Alta/Média/Baixa');
ok(/bula/.test(txt), 'SIMPLES: aviso de bula/receituário');
ok(/Ao vivo|Atualizando|atualizado/.test(await page.innerText('.vivo')), 'AO VIVO: faixa com hora da atualização');
await page.locator('.dia-b').nth(3).click();
ok(!/^Hoje/.test((await page.innerText('.heroi-dia')).trim()), 'SIMPLES: escolher outro dia troca a tela');
await page.locator('.dia-b').first().click();
await page.locator('.trab').first().click();
await page.waitForSelector('.folha');
ok(/Para (pulverizar|plantar|colher)/.test(await page.innerText('.folha')), 'SIMPLES: "por quê?" explica a regra com limites');
await page.getByRole('button', { name: 'Fechar' }).click();
await page.getByRole('button', { name: 'Ver escala' }).click();
ok(/litro de água/.test(await page.innerText('.folha')), 'SIMPLES: escala da chuva explicada (1 mm = 1 litro)');
await page.getByRole('button', { name: 'Fechar' }).click();
const ouvir = page.getByRole('button', { name: /Ouvir a previsão/ });
if (await ouvir.count()) { await ouvir.click(); ok(true, 'SIMPLES: botão Ouvir funciona sem erro'); }

// ---- atualização automática (relógio acelerado: 5 min)
const antes = reqPrevisao;
await page.clock.fastForward('05:05');
await page.waitForTimeout(2500);
ok(reqPrevisao > antes, `AO VIVO: atualizou sozinho após 5 min (${reqPrevisao - antes} nova(s) consulta(s))`);

// ---- modo técnico
await page.getByRole('button', { name: 'Técnico', exact: true }).click();
await page.waitForSelector('.tile');
ok((await page.locator('.tile').count()) === 12 && (await page.locator('.fd').count()) === 14 && (await page.locator('.hr').count()) === 24, 'TÉCNICO: 12 blocos, 14 dias e linha do tempo de 24 h');
ok(/Precisão desta previsão/i.test(await page.innerText('main')), 'TÉCNICO: bloco com bruto, corrigido, modelos e pesos');
await page.getByRole('button', { name: 'Simples', exact: true }).click();
await page.waitForSelector('.heroi');

// ---- pesquisa de outro local
await page.getByRole('button', { name: 'Pesquisar outro local' }).click();
await page.fill('input[type=search]', 'Cuiabá');
await page.waitForSelector('.busca .tal', { timeout: 15000 });
await page.locator('.busca .tal').first().click();
await page.waitForSelector('.lugar-chip', { timeout: 45000 });
await page.waitForSelector('.heroi', { timeout: 45000 });
ok(/Cuiab/.test(await page.innerText('.lugar-chip')), 'BUSCA: previsão simples do local escolhido');
await page.getByRole('button', { name: 'Voltar para a fazenda' }).first().click();
await page.waitForSelector('.heroi');
ok((await page.locator('.lugar-chip').count()) === 0, 'BUSCA: voltar para a fazenda');

// ---- semana
await page.locator('nav.bar').getByRole('button', { name: 'Semana' }).click();
await page.waitForSelector('.day');
ok((await page.locator('.day').count()) >= 14, `SEMANA: ${await page.locator('.day').count()} dias com desenho e palavras`);
ok(/(Sem chuva|Garoa|Chuva)/.test(await page.innerText('main')), 'SEMANA: chuva descrita em palavras');
await page.locator('.day .h').nth(1).click();
ok((await page.locator('.hrs div').count()) > 0, 'SEMANA: toque abre hora a hora');

// ---- mapa
await page.locator('nav.bar').getByRole('button', { name: 'Mapa' }).click();
await page.waitForSelector('#mapa path.leaflet-interactive', { timeout: 15000 });
ok((await page.locator('#mapa path.leaflet-interactive').count()) === 18, 'MAPA: 18 polígonos');
await page.getByRole('button', { name: /Onde estou/ }).click();
await page.waitForFunction(() => /Você está/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
ok(/Você está/.test(await page.innerText('main')), 'MAPA: GPS identifica talhão/posição');

// ---- medida (botões rápidos)
await page.locator('nav.bar').getByRole('button', { name: 'Medida' }).click();
await page.waitForSelector('.rapido');
await page.getByRole('button', { name: '2 mm', exact: true }).click();
await page.fill('#lo', 'e2e-teste');
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
await page.waitForFunction(() => /Salvo:/.test(document.body.innerText), null, { timeout: 15000 });
ok(true, 'MEDIDA: lançamento pelos botões rápidos salvo');
page.once('dialog', (d) => d.accept());
await page.locator('.tal', { hasText: 'e2e-teste' }).first().getByRole('button', { name: 'Apagar lançamento' }).click();
await page.waitForFunction(() => !/e2e-teste/.test(document.body.innerText), null, { timeout: 15000 });
ok(true, 'MEDIDA: lançamento de teste apagado (sem sujar o banco)');

// ---- mais: talhões, precisão, ajustes, aparência
const mais = () => page.locator('nav.bar').getByRole('button', { name: 'Mais' }).click();
await mais();
await page.getByRole('button', { name: /Talhões/ }).click();
await page.waitForSelector('.tal');
ok((await page.locator('.tal').count()) === 18, 'MAIS > TALHÕES: 18 talhões');
await page.fill('#b', 'Palmeira');
ok((await page.locator('.tal').count()) === 4, 'MAIS > TALHÕES: busca "Palmeira" = 4');
await page.getByRole('button', { name: /Voltar/ }).click();
await page.getByRole('button', { name: /Precisão da previsão/ }).click();
ok(/reanálise/i.test(await page.innerText('main')) && /não é chuva medida/i.test(await page.innerText('main')), 'MAIS > PRECISÃO: deixa claro que o histórico NÃO é pluviômetro');
await page.getByRole('button', { name: /Voltar/ }).click();
await page.getByRole('button', { name: /Ajustes/ }).click();
ok(/limites dos sem/i.test(await page.innerText('main')), 'MAIS > AJUSTES abre');
await page.getByRole('button', { name: /Voltar/ }).click();
await page.getByRole('button', { name: 'Escuro', exact: true }).click();
ok((await page.evaluate(() => document.documentElement.dataset.tema)) === 'escuro', 'APARÊNCIA: tema escuro');
await page.getByRole('button', { name: 'Claro', exact: true }).click();
ok((await page.evaluate(() => document.documentElement.dataset.tema)) === 'claro', 'APARÊNCIA: tema claro');
await page.getByRole('button', { name: 'Extra grande' }).click();
ok((await page.evaluate(() => document.documentElement.dataset.fonte)) === 'extra', 'APARÊNCIA: letras extra grandes');
await page.getByRole('button', { name: 'Automático' }).click();
await page.getByRole('button', { name: 'Grande', exact: true }).click();
await page.getByRole('button', { name: /Como usar/ }).click();
await page.waitForSelector('.guia');
ok(/Passo 1 de 3/.test(await page.innerText('.guia')), 'MAIS > COMO USAR reabre o guia no passo 1');
await page.getByRole('button', { name: 'Pular' }).click();

// ---- offline (service worker ativo)
await page.locator('nav.bar').getByRole('button', { name: 'Hoje' }).click();
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(1500);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.heroi');
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForSelector('.heroi', { timeout: 20000 }).catch(() => {});
const off = await page.innerText('body');
console.log('offline body:', off.replace(/\s+/g, ' ').slice(0, 140));
ok(/Sem sinal/i.test(off) && TEM_STATUS.test(off), 'OFFLINE: abre com o último dado salvo e avisa "sem sinal"');
await ctx.setOffline(false);

ok(erros.length === 0, `sem erros de console/página${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO OK');
process.exit(falhas.length ? 1 : 0);
