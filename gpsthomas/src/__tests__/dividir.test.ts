import { dividirEmFaixas, pontosDeDivisa, anguloLadoMaisLongo } from '../geo/dividir';
import { areaM2, type Coord } from '../geo/medidas';

const KX = Math.cos((-15.78 * Math.PI) / 180) * 111320;
const KY = 110574;
const base: Coord = [-47.93, -15.78];
const pt = (dx: number, dy: number): Coord => [base[0] + dx / KX, base[1] + dy / KY];

// retângulo de 92 ha: 2000 m x 460 m (lado longo no eixo leste-oeste)
const andropogon: Coord[] = [pt(0, 0), pt(2000, 0), pt(2000, 460), pt(0, 460)];
// 72 ha: 1200 m x 600 m
const amendoim: Coord[] = [pt(0, 0), pt(1200, 0), pt(1200, 600), pt(0, 600)];

describe('dividir em faixas', () => {
  it('Andropogon de 92 ha em 5 partes iguais de 18,4 ha', () => {
    const d = dividirEmFaixas(andropogon, { partes: 5 });
    expect(d.partes).toHaveLength(5);
    expect(d.areaTotalM2 / 10000).toBeGreaterThan(91.5);
    expect(d.areaTotalM2 / 10000).toBeLessThan(92.5);
    for (const p of d.partes) expect(Math.abs(p.areaM2 / 10000 - d.areaTotalM2 / 50000)).toBeLessThan(0.02);
    expect(d.cortes).toHaveLength(4);
  });
  it('Amendoim de 72 ha em 6 partes iguais de 12 ha', () => {
    const d = dividirEmFaixas(amendoim, { partes: 6 });
    expect(d.partes).toHaveLength(6);
    for (const p of d.partes) expect(Math.abs(p.areaM2 / 10000 - 12)).toBeLessThan(0.1);
  });
  it('as divisas acompanham o lado mais longo', () => {
    // lado mais longo = leste-oeste (90°): as faixas ficam compridas e estreitas
    expect(Math.round(anguloLadoMaisLongo(andropogon))).toBe(90);
    const d = dividirEmFaixas(andropogon, { partes: 5 });
    const [a, b] = d.cortes[0];
    expect(Math.abs((b[0] - a[0]) * KX)).toBeGreaterThan(1900); // corte percorre o lado longo
    expect(Math.abs((b[1] - a[1]) * KY)).toBeLessThan(2);
  });
  it('a soma das partes fecha com o talhão', () => {
    const d = dividirEmFaixas(amendoim, { partes: 6 });
    const soma = d.partes.reduce((s, p) => s + p.areaM2, 0);
    expect(Math.abs(soma - d.areaTotalM2)).toBeLessThan(d.areaTotalM2 * 0.0005);
  });
  it('áreas diferentes por parte (16 + 16 + o que sobra)', () => {
    const d = dividirEmFaixas(andropogon, { areasM2: [160000, 160000, 600000] });
    expect(Math.abs(d.partes[0].areaM2 / 10000 - 16)).toBeLessThan(0.05);
    expect(Math.abs(d.partes[1].areaM2 / 10000 - 16)).toBeLessThan(0.05);
    expect(Math.abs(d.partes[2].areaM2 / 10000 - (d.areaTotalM2 / 10000 - 32))).toBeLessThan(0.05);
  });
  it('recusa áreas que passam do talhão', () => {
    expect(() => dividirEmFaixas(andropogon, { areasM2: [900000, 900000, 1] })).toThrow();
  });
  it('talhão côncavo (em L) continua somando certo', () => {
    const L: Coord[] = [pt(0, 0), pt(1000, 0), pt(1000, 400), pt(400, 400), pt(400, 1000), pt(0, 1000)];
    const d = dividirEmFaixas(L, { partes: 4, anguloGraus: 0 });
    const alvo = d.areaTotalM2 / 4;
    for (const p of d.partes) expect(Math.abs(p.areaM2 - alvo)).toBeLessThan(alvo * 0.01);
  });
  it('corredor reduz a área útil', () => {
    const sem = dividirEmFaixas(amendoim, { partes: 6 });
    const com = dividirEmFaixas(amendoim, { partes: 6, corredorM: 6 });
    expect(com.partes[2].areaM2).toBeLessThan(sem.partes[2].areaM2);
    // 5 divisas internas de 1200 m x 6 m = 3,6 ha a menos no total
    const perdida = (sem.partes.reduce((s, p) => s + p.areaM2, 0) - com.partes.reduce((s, p) => s + p.areaM2, 0)) / 10000;
    expect(perdida).toBeGreaterThan(3.4);
    expect(perdida).toBeLessThan(3.8);
  });
  it('inverter troca o lado de início', () => {
    const a = dividirEmFaixas(amendoim, { areasM2: [200000, 520000] });
    const b = dividirEmFaixas(amendoim, { areasM2: [200000, 520000], inverter: true });
    expect(Math.abs(a.partes[0].areaM2 - b.partes[0].areaM2)).toBeLessThan(2000);
    const ya = a.partes[0].pedacos[0].map((c) => c[1]);
    const yb = b.partes[0].pedacos[0].map((c) => c[1]);
    expect(Math.min(...ya)).not.toBeCloseTo(Math.min(...yb), 6);
  });
});

