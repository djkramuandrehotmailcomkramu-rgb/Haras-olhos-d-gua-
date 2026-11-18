import { dividirAneis } from '../geo/dividir';
import { areaM2, type Coord } from '../geo/medidas';
import { LINHA_AB_PADRAO, anguloDaLinha, lerCoordenada, lerLatLon, medidasDaLinha, nomeRumo } from '../geo/rastro';
import { conferirAreas, gerarCampoJunto, planejarPartesJunto } from '../geo/campo';
import type { ConfigJunto, PlanoCampo, Talhao } from '../store/dados';

const KX = Math.cos((-16.285 * Math.PI) / 180) * 111319.49;
const KY = 111319.49;
const base: Coord = [-46.13, -16.285];
const pt = (dx: number, dy: number): Coord => [base[0] + dx / KX, base[1] + dy / KY];
const ret = (x0: number, y0: number, x1: number, y1: number): Coord[] => [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)];

// lado a lado ao longo do eixo leste-oeste: 92 ha (2000 x 460) e 72 ha (1565,2 x 460) com um vão de 100 m
const andro = ret(0, 0, 2000, 460);
const amen = ret(-1665.2, 0, -100, 460);
const talhao = (id: string, nome: string, contorno: Coord[]): Talhao => ({ id, nome, fazenda: 'Lagoa', cultura: '', safra: '', contorno, criadoEm: 0 });
const T = [talhao('a', 'Andropgno', andro), talhao('m', 'Amendoim', amen)];
const junto = (p: Partial<ConfigJunto> = {}): ConfigJunto => ({ talhaoIds: ['a', 'm'], haPorParte: 16, anguloGraus: 90, usarLinhaAB: false, inverter: false, sobra: 'extra', ...p });
const ha = (m2: number) => m2 / 10000;

describe('dividirAneis: vários talhões como um só campo', () => {
  it('faixas que atravessam os dois talhões somam a área total', () => {
    const d = dividirAneis([andro, amen], { partes: 10, anguloGraus: 90 });
    expect(d.partes).toHaveLength(10);
    const total = areaM2(andro) + areaM2(amen);
    for (const p of d.partes) expect(Math.abs(p.areaM2 - total / 10)).toBeLessThan(100);
    expect(d.partes.reduce((s, p) => s + p.areaM2, 0)).toBeCloseTo(total, -1);
    // cada parte atravessa os dois (lado a lado no eixo das faixas)
    for (const p of d.partes) { expect(p.origens).toHaveLength(2); expect(p.origens!.reduce((s, o) => s + o.areaM2, 0)).toBeCloseTo(p.areaM2, 0); }
    // 9 divisas x 2 talhões, sem divisa no vão
    expect(d.cortes).toHaveLength(18);
  });
  it('talhões empilhados: uma parte pode ficar só em um deles', () => {
    const norte = ret(0, 700, 1000, 1100); // 40 ha acima do Andropgno (92 ha)
    const d = dividirAneis([andro, norte], { partes: 4, anguloGraus: 90 });
    expect(d.partes.some((p) => p.origens!.length === 1)).toBe(true);
    expect(d.partes.reduce((s, p) => s + p.areaM2, 0)).toBeCloseTo(areaM2(andro) + areaM2(norte), -1);
  });
});

describe('rastro AB', () => {
  it('lê coordenadas com ponto ou vírgula e rejeita lixo', () => {
    expect(lerCoordenada('-16.28240600')).toBeCloseTo(-16.282406, 8);
    expect(lerCoordenada('−46,13416156')).toBeCloseTo(-46.13416156, 8);
    expect(lerCoordenada('abc')).toBeNull();
    expect(lerCoordenada('1.234,5')).toBeNull();
    expect(lerLatLon('-16.2', '-46.1')).toEqual([-46.1, -16.2]);
    expect(lerLatLon('-96.2', '-46.1')).toBeNull();
  });
  it('a linha do monitor aponta para oés-sudoeste (≈ 257°) e tem ≈ 1 km', () => {
    const { metros, rumo } = medidasDaLinha(LINHA_AB_PADRAO.a, LINHA_AB_PADRAO.b);
    expect(rumo).toBeGreaterThan(256);
    expect(rumo).toBeLessThan(258.5);
    expect(metros).toBeGreaterThan(990);
    expect(metros).toBeLessThan(1010);
    expect(anguloDaLinha(LINHA_AB_PADRAO.a, LINHA_AB_PADRAO.b)).toBeCloseTo(rumo - 180, 5);
    expect(nomeRumo(rumo)).toBe('OSO');
  });
});

