// Gera todos os ícones do GPSThomas a partir de um desenho SVG único.
// Uso: NODE_PATH=$(npm root -g) node tools/gerar-icones.js   (precisa do playwright)
const { chromium } = require('playwright');
const fs = require('fs');

/**
 * opcoes.fundo: 'arredondado' | 'quadrado' | 'nenhum'
 * opcoes.escala: tamanho do símbolo (1 = ocupa ~72% do ícone)
 * opcoes.mono: símbolo todo branco (Android monocromático)
 */
function svg({ fundo, escala = 1, mono = false }) {
  const bg =
    fundo === 'nenhum'
      ? ''
      : `<rect width="1024" height="1024" ${fundo === 'arredondado' ? 'rx="232"' : ''} fill="url(#fundo)"/>
         <rect width="1024" height="1024" ${fundo === 'arredondado' ? 'rx="232"' : ''} fill="url(#brilho)"/>
         <g fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="5">
           <path d="M-40 720 C 220 600, 420 820, 700 700 S 960 600, 1100 660"/>
           <path d="M-40 800 C 220 680, 420 900, 700 780 S 960 680, 1100 740"/>
           <path d="M-40 880 C 220 760, 420 980, 700 860 S 960 760, 1100 820"/>
           <path d="M-40 640 C 220 520, 420 740, 700 620 S 960 520, 1100 580"/>
         </g>`;
  const branco = '#FFFFFF';
  const campoFill = mono ? '#FFFFFF' : '#FFFFFF';
  const campoOp = mono ? 0.28 : 0.2;
  const pino = mono ? '#FFFFFF' : 'url(#ambar)';
  const miolo = mono ? '#000000' : '#2A2278';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="fundo" x1="120" y1="0" x2="900" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8B7DFF"/><stop offset=".55" stop-color="#5B4FE0"/><stop offset="1" stop-color="#2A2278"/>
    </linearGradient>
    <radialGradient id="brilho" cx=".25" cy=".12" r=".75">
      <stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ambar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFD166"/><stop offset="1" stop-color="#F0A01C"/>
    </linearGradient>
    <filter id="sombra" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#0B0830" flood-opacity=".45"/>
    </filter>
  </defs>
  ${bg}
  ${fundo === 'nenhum' ? '' : '<ellipse cx="512" cy="1000" rx="620" ry="300" fill="#000" fill-opacity=".16"/>'}
  <g transform="translate(512 512) scale(${escala * 1.07}) translate(-512 -512)">
    <g filter="${mono ? '' : 'url(#sombra)'}">
      <path d="M246 396 L520 262 L784 352 L812 640 L586 770 L284 700 Z" fill="${campoFill}" fill-opacity="${campoOp}" stroke="${branco}" stroke-width="40" stroke-linejoin="round"/>
      <g fill="${branco}">
        <circle cx="246" cy="396" r="40"/><circle cx="520" cy="262" r="40"/><circle cx="784" cy="352" r="40"/>
        <circle cx="812" cy="640" r="40"/><circle cx="586" cy="770" r="40"/><circle cx="284" cy="700" r="40"/>
      </g>
    </g>
    <g filter="${mono ? '' : 'url(#sombra)'}" transform="translate(500 330)">
      <path d="M0 330 C -120 215, -150 150, -150 95 A150 150 0 1 1 150 95 C 150 150, 120 215, 0 330 Z" fill="${pino}"/>
      <circle cx="0" cy="95" r="58" fill="${miolo}" ${mono ? 'fill-opacity="1"' : ''}/>
      ${mono ? '' : '<circle cx="0" cy="95" r="22" fill="#fff"/>'}
    </g>
  </g>
</svg>`;
}

const saidas = [
  // [arquivo, tamanho, opções, transparente]
  ['assets/icon.png', 1024, { fundo: 'quadrado', escala: 1 }, false],
  ['assets/splash-icon.png', 512, { fundo: 'nenhum', escala: 1 }, true],
  ['assets/android-icon-foreground.png', 1024, { fundo: 'nenhum', escala: 0.82 }, true],
  ['assets/android-icon-background.png', 1024, { fundo: 'quadrado', escala: 0.0001 }, false],
  ['assets/android-icon-monochrome.png', 1024, { fundo: 'nenhum', escala: 0.82, mono: true }, true],
  ['assets/favicon.png', 96, { fundo: 'arredondado', escala: 1 }, true],
  // web: nomes com versão (v2) para o celular trocar o ícone antigo
  ['public/icon-v3-192.png', 192, { fundo: 'arredondado', escala: 1 }, true],
  ['public/icon-v3-512.png', 512, { fundo: 'arredondado', escala: 1 }, true],
  ['public/icon-v3-maskable-512.png', 512, { fundo: 'quadrado', escala: 0.8 }, false],
  ['public/icon-v3-monochrome-512.png', 512, { fundo: 'nenhum', escala: 0.8, mono: true }, true],
  ['public/apple-touch-icon-v3.png', 180, { fundo: 'quadrado', escala: 1 }, false],
];

(async () => {
  fs.mkdirSync('assets', { recursive: true });
  fs.writeFileSync('assets/icone.svg', svg({ fundo: 'arredondado', escala: 1 }));
  const b = await chromium.launch();
  for (const [arq, tam, op, transp] of saidas) {
    const p = await b.newPage({ viewport: { width: tam, height: tam } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg(op).replace('width="1024" height="1024"', `width="${tam}" height="${tam}"`)}</body></html>`);
    await p.screenshot({ path: arq, omitBackground: transp });
    await p.close();
    console.log('ok', arq);
  }
  await b.close();
})();
