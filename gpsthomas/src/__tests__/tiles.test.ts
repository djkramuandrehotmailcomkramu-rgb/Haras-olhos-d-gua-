import { areaKm2, caixaAoRedor, caixaDeCoords, contarTiles, faixaDeTiles, latParaY, lonParaX, unir, urlsDaArea, estimarMB, formatarMB } from '../mapa/tiles';

describe('blocos de mapa (tiles)', () => {
  it('converte lon/lat em bloco (valores conhecidos)', () => {
    // Greenwich/equador no zoom 1 fica no canto (1,1); São Paulo no zoom 10 ≈ (379, 580)
    expect(lonParaX(0, 1)).toBe(1);
    expect(latParaY(0, 1)).toBe(1);
    expect(lonParaX(-46.63, 10)).toBe(379);
    expect(latParaY(-23.55, 10)).toBe(580);
    expect(lonParaX(-180, 5)).toBe(0);
    expect(lonParaX(179.999, 5)).toBe(31);
  });
  it('caixa dos talhões com margem e área', () => {
    const c = caixaDeCoords([[-46.13, -16.28], [-46.12, -16.27]], 1000)!;
    expect(c.oeste).toBeLessThan(-46.13);
    expect(c.norte).toBeGreaterThan(-16.27);
    // ~1,07 km x 1,11 km de talhões + 1 km de margem em cada lado
    expect(areaKm2(c)).toBeGreaterThan(8);
    expect(areaKm2(c)).toBeLessThan(10);
    expect(caixaDeCoords([])).toBeNull();
    const r = caixaAoRedor([-46.13, -16.28], 2000);
    expect(areaKm2(r)).toBeCloseTo(16, 0);
    expect(unir(null, r)).toBe(r);
    expect(unir(c, r)!.oeste).toBeLessThanOrEqual(Math.min(c.oeste, r.oeste));
  });
  it('contagem de blocos cresce ~4x a cada zoom e bate com a lista de URLs', () => {
    const c = caixaAoRedor([-46.13, -16.28], 1500);
    const n16 = contarTiles(c, 16, 16), n17 = contarTiles(c, 17, 17), n18 = contarTiles(c, 18, 18);
    expect(n17 / n16).toBeGreaterThan(2.5);
    expect(n17 / n16).toBeLessThan(6);
    expect(n18).toBeGreaterThan(n17);
    expect(urlsDaArea('mapa', c, 16, 18)).toHaveLength(n16 + n17 + n18);
    const sat = urlsDaArea('satelite', c, 17, 17);
    expect(sat).toHaveLength(n17 * 2); // imagem + rótulos
    expect(sat[0]).toMatch(/World_Imagery\/MapServer\/tile\/17\/\d+\/\d+$/);
    expect(sat[1]).toMatch(/World_Boundaries_and_Places/);
    expect(new Set(sat).size).toBe(sat.length);
    const f = faixaDeTiles(c, 17);
    expect(f.x1).toBeGreaterThanOrEqual(f.x0);
    expect(f.y1).toBeGreaterThanOrEqual(f.y0);
  });
  it('estimativa de tamanho', () => {
    expect(estimarMB('satelite', 1000)).toBeGreaterThan(estimarMB('mapa', 1000));
    expect(formatarMB(0.2)).toMatch(/KB$/);
    expect(formatarMB(12.34)).toBe('12,3 MB');
    expect(formatarMB(250)).toBe('250 MB');
  });
});
