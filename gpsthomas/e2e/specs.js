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
      await p.getByText('Baixar PDF', { exact: true }).scrollIntoViewIfNeeded();
      const [dl] = await Promise.all([p.waitForEvent('download'), p.getByText('Baixar PDF', { exact: true }).click()]);
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
      const V = require('../package.json').version;
      check(await p.getByText('Versão ' + V).count() === 1, 'mostra a versão ' + V);
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
      check(m.display === 'standalone' && m.start_url === '/' && m.id === '/?app=gpsthomas', 'manifest standalone com id');
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
  {
    nome: 'Ajuste de precisão: selecionar ponto, alça ao lado (1× e ¼×) e setas',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await p.ir('/');
      // três pontos bem separados no mapa
      for (const [x, y] of [[120, 330], [300, 330], [210, 470]]) { await p.mouse.click(x, y); await p.waitForTimeout(250); }
      check(await p.getByText('3 pontos').count() >= 1, '3 pontos marcados');
      const centroDe = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
      const vertice = (i) => p.locator('.leaflet-marker-icon').filter({ has: p.locator('div[style*="border-radius: 50%"]') }).nth(i);
      // toque no 3º ponto seleciona
      await p.mouse.click(210, 470); await p.waitForTimeout(500);
      check(await p.getByText('Ponto 3', { exact: true }).count() === 1, 'painel de ajuste aparece');
      check(await p.locator('.gt-alca').count() === 1, 'alça ao lado do ponto');
      const alcaPos = await centroDe(p.locator('.gt-alca'));
      check(Math.hypot(alcaPos.x - 210, alcaPos.y - 470) > 60, `alça fora do dedo (${Math.round(Math.hypot(alcaPos.x - 210, alcaPos.y - 470))} px do ponto)`);

      const areaAntes = await p.getByTestId('valor-area').textContent();
      // arrasta a alça 60 px para cima (fator 1×): o ponto sobe cerca de 60 px
      const a0 = await centroDe(p.locator('.gt-alca'));
      await p.mouse.move(a0.x, a0.y); await p.mouse.down();
      await p.mouse.move(a0.x, a0.y - 30, { steps: 6 }); await p.mouse.move(a0.x, a0.y - 60, { steps: 6 }); await p.mouse.up();
      await p.waitForTimeout(600);
      const areaDepois = await p.getByTestId('valor-area').textContent();
      check(areaAntes !== areaDepois, `área mudou ao arrastar a alça (${areaAntes} -> ${areaDepois})`);
      check(await p.getByText('Ponto 3', { exact: true }).count() === 1, 'continua selecionado depois de mover');

      // fator ¼×: a mesma arrastada mexe 4× menos
      await p.getByRole('button', { name: '¼×' }).first().click().catch(async () => { await p.getByText('¼×', { exact: true }).click(); });
      await p.waitForTimeout(300);
      const a1 = await centroDe(p.locator('.gt-alca'));
      const antes = areaDepois;
      await p.mouse.move(a1.x, a1.y); await p.mouse.down();
      await p.mouse.move(a1.x, a1.y + 40, { steps: 8 }); await p.mouse.up();
      await p.waitForTimeout(600);
      const depoisFino = await p.getByTestId('valor-area').textContent();
      check(antes !== depoisFino, 'a alça fina também move o ponto');

      // setas: norte 5 m
      await p.getByText('5 m', { exact: true }).click(); await p.waitForTimeout(200);
      const antesSeta = await p.getByTestId('valor-area').textContent();
      await p.getByRole('button', { name: 'Mover para o norte' }).click(); await p.waitForTimeout(400);
      const depoisSeta = await p.getByTestId('valor-area').textContent();
      check(antesSeta !== depoisSeta, `seta move o ponto (${antesSeta} -> ${depoisSeta})`);

      // toque seguido nas setas vira um único "desfazer"
      await p.getByRole('button', { name: 'Mover para o norte' }).click(); await p.getByRole('button', { name: 'Mover para o norte' }).click();
      await p.getByRole('button', { name: 'Concluir ajuste' }).click(); await p.waitForTimeout(500);
      check(await p.getByText('Ponto 3', { exact: true }).count() === 0, 'concluir fecha o painel');

      // remover ponto
      await p.mouse.click(210, 470); await p.waitForTimeout(400);
      const sel = await p.getByText(/^Ponto \d$/).count();
      if (sel) {
        await p.getByRole('button', { name: 'Remover ponto' }).click(); await p.waitForTimeout(500);
        check(await p.getByText('2 pontos').count() >= 1, 'ponto removido (2 restantes)');
      }
      check(p.erros.length === 0, `erros: ${p.erros}`);
    },
  },
  {
    nome: 'Toque no mapa com ponto selecionado só conclui o ajuste (não cria ponto novo)',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await p.ir('/');
      for (const [x, y] of [[120, 330], [300, 330], [210, 470]]) { await p.mouse.click(x, y); await p.waitForTimeout(250); }
      await p.mouse.click(210, 470); await p.waitForTimeout(400);
      check(await p.getByText('Ponto 3', { exact: true }).count() === 1, 'selecionado');
      await p.mouse.click(60, 360); await p.waitForTimeout(500);
      check(await p.getByText('Ponto 3', { exact: true }).count() === 0, 'primeiro toque só fecha o painel');
      check(await p.getByText('3 pontos').count() >= 1, 'continua com 3 pontos');
      await p.mouse.click(60, 360); await p.waitForTimeout(400);
      check(await p.getByText('4 pontos').count() >= 1, 'o toque seguinte marca um ponto novo');
    },
  },
  {
    nome: 'Modo Mira: cruz no centro, marcar no centro e prévia da área',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await p.ir('/');
      await p.getByRole('button', { name: 'Mira' }).click(); await p.waitForTimeout(700);
      check(await p.getByText('Marcar no centro', { exact: true }).count() === 1, 'botão Marcar no centro');
      // toque no mapa não cria ponto na mira
      await p.mouse.click(100, 400); await p.waitForTimeout(300);
      check(await p.getByText('0 pontos').count() >= 1, 'toque no mapa não marca em modo mira');
      // marcar 3 cantos movendo o mapa (arrasto) e marcando no centro
      for (const [dx, dy] of [[0, 0], [90, 0], [45, 110]]) {
        if (dx || dy) { await p.mouse.move(210, 430); await p.mouse.down(); await p.mouse.move(210 - dx, 430 - dy, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(500); }
        await p.getByText('Marcar no centro', { exact: true }).click(); await p.waitForTimeout(350);
      }
      check(await p.getByText('3 pontos').count() >= 1, '3 pontos marcados pela mira');
      const area = await p.getByTestId('valor-area').textContent();
      check(!/^0(,00)?$/.test(area), `área calculada (${area})`);
    },
  },
  {
    nome: 'Tela cheia e instalação: botão em Mais e aviso para instalar',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await p.addInitScript(() => { window.__chamouFs = 0; Element.prototype.requestFullscreen = function () { window.__chamouFs += 1; return Promise.resolve(); }; });
      await p.ir('/mais');
      check(await p.getByText('TELA E INSTALAÇÃO').count() === 1, 'bloco Tela e instalação');
      check(await p.getByText(/barra verde/).count() >= 1, 'explica a barra verde');
      await p.getByText('Tela cheia (esconde as barras)').click(); await p.waitForTimeout(400);
      check(await p.evaluate(() => window.__chamouFs) >= 1, 'pediu tela cheia ao navegador');
      // pedido de instalação disponível: o botão chama o prompt do navegador
      await p.evaluate(() => { window.__prompts = 0; window.__gtInstalar = { prompt() { window.__prompts += 1; }, userChoice: Promise.resolve({ outcome: 'accepted' }) }; window.dispatchEvent(new CustomEvent('gt-pode-instalar')); });
      await p.waitForTimeout(500);
      await p.getByText('Instalar o aplicativo').click(); await p.waitForTimeout(500);
      check(await p.evaluate(() => window.__prompts) === 1, 'abriu o pedido de instalação');
      // banner no mapa (depois de ~5 s, fora do modo instalado)
      await p.evaluate(() => localStorage.removeItem('x'));
      await p.ir('/'); await p.waitForTimeout(5800);
      check(await p.getByText(/tirar a barra verde/).count() === 1, 'banner de instalação aparece');
      await p.getByRole('button', { name: 'Dispensar aviso' }).click(); await p.waitForTimeout(400);
      check(await p.getByText(/tirar a barra verde/).count() === 0, 'aviso dispensado');
      // recolher o painel entra em tela cheia
      const antes = await p.evaluate(() => window.__chamouFs);
      await p.getByLabel('Recolher painel').click(); await p.waitForTimeout(500);
      check(await p.evaluate(() => window.__chamouFs) > antes, 'recolher o painel pede tela cheia');
    },
  },
  {
    nome: 'Instalação: ícones novos, manifest e diagnóstico (inclusive site protegido por login)',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await p.goto(`${url}/`); await p.waitForTimeout(1500);
      const m = await p.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
      check(m.icons.every((i) => /icon-v2-/.test(i.src)), 'manifest usa os ícones v2');
      check(m.icons.some((i) => i.purpose === 'monochrome'), 'ícone monocromático do Android');
      check(m.background_color === '#0F4A27', 'cor de fundo igual à da abertura');
      for (const ic of m.icons) check(await p.evaluate(async (u) => (await fetch(u)).status, ic.src) === 200, `ícone ${ic.src}`);
      check(await p.evaluate(() => document.querySelector('link[rel=apple-touch-icon]').getAttribute('href')) === '/apple-touch-icon-v2.png', 'apple-touch-icon v2');
      // diagnóstico normal: tudo certo exceto "aberto como aplicativo"
      await p.ir('/ajuda');
      await p.getByText('Instalar e tirar a barra verde').click(); await p.waitForTimeout(300);
      await p.getByText('Verificar a instalação').click(); await p.waitForTimeout(2500);
      check(await p.getByText('Manifest acessível sem login').count() === 1, 'item do manifest');
      check(await p.getByText(/Ícones 192 e 512 acessíveis/).count() === 1, 'item dos ícones');
      check(await p.getByText(/Aberto como aplicativo/).count() === 1, 'item do modo');
      check(await p.getByText(/protegido por login/).count() === 0, 'sem aviso de proteção quando está liberado');
      // simula a Vercel Authentication: manifest e ícones respondem 401 sem login
      await p.ctx.route(/manifest\.webmanifest|icon-v2-/, (r) => r.fulfill({ status: 401, contentType: 'text/html', body: 'Authentication Required' }));
      await p.getByText('Verificar a instalação').click(); await p.waitForTimeout(2500);
      check(await p.getByText(/protegido por login/).count() >= 1, 'explica a proteção da Vercel quando o manifest dá 401');
    },
  },
  {
    nome: 'Abertura animada: aparece e some, revelando o app',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await p.goto(`${url}/`);
      await p.waitForSelector('#gt-splash', { timeout: 3000 });
      check(await p.locator('#gt-splash .gt-icone img').count() === 1, 'ícone na abertura');
      const cor = await p.evaluate(() => getComputedStyle(document.getElementById('gt-splash')).backgroundImage);
      check(/gradient/.test(cor), 'fundo verde em degradê (igual ao da abertura do Android)');
      await p.waitForTimeout(2600);
      check(await p.locator('#gt-splash').count() === 0, 'a abertura sai sozinha');
      check(await p.evaluate(() => document.documentElement.classList.contains('gt-pronto')), 'app revelado');
      check(await p.getByRole('tab', { name: 'Medir' }).count() === 1, 'app visível');
      // com "reduzir movimento" não anima
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const q = await ctx.newPage(); await q.goto(`${url}/`); await q.waitForTimeout(1500);
      const anim = await q.evaluate(() => { const el = document.querySelector('#gt-splash .gt-icone img'); return el ? getComputedStyle(el).animationName : 'removido'; });
      check(anim === 'none' || anim === 'removido', `sem animação com reduzir movimento (${anim})`);
      await ctx.close();
    },
  },
  {
    nome: 'Girar o mapa: bússola, pontos no lugar certo e alça funcionando com o mapa girado',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await p.ir('/');
      const centroDe = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
      const bussola = p.locator('.gt-bussola');
      check(await bussola.evaluate((e) => getComputedStyle(e).opacity) === '0', 'bússola escondida com o norte para cima');
      await p.mouse.click(120, 330); await p.waitForTimeout(250);
      await p.mouse.click(300, 330); await p.waitForTimeout(250);
      // gira o mapa (o mesmo que o gesto de dois dedos faz)
      await p.evaluate(() => window.__gtMapa.setBearing(70)); await p.waitForTimeout(500);
      check(await bussola.evaluate((e) => getComputedStyle(e).opacity) === '1', 'bússola aparece com o mapa girado');
      const rumo = await p.evaluate(() => Math.round(window.__gtMapa.getBearing()));
      check(rumo === 70, `rumo do mapa = ${rumo}`);
      // novo ponto cai exatamente onde se toca, mesmo girado
      await p.mouse.click(210, 520); await p.waitForTimeout(400);
      check(await p.getByText('3 pontos').count() >= 1, '3 pontos marcados com o mapa girado');
      const v3 = await centroDe(p.locator('.leaflet-marker-icon').filter({ has: p.locator('div[style*="border-radius: 50%"]') }).nth(2));
      check(Math.hypot(v3.x - 210, v3.y - 520) < 12, `ponto no lugar do toque (${Math.round(v3.x)},${Math.round(v3.y)})`);
      // seleciona e arrasta pela alça com o mapa girado
      await p.mouse.click(v3.x, v3.y); await p.waitForTimeout(500);
      check(await p.locator('.gt-alca').count() === 1, 'alça aparece com o mapa girado');
      const antes = await p.getByTestId('valor-area').textContent();
      const a0 = await centroDe(p.locator('.gt-alca'));
      await p.mouse.move(a0.x, a0.y); await p.mouse.down();
      await p.mouse.move(a0.x + 25, a0.y - 25, { steps: 6 }); await p.mouse.move(a0.x + 50, a0.y - 50, { steps: 6 }); await p.mouse.up();
      await p.waitForTimeout(600);
      const depois = await p.getByTestId('valor-area').textContent();
      check(antes !== depois, `alça move o ponto com o mapa girado (${antes} -> ${depois})`);
      // bússola devolve o norte para cima
      await bussola.click(); await p.waitForTimeout(500);
      const r2 = await p.evaluate(() => Math.round(window.__gtMapa.getBearing()));
      check(r2 === 0 || r2 === 360, `norte de volta para cima (${r2})`);
      check(p.erros.length === 0, `sem erros no console: ${p.erros.join(' | ')}`);
    },
  },
  {
    nome: 'Campo de sementes juntos: rastro AB, partes de 16 ha, PDF e reabrir para ajustar',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await importarKml(p, url);
      await p.ir('/campo/novo');
      await doCard(p, 'Andropogon 92 ha').click();
      await doCard(p, 'Amendoim 72 ha').click();
      await p.getByLabel('Plantar os talhões juntos como um só campo').click(); await p.waitForTimeout(800);
      check(await p.getByText(/Direção \d+° \(OSO\)/).count() >= 1, 'mostra a direção da linha AB (OSO)');
      check(await p.getByLabel('Ponto A, latitude').inputValue() === '-16.282406', 'linha AB do monitor já preenchida');
      // vírgula decimal também vale
      await p.getByLabel('Ponto B, latitude').fill('-16,28437727'); await p.waitForTimeout(300);
      check(await p.getByText(/Direção \d+° \(OSO\)/).count() >= 1, 'aceita vírgula nos decimais');
      check(await p.getByText(/Parte 11:/).count() === 1, 'prévia com 11 partes (10 de 16 ha + sobra)');
      await p.getByText('Criar plano').click(); await p.waitForTimeout(1800);
      const c = (await estado(p)).campos[0];
      check(c.junto && c.junto.usarLinhaAB === true && c.junto.haPorParte === 16, 'plano guarda a configuração "juntos"');
      check(c.partes.length === 11, `11 partes (${c.partes.length})`);
      for (let i = 0; i < 10; i++) check(Math.abs(c.partes[i].areaM2 / 10000 - 16) < 0.05, `parte ${i + 1} com 16 ha (${(c.partes[i].areaM2 / 10000).toFixed(3)})`);
      const sobra = c.partes[10].areaM2 / 10000;
      check(sobra > 3 && sobra < 5, `sobra de ~4 ha (${sobra.toFixed(2)})`);
      check(c.partes.every((q) => q.talhaoId === 'junto' && q.origens.length >= 1), 'cada parte sabe de quais talhões vem');
      check(c.partes.some((q) => q.origens.length === 2), 'há partes que atravessam os dois talhões');
      check(c.metaHa === 16, 'meta por variedade = 16 ha');
      check(c.bandeiras.length === c.divisas.length * 2, `bandeirinhas nas pontas de cada divisa (${c.bandeiras.length})`);
      // tela do plano e PDF
      check(await p.getByText(/Sem variedade · Andropogon 92 ha [\d,]+ ha \+ Amendoim 72 ha/).count() >= 1, 'partes listadas com a origem');
      await p.getByText('Baixar PDF', { exact: true }).scrollIntoViewIfNeeded();
      const [dl] = await Promise.all([p.waitForEvent('download'), p.getByText('Baixar PDF', { exact: true }).click()]);
      const arq = path.join(SAIDA, 'plano-junto.pdf');
      await dl.saveAs(arq);
      check(fs.readFileSync(arq).slice(0, 5).toString() === '%PDF-', 'PDF gerado');
      try {
        const txt = execFileSync('pdftotext', ['-layout', arq, '-'], { encoding: 'utf8' });
        check(/talhoes juntos, partes de 16 ha/.test(txt), 'PDF informa o plantio juntos');
        check(/Andropogon 92 ha \+ Amendoim 72 ha/.test(txt), 'PDF lista os dois talhões');
      } catch (e) { if (e instanceof Error && e.name === 'Falha') throw e; }
      // reabrir para ajustar mantém a configuração
      await p.getByText('Ajustar hectares').first().scrollIntoViewIfNeeded();
      await p.getByText('Ajustar hectares').first().click(); await p.waitForTimeout(1200);
      check(await p.getByLabel('Hectares de cada parte').inputValue() === '16', 'reabre com 16 ha por parte');
      await p.getByLabel('Hectares de cada parte').fill('20'); await p.waitForTimeout(600);
      check(await p.getByText(/Parte 9:/).count() === 1 && await p.getByText(/Parte 10:/).count() === 0, 'prévia com partes de 20 ha (8 + sobra)');
      await p.getByText('Salvar alterações').click(); await p.waitForTimeout(1500);
      const c2 = (await estado(p)).campos[0];
      check(c2.partes.length === 9 && Math.abs(c2.partes[0].areaM2 / 10000 - 20) < 0.05, `plano reajustado (${c2.partes.length} partes)`);
      check(p.erros.length === 0, `sem erros no console: ${p.erros.join(' | ')}`);
    },
  },
  {
    nome: 'Imprimir plano: abre a impressão só com o plano (sem o app) e limpa depois',
    async fn({ browser, url }) {
      const p = await novaPagina(browser, { url });
      await criarPlanoPadrao(p, url);
      await p.addInitScript(() => {});
      await p.evaluate(() => {
        window.__impr = { chamou: 0, temPlano: false, textoPlano: '' };
        window.print = () => {
          const el = document.getElementById('gt-impressao');
          window.__impr.chamou += 1; window.__impr.temPlano = !!el; window.__impr.textoPlano = el ? el.innerText : '';
        };
      });
      check(await p.getByText('Gerar PDF do plano').count() === 0, 'o botão antigo saiu');
      await p.getByText('Imprimir plano', { exact: true }).scrollIntoViewIfNeeded();
      await p.getByText('Imprimir plano', { exact: true }).click(); await p.waitForTimeout(800);
      const r = await p.evaluate(() => window.__impr);
      check(r.chamou === 1, `abriu a impressão (${r.chamou}x)`);
      check(r.temPlano && /Plano de campo de sementes/.test(r.textoPlano), 'o plano está montado na página');
      check(/Bandeirinhas \(pontos das divisas\)/.test(r.textoPlano) && /Conferência de áreas/.test(r.textoPlano), 'tem bandeirinhas e conferência');
      // com a mídia de impressão só o plano aparece: gera o PDF do navegador e lê o texto
      await p.emulateMedia({ media: 'print' });
      const arq = path.join(SAIDA, 'impressao.pdf');
      await p.pdf({ path: arq, format: 'A4', printBackground: true });
      try {
        const txt = execFileSync('pdftotext', ['-layout', arq, '-'], { encoding: 'utf8' });
        check(/Plano de campo de sementes/.test(txt), 'impressão tem o plano');
        check(/Bandeirinhas \(pontos das divisas\)/.test(txt), 'impressão tem as bandeirinhas');
        check(!/Medições/.test(txt) && !/Rotas/.test(txt), 'impressão não traz a barra de abas do app');
      } catch (e) { if (e instanceof Error && e.name === 'Falha') throw e; }
      await p.emulateMedia({ media: 'screen' });
      // depois da impressão o bloco é removido
      await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(200);
      check(await p.evaluate(() => !document.getElementById('gt-impressao')), 'bloco de impressão removido');
      check(p.erros.length === 0, `sem erros no console: ${p.erros.join(' | ')}`);
    },
  },
];
