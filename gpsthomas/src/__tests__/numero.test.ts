import { lerNumeroBR, paraCampoBR, formatarNumeroBR, formatarPercentual } from '../geo/numero';
import { conferirManual, fatorCalibracao, gerarCampo, preencherCada, compararComMeta, conferirAreas, distribuirVariedades } from '../geo/campo';
import { formatarHa } from '../geo/unidades';
import type { Coord } from '../geo/medidas';
import type { PlanoCampo, Talhao } from '../store/dados';

describe('lerNumeroBR', () => {
  it.each([
    ['16', 16], ['16,5', 16.5], ['16.5', 16.5], ['1.234,5', 1234.5], [' 12 ha ', 12], ['0,25', 0.25], ['1.234.567', 1234567], ['92,0', 92], ['-3', -3],
  ])('lê %s', (txt, esperado) => expect(lerNumeroBR(txt as string)).toBe(esperado));
  it.each(['', ' ', 'abc', '1,2,3', ',', '-', '12abc', '1e5x'])('rejeita "%s"', (txt) => expect(lerNumeroBR(txt)).toBeNull());
  it('aceita número e rejeita nulo', () => {
    expect(lerNumeroBR(7)).toBe(7);
    expect(lerNumeroBR(NaN)).toBeNull();
    expect(lerNumeroBR(null)).toBeNull();
  });
  it('formata para campo e exibição', () => {
    expect(paraCampoBR(16)).toBe('16');
    expect(paraCampoBR(16.5)).toBe('16,5');
    expect(formatarNumeroBR(1234.5)).toBe('1.234,50');
    expect(formatarHa(163.64 * 10000)).toBe('163,64 ha');
    expect(formatarHa(1234.5 * 10000)).toBe('1.234,50 ha');
    expect(formatarPercentual(0.5)).toBe('+0,50%');
    expect(formatarPercentual(-1.234)).toBe('-1,23%');
    expect(formatarPercentual(0)).toBe('+0,00%');
  });
});

const KX = Math.cos((-15.78 * Math.PI) / 180) * 111319.49;
const KY = 111319.49;
const pt = (dx: number, dy: number): Coord => [-47.93 + dx / KX, -15.78 + dy / KY];
const tA: Talhao = { id: 'a', nome: 'Andropogon', fazenda: 'F', cultura: 'x', safra: '', contorno: [pt(0, 0), pt(2000, 0), pt(2000, 460), pt(0, 460)], criadoEm: 0 };
const tB: Talhao = { id: 'b', nome: 'Amendoim', fazenda: 'F', cultura: 'x', safra: '', contorno: [pt(0, 600), pt(1200, 600), pt(1200, 1200), pt(0, 1200)], criadoEm: 0 };