describe('pontos de divisa', () => {
  it('gera as pontas de cada divisa', () => {
    const d = dividirEmFaixas(andropogon, { partes: 5 });
    const pts = pontosDeDivisa(d.cortes);
    expect(pts).toHaveLength(8); // 4 divisas x 2 pontas
    expect(new Set(pts.map((p) => p.id)).size).toBe(8);
  });
  it('pontos intermediários a cada 500 m', () => {
    const d = dividirEmFaixas(andropogon, { partes: 5 });
    const pts = pontosDeDivisa(d.cortes, { espacamentoM: 500 });
    expect(pts.length).toBe(4 * 5); // 2000 m / 500 m = 4 trechos -> 5 pontos por divisa
  });
});

import { guiaAtePonto, desvioLateral, ordenarVisita, textoGiro, textoDesvio, degrauDeAviso, diferencaAngulo } from '../nav/guiaPonto';
import { lerKML, paraKML, paraGPX, kmlDeKmz } from '../io/formatos';
import { zipSync, strToU8 } from 'fflate';

describe('guia até o ponto', () => {
  it('distância e rumo', () => {
    const a = pt(0, 0), b = pt(0, 100);
    const g = guiaAtePonto(a, b, 90);
    expect(Math.abs(g.distanciaM - 100)).toBeLessThan(1.5);
    expect(Math.round(g.rumoAteOPonto)).toBe(0);
    expect(Math.round(g.giroGraus ?? 0)).toBe(-90); // virado para leste, ponto ao norte: vire à esquerda
    expect(guiaAtePonto(a, b, null).giroGraus).toBeNull();
  });
  it('desvio lateral com sinal', () => {
    const a = pt(0, 0), b = pt(0, 500); // linha para o norte
    expect(Math.round(desvioLateral(pt(8, 250), a, b))).toBe(8); // 8 m a leste = à direita
    expect(Math.round(desvioLateral(pt(-5, 250), a, b))).toBe(-5);
    expect(textoDesvio(8)).toMatch(/8,0 m à direita/);
    expect(textoDesvio(-0.4)).toBe('Sobre a linha');
  });
  it('ordem de visita vai sempre ao mais próximo', () => {
    const pts = [{ coord: pt(0, 1000), n: 'longe' }, { coord: pt(0, 10), n: 'perto' }, { coord: pt(0, 500), n: 'meio' }];
    expect(ordenarVisita(pts, pt(0, 0)).map((p) => p.n)).toEqual(['perto', 'meio', 'longe']);
  });
  it('textos e degraus', () => {
    expect(textoGiro(5)).toBe('Siga em frente');
    expect(textoGiro(-90)).toBe('Vire à esquerda');
    expect(textoGiro(170)).toBe('Dê meia-volta');
    expect(degrauDeAviso(8)).toBe(10);
    expect(degrauDeAviso(18)).toBe(20);
    expect(degrauDeAviso(40)).toBe(50);
    expect(degrauDeAviso(80)).toBe(0);
    expect(Math.round(diferencaAngulo(350, 10))).toBe(20);
  });
});

