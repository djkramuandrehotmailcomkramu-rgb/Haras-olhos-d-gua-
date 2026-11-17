// Roda todos os cenários de ponta a ponta contra o build web em dist/.
//   npm run build:web && NODE_PATH=$(npm root -g) npm run e2e
const { servir, abrirNavegador } = require('./lib');
const specs = require('./specs');

(async () => {
  const { srv, url } = await servir();
  const browser = await abrirNavegador();
  let falhas = 0;
  const filtro = process.argv[2];
  for (const s of specs) {
    if (filtro && !s.nome.toLowerCase().includes(filtro.toLowerCase())) continue;
    const t0 = Date.now();
    try {
      await s.fn({ browser, url });
      console.log(`  ✓ ${s.nome} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    } catch (e) {
      falhas += 1;
      console.log(`  ✕ ${s.nome}\n      ${e.message.split('\n')[0]}`);
    }
  }
  await browser.close();
  srv.close();
  console.log(falhas ? `\n${falhas} cenário(s) com falha` : '\nTodos os cenários passaram');
  process.exit(falhas ? 1 : 0);
})();