describe('hectares digitados', () => {
  it('confere soma e resto', () => {
    const total = 91.8 * 10000;
    expect(conferirManual(total, [16, 16, 16, 16, 16]).ok).toBe(true);
    expect(conferirManual(total, [16, 16, 16, 16, 16]).restoHa).toBeCloseTo(11.8, 1);
    const passou = conferirManual(total, [50, 50]);
    expect(passou.ok).toBe(false);
    expect(passou.erro).toMatch(/Passou/);
    expect(conferirManual(total, [16, 0]).ok).toBe(false);
    expect(conferirManual(total, [16, NaN]).ok).toBe(false);
  });
  it('calibra pela área informada', () => {
    expect(fatorCalibracao(918000, 92)).toBeCloseTo(0.99783, 4);
    expect(fatorCalibracao(918000, null)).toBe(1);
    // 16 ha informados em um talhão de 92 ha informados / 91,8 medidos: cada parte real tem 15,97 ha
    expect(conferirManual(918000, [16], 92).restoHa).toBeCloseTo(91.8 - 16 * 0.99783, 3);
  });
  it('"16 ha cada" deixa o resto para a última', () => {
    expect(preencherCada(6, 16)).toEqual([16, 16, 16, 16, 16]);
    expect(preencherCada(1, 16)).toEqual([]);
  });
  it('gera partes de 16 ha e a última com o resto (Andropogon)', () => {
    const g = gerarCampo([tA], [{ talhaoId: 'a', partes: 6, anguloGraus: null, inverter: false, modo: 'manual', areasHa: [16, 16, 16, 16, 16] }], 0, 0);
    expect(g.partes).toHaveLength(6);
    g.partes.slice(0, 5).forEach((p) => expect(Math.abs(p.areaM2 / 10000 - 16)).toBeLessThan(0.05));
    const total = g.partes.reduce((s, p) => s + p.areaM2, 0) / 10000;
    expect(Math.abs(g.partes[5].areaM2 / 10000 - (total - 80))).toBeLessThan(0.05);
    expect(g.partes[5].areaM2 / 10000).toBeGreaterThan(11);
    expect(g.partes[5].areaM2 / 10000).toBeLessThan(12.1);
  });
  it('mistura partes iguais em um talhão e manuais em outro', () => {
    const g = gerarCampo([tA, tB], [
      { talhaoId: 'a', partes: 5, anguloGraus: null, inverter: false },
      { talhaoId: 'b', partes: 5, anguloGraus: null, inverter: false, modo: 'manual', areasHa: [16, 16, 16, 16] },
    ], 0, 0);
    expect(g.partes).toHaveLength(10);
    expect(g.partes.filter((p) => p.talhaoId === 'b').slice(0, 4).every((p) => Math.abs(p.areaM2 / 10000 - 16) < 0.05)).toBe(true);
  });
  it('recusa hectares que passam do talhão', () => {
    expect(() => gerarCampo([tB], [{ talhaoId: 'b', partes: 3, anguloGraus: null, inverter: false, modo: 'manual', areasHa: [60, 60] }], 0, 0)).toThrow(/Passou/);
    expect(() => gerarCampo([tB], [{ talhaoId: 'b', partes: 3, anguloGraus: null, inverter: false, modo: 'manual', areasHa: [10] }], 0, 0)).toThrow();
  });
  it('com calibração, 16 ha informados viram 16 x medida/informada reais', () => {
    const informada = 92;
    const g = gerarCampo([tA], [{ talhaoId: 'a', partes: 2, anguloGraus: null, inverter: false, modo: 'manual', areasHa: [16], areaInformadaHa: informada }], 0, 0);
    const k = fatorCalibracao(g.partes.reduce((s, p) => s + p.areaM2, 0), informada);
    expect(Math.abs(g.partes[0].areaM2 / 10000 - 16 * k)).toBeLessThan(0.05);
  });
});

describe('meta por variedade e conferência', () => {
  it('compara com a meta', () => {
    expect(compararComMeta(160000, 16).selo).toBe('ok');
    expect(compararComMeta(163000, 16).selo).toBe('ok'); // 0,3 ha de tolerância
    expect(compararComMeta(190000, 16).selo).toBe('atencao');
    expect(compararComMeta(190000, null).selo).toBe('sem-meta');
    expect(compararComMeta(190000, 16).diffHa).toBeCloseTo(3, 5);
  });
  it('conferência fecha sem corredor e acusa o corredor descontado', () => {
    const cfg = [{ talhaoId: 'b', partes: 6, anguloGraus: null, inverter: false }];
    const sem = gerarCampo([tB], cfg, 0, 0);
    const mk = (g: typeof sem, corredorM: number): PlanoCampo => ({ id: 'p', nome: 'p', criadoEm: 0, config: cfg, corredorM, espacamentoM: 0, variedades: [], partes: distribuirVariedades(g.partes, []), bandeiras: g.bandeiras, divisas: g.divisas });
    expect(conferirAreas(mk(sem, 0), [tB])[0].alerta).toBe(false);
    const com = gerarCampo([tB], cfg, 6, 0);
    const c = conferirAreas(mk(com, 6), [tB])[0];
    expect(c.corredorEsperadoM2).toBeGreaterThan(30000); // 5 divisas x 600 m x 6 m = 3,6 ha
    expect(c.alerta).toBe(false);
  });
});

import { VERSAO } from '../versao';
import app from '../../app.json';
describe('versão', () => {
  it('app.json e package.json estão sincronizados', () => {
    expect(VERSAO).toBe(app.expo.version);
    expect(VERSAO).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