describe('arquivos do campo', () => {
  const kml = `<?xml version="1.0"?><kml><Document>
    <Placemark><name>Andropogon</name><Polygon><outerBoundaryIs><LinearRing><coordinates>-47.93,-15.78,0 -47.91,-15.78,0 -47.91,-15.77,0 -47.93,-15.77,0 -47.93,-15.78,0</coordinates></LinearRing></outerBoundaryIs>
    <innerBoundaryIs><LinearRing><coordinates>-47.92,-15.775,0 -47.919,-15.775,0 -47.919,-15.774,0 -47.92,-15.775,0</coordinates></LinearRing></innerBoundaryIs></Polygon></Placemark>
  </Document></kml>`;
  it('lê KML e avisa de buraco', () => {
    const r = lerKML(kml);
    expect(r.poligonos).toHaveLength(1);
    expect(r.poligonos[0].nome).toBe('Andropogon');
    expect(r.avisos?.[0]).toMatch(/buraco/);
  });
  it('abre KMZ', () => {
    const z = zipSync({ 'doc.kml': strToU8(kml), 'icon.png': new Uint8Array([1, 2, 3]) });
    expect(lerKML(kmlDeKmz(z)).poligonos[0].nome).toBe('Andropogon');
  });
  it('exporta bandeiras como pontos no KML e no GPX', () => {
    const pts = [{ nome: 'Divisa 1 · ponto 1', coord: [-47.9, -15.7] as [number, number] }];
    expect(paraKML([], [], pts)).toContain('<Point><coordinates>-47.9,-15.7,0</coordinates></Point>');
    expect(paraGPX([], [], pts)).toContain('<wpt lat="-15.7" lon="-47.9">');
  });
});

import { gerarCampo, distribuirVariedades, totaisPorVariedade, diferencaPercentual } from '../geo/campo';
import type { Talhao } from '../store/dados';

describe('plano do campo de sementes', () => {
  const tA: Talhao = { id: 'a', nome: 'Andropogon', fazenda: 'Lagoa Formosa', cultura: 'Pastagem', safra: '2026/27', contorno: andropogon, criadoEm: 0 };
  const tB: Talhao = { id: 'b', nome: 'Amendoim', fazenda: 'Lagoa Formosa', cultura: 'Amendoim', safra: '2026/27', contorno: amendoim, criadoEm: 0 };
  const plano = gerarCampo([tA, tB], [{ talhaoId: 'a', partes: 5, anguloGraus: null, inverter: false }, { talhaoId: 'b', partes: 6, anguloGraus: null, inverter: false }], 0, 0);

  it('gera 11 partes, 9 divisas e 18 bandeiras', () => {
    expect(plano.partes).toHaveLength(11);
    expect(plano.divisas).toHaveLength(9); // 4 + 5
    expect(plano.bandeiras).toHaveLength(18);
    expect(new Set(plano.bandeiras.map((b) => b.id)).size).toBe(18);
    expect(plano.bandeiras[0].rotulo).toMatch(/^Andropogon · divisa 1/);
  });
  it('10 variedades em 11 partes: a última repete', () => {
    const v = Array.from({ length: 10 }, (_, i) => `V${i + 1}`);
    const dist = distribuirVariedades(plano.partes, v);
    const tot = totaisPorVariedade(dist);
    expect(tot).toHaveLength(10);
    expect(tot.find((t) => t.variedade === 'V10')?.partes).toBe(2);
    const somaHa = tot.reduce((s, t) => s + t.areaM2, 0) / 10000;
    expect(somaHa).toBeGreaterThan(163);
    expect(somaHa).toBeLessThan(165);
  });
  it('compara com a área informada', () => {
    expect(Math.abs(diferencaPercentual(920000, 92))).toBeLessThan(0.001);
    expect(diferencaPercentual(910000, 92)).toBeLessThan(-1);
  });
});

describe('desempenho da divisão', () => {
  it('talhão de 2.000 vértices divide em menos de 600 ms e fecha a área', () => {
    const n = 2000;
    const c: Coord[] = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = 520 + 40 * Math.sin(a * 17) + 15 * Math.sin(a * 53);
      return pt(Math.cos(a) * r * 1.6, Math.sin(a) * r * 0.8);
    });
    const t0 = Date.now();
    const d = dividirEmFaixas(c, { partes: 10 });
    expect(Date.now() - t0).toBeLessThan(600);
    const soma = d.partes.reduce((s, p) => s + p.areaM2, 0);
    expect(Math.abs(soma / d.areaTotalM2 - 1)).toBeLessThan(0.001);
    for (const p of d.partes) expect(Math.abs(p.areaM2 / (d.areaTotalM2 / 10) - 1)).toBeLessThan(0.01);
  });
});
