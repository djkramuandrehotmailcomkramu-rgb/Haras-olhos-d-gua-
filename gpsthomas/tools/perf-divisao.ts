// Mede o tempo de dividir um talhão com muitos vértices:  npx tsx tools/perf-divisao.ts
import { dividirEmFaixas } from '../src/geo/dividir';
import type { Coord } from '../src/geo/medidas';

const KX = Math.cos((-15.78 * Math.PI) / 180) * 111319.49, KY = 111319.49;
const pt = (dx: number, dy: number): Coord => [-47.93 + dx / KX, -15.78 + dy / KY];

// contorno irregular (ondulado) de ~90 ha com N vértices
function talhao(n: number): Coord[] {
  const out: Coord[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 520 + 40 * Math.sin(a * 17) + 15 * Math.sin(a * 53);
    out.push(pt(Math.cos(a) * r * 1.6, Math.sin(a) * r * 0.8));
  }
  return out;
}

for (const n of [50, 500, 2000, 5000]) {
  const c = talhao(n);
  const t0 = Date.now();
  const d = dividirEmFaixas(c, { partes: 10 });
  const ms = Date.now() - t0;
  const soma = d.partes.reduce((s, p) => s + p.areaM2, 0);
  console.log(`${String(n).padStart(5)} vértices, 10 partes: ${String(ms).padStart(5)} ms  (soma/total = ${(soma / d.areaTotalM2).toFixed(5)})`);
}
