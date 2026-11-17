// Auditoria de acessibilidade (axe-core) e capturas de tela em 3 larguras, claro e escuro.
//   NODE_PATH=$(npm root -g) node e2e/auditoria.js
const fs = require('fs');
const path = require('path');
const { servir, abrirNavegador, novaPagina, importarKml, SAIDA } = require('./lib');

const TELAS = [
  ['medir', '/'], ['rotas', '/rotas'], ['talhoes', '/talhoes'], ['medicoes', '/medicoes'], ['mais', '/mais'],
  ['ajuda', '/ajuda'], ['campo-novo', '/campo/novo'],
];
const LARGURAS = [[360, 740], [412, 915], [768, 1024]];

(async () => {
  const { srv, url } = await servir(4181);
  const browser = await abrirNavegador();
  const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  fs.mkdirSync(path.join(SAIDA, 'telas'), { recursive: true });
  const problemas = [];

  for (const esquema of ['light', 'dark']) {
    for (const [w, h] of LARGURAS) {
      const p = await novaPagina(browser, { url, largura: w, altura: h, esquema });
      await importarKml(p, url);
      // um plano de campo para auditar as telas do plano também
      await p.ir('/campo/novo');
      await p.locator('[dir=auto]').getByText('Andropogon 92 ha').click();
      await p.getByText('Criar plano').click(); await p.waitForTimeout(1500);
      const idPlano = await p.evaluate(() => JSON.parse(localStorage.getItem('gpsthomas-dados')).state.campos[0].id);
      const idTalhao = await p.evaluate(() => JSON.parse(localStorage.getItem('gpsthomas-dados')).state.talhoes[0].id);
      const todas = [...TELAS, ['campo-plano', `/campo/${idPlano}`], ['talhao', `/talhao/${idTalhao}`]];
      for (const [nome, rota] of todas) {
        await p.ir(rota);
        await p.screenshot({ path: path.join(SAIDA, 'telas', `${nome}-${w}-${esquema}.png`) });
        await p.evaluate(axe);
        const r = await p.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }));
        for (const v of r.violations) {
          // contraste dentro do mapa de satélite não é controlável; ignora o conteúdo do Leaflet
          const nos = v.nodes.filter((n) => !/leaflet/.test(n.html) || v.id !== 'color-contrast');
          if (nos.length) problemas.push({ tela: nome, larg: w, esquema, id: v.id, impacto: v.impact, n: nos.length, exemplo: nos[0].html.slice(0, 140) });
        }
      }
      await p.ctx.close();
    }
  }
  await browser.close();
  srv.close();

  const agrupado = new Map();
  for (const q of problemas) {
    const k = `${q.id}|${q.tela}`;
    if (!agrupado.has(k)) agrupado.set(k, { ...q, casos: 1 }); else agrupado.get(k).casos += 1;
  }
  const lista = [...agrupado.values()].sort((a, b) => (a.impacto === 'critical' ? -1 : 0) - (b.impacto === 'critical' ? -1 : 0));
  fs.writeFileSync(path.join(SAIDA, 'axe.json'), JSON.stringify(lista, null, 2));
  console.log(`Violações únicas (tela × regra): ${lista.length}`);
  for (const q of lista.slice(0, 25)) console.log(`  [${q.impacto}] ${q.id} em ${q.tela} (${q.casos} casos): ${q.exemplo}`);
  process.exit(0);
})();