describe('gerarCampoJunto', () => {
  const total = ha(areaM2(andro) + areaM2(amen));
  it('partes de 16 ha e uma parte de sobra no fim', () => {
    const r = gerarCampoJunto(T, junto(), 0, 0);
    const n = Math.floor(total / 16);
    expect(r.partes).toHaveLength(r.resumo.temSobra ? n + 1 : n);
    for (const p of r.partes.slice(0, n)) expect(ha(p.areaM2)).toBeCloseTo(16, 1);
    if (r.resumo.temSobra) expect(ha(r.partes[n].areaM2)).toBeCloseTo(total - 16 * n, 1);
    expect(r.partes.reduce((s, p) => s + p.areaM2, 0) / 10000).toBeCloseTo(total, 1);
    expect(r.partes.every((p) => p.talhaoId === 'junto' && (p.origens?.length ?? 0) > 0)).toBe(true);
    expect(r.bandeiras.length).toBe(r.divisas.length * 2);
    expect(r.bandeiras[0].rotulo).toMatch(/divisa 1 · ponto 1/);
  });
  it('"dividir a sobra" gera partes todas iguais', () => {
    const r = gerarCampoJunto(T, junto({ sobra: 'dividir' }), 0, 0);
    expect(r.partes).toHaveLength(Math.floor(total / 16));
    const a = ha(r.partes[0].areaM2);
    for (const p of r.partes) expect(ha(p.areaM2)).toBeCloseTo(a, 1);
  });
  it('calibra pela área informada (164 ha)', () => {
    const r = planejarPartesJunto(areaM2(andro) + areaM2(amen), { haPorParte: 16, areaInformadaHa: 164, sobra: 'extra' });
    expect(r.cadaM2 / 10000).toBeCloseTo(16 * total / 164, 4);
    expect(r.partes).toBeGreaterThanOrEqual(10);
  });
  it('erra com campo menor que uma parte e com hectares inválidos', () => {
    expect(() => planejarPartesJunto(100000, { haPorParte: 16, sobra: 'extra' })).toThrow();
    expect(() => planejarPartesJunto(1e6, { haPorParte: 0, sobra: 'extra' })).toThrow();
  });
  it('a direção pela linha AB é usada nas divisas', () => {
    const r = gerarCampoJunto(T, junto({ usarLinhaAB: true, linhaAB: { nome: 'X', a: pt(0, 0), b: pt(1000, 0) } }), 0, 0);
    expect(Math.round(r.anguloGraus)).toBe(90);
  });
  it('conferência do campo junto fecha com a soma dos talhões', () => {
    const r = gerarCampoJunto(T, junto(), 0, 0);
    const plano = { id: 'p', nome: 'x', criadoEm: 0, config: [], corredorM: 0, espacamentoM: 0, variedades: [], partes: r.partes, bandeiras: r.bandeiras, divisas: r.divisas, junto: junto() } as PlanoCampo;
    const c = conferirAreas(plano, T);
    expect(c).toHaveLength(1);
    expect(Math.abs(c[0].diffPercentual)).toBeLessThan(0.1);
  });
});

describe('dividirAneis: casos aleatórios (não quebra e conserva a área)', () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // polígono convexo aleatório (pontos num círculo, em ordem de ângulo) com ~10–80 ha
  const poli = (cx: number, cy: number): Coord[] => {
    const n = 5 + Math.floor(rnd() * 6);
    const raio = 180 + rnd() * 450;
    // ângulos espaçados com folga: o polígono é sempre simples (sem cruzar arestas), podendo ser côncavo
    const angs = Array.from({ length: n }, (_, i) => ((i + (rnd() - 0.5) * 0.5) / n) * Math.PI * 2);
    return angs.map((a) => pt(cx + Math.cos(a) * raio * (0.75 + rnd() * 0.25), cy + Math.sin(a) * raio * (0.75 + rnd() * 0.25)));
  };
  it('40 combinações de talhões, ângulos e quantidades de partes', () => {
    for (let k = 0; k < 40; k++) {
      const nTal = 1 + Math.floor(rnd() * 3);
      const aneis = Array.from({ length: nTal }, (_, i) => poli(i * 1500 + rnd() * 400, (rnd() - 0.5) * 900));
      const total = aneis.reduce((s, a) => s + areaM2(a), 0);
      const partes = 2 + Math.floor(rnd() * 10);
      const ang = rnd() * 180;
      const d = dividirAneis(aneis, { partes, anguloGraus: ang, inverter: rnd() > 0.5 });
      expect(d.partes).toHaveLength(partes);
      expect(d.partes.every((p) => Number.isFinite(p.areaM2) && p.areaM2 > 0)).toBe(true);
      expect(Math.abs(d.partes.reduce((s, p) => s + p.areaM2, 0) - total) / total).toBeLessThan(0.002);
      for (const p of d.partes) expect(Math.abs(p.areaM2 - total / partes) / (total / partes)).toBeLessThan(0.01);
    }
  });
  it('lista de áreas com a última parte sendo a sobra, em vários talhões', () => {
    const aneis = [poli(0, 0), poli(1600, 100)];
    const total = aneis.reduce((s, a) => s + areaM2(a), 0);
    const cada = Math.min(60000, total / 4);
    const d = dividirAneis(aneis, { areasM2: [cada, cada, cada, 1], anguloGraus: 77 });
    expect(d.partes).toHaveLength(4);
    for (const p of d.partes.slice(0, 3)) expect(Math.abs(p.areaM2 - cada) / cada).toBeLessThan(0.01);
    expect(Math.abs(d.partes[3].areaM2 - (total - 3 * cada)) / total).toBeLessThan(0.005);
  });
});
