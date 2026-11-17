const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { novaPagina, importarKml, estado, check, BASE, KX, KY, pt, SAIDA } = require('./lib');

const doCard = (page, texto) => page.locator('[dir=auto]').getByText(texto);

async function criarPlanoPadrao(page, url) {
  await importarKml(page, url);
  await page.ir('/campo/novo');
  await doCard(page, 'Andropogon 92 ha').click();
  await doCard(page, 'Amendoim 72 ha').click();
  const mais = page.getByLabel('Mais uma parte');
  await mais.nth(0).click(); await mais.nth(1).click(); await mais.nth(1).click();
  await page.waitForTimeout(600);
  await page.getByText('Criar plano').click();
  await page.waitForTimeout(1600);
}

module.exports = [
  {
    nome: 'Importar KML e mostrar as áreas medidas',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await importarKml(p, url);
      const areas = await p.locator('text=/\\d+,\\d+ ha/').allTextContents();
      check(areas.some((a) => a.startsWith('91,8')), `área do Andropogon (${areas})`);
      check(areas.some((a) => a.startsWith('71,8')), `área do Amendoim (${areas})`);
      const e = await estado(p);
      check(e.talhoes.length === 2 && e.talhoes[0].fazenda === 'Lagoa Formosa', 'talhões salvos com a fazenda');
      check(p.erros.length === 0, `erros: ${p.erros}`);
    },
  },
  {
    nome: 'Medir por pontos no mapa e salvar como talhão',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await p.ir('/');
      for (const [x, y] of [[150, 300], [260, 300], [260, 420]]) { await p.mouse.click(x, y); await p.waitForTimeout(200); }
      check(await p.getByText('3 pontos').count() >= 1, 'contou 3 pontos');
      await p.getByText('Salvar', { exact: true }).last().click(); await p.waitForTimeout(700);
      await p.getByPlaceholder('Ex.: Talhão 07 – Várzea').fill('Talhão de teste');
      await p.getByText('Salvar como talhão').click(); await p.waitForTimeout(1400);
      const e = await estado(p);
      check(e.talhoes.length === 1 && e.talhoes[0].nome === 'Talhão de teste', 'talhão salvo');
      check(p.erros.length === 0, `erros: ${p.erros}`);
    },
  },
  {
    nome: 'Campo de sementes: 5 + 6 partes iguais, 9 divisas, 18 bandeirinhas',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await criarPlanoPadrao(p, url);
      const c = (await estado(p)).campos[0];
      check(c.partes.length === 11, `11 partes (${c.partes.length})`);
      check(c.divisas.length === 9, `9 divisas (${c.divisas.length})`);
      check(c.bandeiras.length === 18, `18 bandeirinhas (${c.bandeiras.length})`);
      const andro = c.partes.filter((x) => x.areaM2 > 150000 && x.areaM2 < 200000);
      check(andro.length === 5, `5 partes de ~18,4 ha (${andro.length})`);
      const soma = c.partes.reduce((s, x) => s + x.areaM2, 0) / 10000;
      check(Math.abs(soma - 163.64) < 0.3, `soma ${soma.toFixed(2)} ha`);
      check(p.erros.length === 0, `erros: ${p.erros}`);
    },
  },
  {
    nome: 'Hectares digitados: 16 ha por parte e a última com o resto',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await importarKml(p, url);
      await p.ir('/campo/novo');
      await doCard(p, 'Andropogon 92 ha').click();
      await p.getByText('Digitar hectares').click(); await p.waitForTimeout(400);
      const mais = p.getByLabel('Mais uma parte');
      await mais.nth(0).click(); await mais.nth(0).click(); await p.waitForTimeout(300); // 4 -> 6 partes
      await p.getByText('Aplicar a todas').click(); await p.waitForTimeout(700);
      const resto = await p.getByText(/o que sobra/).locator('xpath=following-sibling::*[1]').textContent();
      check(/11,[78]\d ha/.test(resto), `resto de ~11,8 ha (${resto})`);
      // passar do talhão -> erro e botão desabilitado
      await p.getByLabel(/Hectares da parte 1 de Andropogon/).fill('95'); await p.waitForTimeout(500);
      check(await p.getByText(/Passou .* ha/).count() >= 1, 'avisa que passou da área');
      // corrigir com vírgula
      await p.getByLabel(/Hectares da parte 1 de Andropogon/).fill('16,5'); await p.waitForTimeout(500);
      check(await p.getByText(/Passou/).count() === 0, 'sem aviso depois de corrigir');
      await p.getByText('Criar plano').click(); await p.waitForTimeout(1600);
      const c = (await estado(p)).campos[0];
      check(c.partes.length === 6, `6 partes (${c.partes.length})`);
      check(Math.abs(c.partes[0].areaM2 / 10000 - 16.5) < 0.05, `primeira parte 16,5 ha (${c.partes[0].areaM2 / 10000})`);
      check(Math.abs(c.partes[1].areaM2 / 10000 - 16) < 0.05, 'segunda parte 16 ha');
      check(c.config[0].modo === 'manual', 'plano guarda o modo manual');
      check(p.erros.length === 0, `erros: ${p.erros}`);
    },
  },
  {
    nome: 'Ajustar hectares de um plano existente mantém variedades e bandeirinhas',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await criarPlanoPadrao(p, url);
      await p.getByPlaceholder(/Variedade 1/).fill(Array.from({ length: 10 }, (_, i) => `Variedade ${i + 1}`).join('\n'));
      await p.getByText('Salvar e distribuir nas partes').click(); await p.waitForTimeout(600);
      // marca a 1ª bandeirinha como colocada direto no estado e reabre
      await p.evaluate(() => { const k = 'gpsthomas-dados'; const j = JSON.parse(localStorage.getItem(k)); j.state.campos[0].bandeiras[0].colocada = true; localStorage.setItem(k, JSON.stringify(j)); });
      const id = (await estado(p)).campos[0].id;
      await p.ir(`/campo/novo?editar=${id}`);
      check(await p.getByText('Ajustar hectares e divisas').count() >= 1, 'abriu em modo de edição');
      await p.getByText('Salvar alterações').click(); await p.waitForTimeout(1500);
      const c = (await estado(p)).campos[0];
      check(c.id === id && c.variedades.length === 10, 'mesmo plano, variedades mantidas');
      check(c.bandeiras[0].colocada === true, 'bandeirinha colocada continua marcada');
      check(c.partes.every((x) => x.variedade), 'todas as partes mantêm variedade');
    },
  },
  {
    nome: 'Meta por variedade e conferência de áreas',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await criarPlanoPadrao(p, url);
      await p.getByPlaceholder(/Variedade 1/).fill(Array.from({ length: 10 }, (_, i) => `Variedade ${i + 1}`).join('\n'));
      await p.getByText('Salvar e distribuir nas partes').click(); await p.waitForTimeout(600);
      await p.getByPlaceholder('Ex.: 16').fill('16'); await p.waitForTimeout(600);
      check(await p.getByText(/\+2,4 ha|\+2,3 ha/).count() >= 1, 'selo de diferença (18,4 ha contra meta de 16)');
      check(await p.getByText('Conferência de áreas').count() >= 1, 'card de conferência');
      const e = await estado(p);
      check(e.campos[0].metaHa === 16, 'meta salva');
    },
  },
  {
    nome: 'Gerar PDF do plano (arquivo válido com 11 partes)',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await criarPlanoPadrao(p, url);
      await p.getByText('Gerar PDF do plano').scrollIntoViewIfNeeded();
      const [dl] = await Promise.all([p.waitForEvent('download'), p.getByText('Gerar PDF do plano').click()]);
      const arq = path.join(SAIDA, 'plano.pdf');
      await dl.saveAs(arq);
      check(fs.statSync(arq).size > 20000, 'PDF com conteúdo');
      check(fs.readFileSync(arq).slice(0, 5).toString() === '%PDF-', 'assinatura PDF');
      try {
        const txt = execFileSync('pdftotext', ['-layout', arq, '-'], { encoding: 'utf8' });
        check(/Plano de campo de sementes/.test(txt), 'título no PDF');
        check(/Bandeirinhas \(pontos das divisas\)/.test(txt), 'lista de bandeirinhas no PDF');
        check(/Conferência de áreas/.test(txt), 'conferência no PDF');
      } catch (e) { if (e instanceof Error && e.name === 'Falha') throw e; }
    },
  },
  {
    nome: 'Tocar na bandeirinha, ser guiado e confirmar',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await criarPlanoPadrao(p, url);
      await p.getByText(/Andropogon .* divisa 3 · ponto 2/).first().scrollIntoViewIfNeeded();
      await p.getByText(/Andropogon .* divisa 3 · ponto 2/).first().click(); await p.waitForTimeout(800);
      check(await p.getByText('Guiar até esta bandeira').count() === 1, 'folha de ações');
      check(await p.getByText('Rota por estrada até aqui').count() === 1, 'opção de rota por estrada');
      await p.getByText('Guiar até esta bandeira').click(); await p.waitForTimeout(1800);
      const alvo = await p.evaluate(() => JSON.parse(localStorage.getItem('gpsthomas-dados')).state.campos[0].bandeiras.find((b) => /divisa 3 · ponto 2/.test(b.rotulo)).coord);
      const esperado = Math.hypot((alvo[0] - BASE[0]) * KX, (alvo[1] - (BASE[1] + 5 / KY)) * KY);
      const txt = await p.getByLabel('Distância até o ponto').textContent();
      const dist = parseFloat(txt.replace(/\./g, '').replace(',', '.'));
      check(Math.abs(dist - esperado) < 25, `distância ${txt} ~ ${esperado.toFixed(0)} m`);
      // chegar ao ponto
      for (const f of [0.7, 0.97, 1]) {
        const lat = BASE[1] + 5 / KY + (alvo[1] - (BASE[1] + 5 / KY)) * f, lon = BASE[0] + (alvo[0] - BASE[0]) * f;
        await p.ctx.setGeolocation({ latitude: lat, longitude: lon, accuracy: 4 }); await p.waitForTimeout(1300);
      }
      check(await p.getByText(/Chegou! Coloque/).count() >= 1, 'avisou que chegou');
      await p.getByText('Bandeira colocada ✓').click(); await p.waitForTimeout(700);
      check((await estado(p)).campos[0].bandeiras.filter((b) => b.colocada).length === 1, '1 bandeirinha colocada');
    },
  },
  {
    nome: 'Rotas: busca, escolha da rota e navegação (serviços simulados)',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      const g = 1 / 111132; const at = (dx, dy) => [BASE[0] + dx * g * 1.0386, BASE[1] + dy * g];
      const geom = [at(0, 0), at(0, 500), at(0, 1000), at(500, 1000), at(1000, 1000)];
      const osrm = { code: 'Ok', routes: [
        { distance: 2000, duration: 150, geometry: { coordinates: geom }, legs: [{ annotation: { maxspeed: [{ speed: 50, unit: 'km/h' }, { speed: 50, unit: 'km/h' }, { speed: 80, unit: 'km/h' }, { speed: 80, unit: 'km/h' }] }, steps: [
          { distance: 1000, duration: 75, name: 'BR-050', ref: 'BR-050', maneuver: { type: 'depart', location: geom[0] } },
          { distance: 1000, duration: 75, name: 'Av. Brasil', maneuver: { type: 'turn', modifier: 'right', location: geom[2] } },
          { distance: 0, duration: 0, name: '', maneuver: { type: 'arrive', location: geom[4] } }] }] }] };
      const cors = { 'access-control-allow-origin': '*' };
      await p.route(/nominatim/, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify([{ lat: String(geom[4][1]), lon: String(geom[4][0]), name: 'Fazenda Boa Vista', display_name: 'Fazenda Boa Vista, Goiás, Brasil' }]) }));
      await p.route(/router\.project-osrm/, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(osrm) }));
      await p.ir('/rotas');
      await p.getByLabel('Buscar destino').fill('Fazenda'); await p.waitForTimeout(1600);
      await p.getByText('Fazenda Boa Vista', { exact: true }).first().click(); await p.waitForTimeout(1500);
      check(await p.getByText('via BR-050').count() === 1, 'mostrou a rota');
      await p.getByText('Iniciar navegação').click(); await p.waitForTimeout(700);
      let y = 0;
      for (let i = 0; i < 6; i++) { y += 40; const q = at(0, y); await p.ctx.setGeolocation({ latitude: q[1], longitude: q[0], accuracy: 5 }); await p.waitForTimeout(1000); }
      check(await p.getByText(/Vire à direita/).count() >= 1, 'banner da próxima manobra');
      check(await p.getByLabel(/Velocidade \d+ quil/).count() === 1, 'velocímetro');
      check(await p.locator('.gt-veic').count() === 1, 'ícone do veículo no mapa');
      await p.getByText('Sair', { exact: true }).click(); await p.waitForTimeout(500);
      check(p.erros.length === 0, `erros: ${p.erros}`);
    },
  },
  {
    nome: 'Recolher e mostrar o painel do mapa (barra de abas some e volta)',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await p.ir('/');
      await p.getByLabel('Recolher painel').click(); await p.waitForTimeout(1000);
      check(await p.getByLabel('Mostrar controles').count() === 1, 'pílula para mostrar');
      await p.getByLabel('Mostrar controles').click(); await p.waitForTimeout(900);
      check(await p.getByText('Salvar', { exact: true }).last().isVisible(), 'controles de volta');
    },
  },
  {
    nome: 'Backup completo: baixar, apagar e restaurar',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await importarKml(p, url);
      const [dl] = await Promise.all([p.waitForEvent('download'), p.getByText('Baixar backup completo').first().click()]);
      const arq = path.join(SAIDA, 'backup.json');
      await dl.saveAs(arq);
      const b = JSON.parse(fs.readFileSync(arq, 'utf8'));
      check(b.app === 'GPSThomas' && b.dados.talhoes.length === 2, 'backup com 2 talhões');
      await p.getByText('Apagar todos os dados').click(); await p.waitForTimeout(600);
      check((await estado(p)).talhoes.length === 0, 'dados apagados');
      const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.getByText('Restaurar de um backup').click()]);
      await fc.setFiles(arq); await p.waitForTimeout(900);
      check((await estado(p)).talhoes.length === 2, 'dados restaurados');
      // arquivo inválido não apaga nada
      fs.writeFileSync(path.join(SAIDA, 'ruim.json'), '{"app":"Outro"}');
      const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.getByText('Restaurar de um backup').click()]);
      await fc2.setFiles(path.join(SAIDA, 'ruim.json')); await p.waitForTimeout(700);
      check((await estado(p)).talhoes.length === 2, 'backup inválido não altera os dados');
    },
  },
  {
    nome: 'Ajuda e sobre abre com versão e guia',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await p.ir('/ajuda');
      check(await p.getByText('Versão 1.0.0').count() === 1, 'mostra a versão 1.0.0');
      await p.getByText('Campo de sementes').first().click(); await p.waitForTimeout(400);
      check(await p.getByText(/Digitar hectares/).count() >= 1, 'guia explica hectares digitados');
    },
  },
  {
    nome: 'Dados antigos (versão 0) são migrados sem perder nada',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await p.addInitScript(() => localStorage.setItem('gpsthomas-dados', JSON.stringify({ state: { talhoes: [{ id: 'a', nome: 'Antigo', fazenda: 'F', cultura: 'Soja', safra: '2025/26', contorno: [[-47.93, -15.78], [-47.92, -15.78], [-47.92, -15.77]], criadoEm: 1 }], medicoes: [] }, version: 0 })));
      await p.ir('/talhoes');
      check(await p.getByText('Antigo').count() >= 1, 'talhão antigo aparece');
      const e = await estado(p);
      check(Array.isArray(e.campos) && Array.isArray(e.viagens), 'campos e viagens criados na migração');
    },
  },
  {
    nome: 'PWA: manifest válido, service worker ativo e abertura sem internet',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await p.goto(`${url}/`); await p.waitForTimeout(1500);
      check(await p.evaluate(() => document.documentElement.lang) === 'pt-BR', 'idioma pt-BR');
      const href = await p.evaluate(() => document.querySelector('link[rel=manifest]')?.getAttribute('href'));
      check(href === '/manifest.webmanifest', `link do manifest (${href})`);
      const m = await p.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
      check(m.display === 'standalone' && m.start_url === '/' && m.id === '/', 'manifest standalone com id');
      check(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512') && m.icons.some((i) => i.purpose === 'maskable'), 'ícones 192, 512 e maskable');
      for (const ic of m.icons) {
        const st = await p.evaluate(async (u) => (await fetch(u)).status, ic.src);
        check(st === 200, `ícone ${ic.src} existe`);
      }
      check(m.shortcuts?.length >= 3, 'atalhos do app');
      // service worker ativo e controlando a página
      await p.evaluate(() => navigator.serviceWorker.ready);
      await p.reload(); await p.waitForTimeout(2500); // já controlada: guarda o app em cache
      check(await p.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controla a página');
      // sem internet: o app ainda abre
      await p.ctx.setOffline(true);
      await p.reload(); await p.waitForTimeout(2500);
      check(await p.getByRole('tab', { name: 'Medir' }).count() === 1, 'app abre sem internet');
      check(await p.getByText(/Sem internet/).count() >= 1, 'avisa que está sem internet');
      await p.ctx.setOffline(false);
      await p.waitForTimeout(800);
    },
  },
  {
    nome: 'Aviso de nova versão aparece e oferece Atualizar',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await p.ir('/');
      await p.evaluate(() => window.dispatchEvent(new CustomEvent('gt-nova-versao'))); await p.waitForTimeout(600);
      check(await p.getByText('Nova versão disponível').count() === 1, 'banner de nova versão');
      check(await p.getByRole('button', { name: 'Atualizar o aplicativo' }).count() === 1, 'botão Atualizar');
    },
  },
];
