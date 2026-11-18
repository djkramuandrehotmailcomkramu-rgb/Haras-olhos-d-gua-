import { areaM2, comprimentoM, contornoCruzado, perimetroM, type Coord } from '../geo/medidas';
import { converterArea, formatarArea, formatarDistancia } from '../geo/unidades';
import { aceitarAmostra } from '../geo/filtroGps';

// ~100 m por 100 m perto do equador (1° ≈ 111.32 km)
const grau = 100 / 111_319.49;
const quadrado: Coord[] = [
  [0, 0],
  [grau, 0],
  [grau, grau],
  [0, grau],
];

describe('medidas', () => {
  it('quadrado de 100 m x 100 m tem cerca de 1 ha', () => {
    const ha = converterArea(areaM2(quadrado), 'ha');
    expect(ha).toBeGreaterThan(0.99);
    expect(ha).toBeLessThan(1.01);
  });
  it('perímetro do quadrado é cerca de 400 m', () => {
    expect(perimetroM(quadrado)).toBeGreaterThan(395);
    expect(perimetroM(quadrado)).toBeLessThan(405);
  });
  it('menos de 3 pontos não forma área', () => {
    expect(areaM2([[0, 0], [grau, 0]])).toBe(0);
    expect(comprimentoM([[0, 0]])).toBe(0);
  });
  it('comprimento de uma linha de 100 m', () => {
    const c = comprimentoM([[0, 0], [grau, 0]]);
    expect(c).toBeGreaterThan(99);
    expect(c).toBeLessThan(101);
  });
});

describe('unidades', () => {
  it('1 ha = 0,41 alqueire paulista', () => {
    expect(converterArea(10_000, 'alqPaulista')).toBeCloseTo(0.4132, 3);
  });
  it('1 alqueire mineiro = 4,84 ha', () => {
    expect(converterArea(48_400, 'ha')).toBeCloseTo(4.84, 5);
  });
  it('formata em pt-BR', () => {
    expect(formatarArea(12_345, 'ha')).toMatch(/1,23 ha/);
    expect(formatarDistancia(850)).toMatch(/850 m/);
    expect(formatarDistancia(2500)).toMatch(/2,50 km/);
  });
});

describe('filtro GPS', () => {
  it('rejeita precisão ruim e movimento mínimo', () => {
    const a = { coord: [0, 0] as Coord, precisaoM: 5, tempoMs: 0 };
    expect(aceitarAmostra(null, a)).toBe(true);
    expect(aceitarAmostra(a, { ...a, precisaoM: 40 })).toBe(false);
    expect(aceitarAmostra(a, { ...a, coord: [0.00001, 0] })).toBe(false);
    expect(aceitarAmostra(a, { ...a, coord: [grau, 0] })).toBe(true);
  });
});

import { paraGeoJSON, paraKML, paraGPX, lerArquivo, lerKML } from '../io/formatos';
import type { Talhao } from '../store/dados';

const talhaoTeste: Talhao = { id: '1', nome: 'T <1> & "A"', fazenda: 'F', cultura: 'Soja', safra: '2026/27', contorno: quadrado, criadoEm: 0 };

describe('arquivos', () => {
  it('GeoJSON ida e volta', () => {
    const r = lerArquivo(paraGeoJSON([talhaoTeste]));
    expect(r.poligonos).toHaveLength(1);
    expect(r.poligonos[0].pontos).toHaveLength(4);
    expect(r.poligonos[0].nome).toBe('T <1> & "A"');
  });
  it('KML ida e volta', () => {
    const r = lerKML(paraKML([talhaoTeste]));
    expect(r.poligonos).toHaveLength(1);
    expect(r.poligonos[0].nome).toBe('T <1> & "A"');
    expect(r.poligonos[0].pontos).toHaveLength(4);
  });
  it('GPX vira linha', () => {
    const r = lerArquivo(paraGPX([talhaoTeste]));
    expect(r.linhas[0].pontos.length).toBe(5);
  });
  it('lixo não quebra', () => {
    expect(lerArquivo('abc').poligonos).toHaveLength(0);
    expect(lerArquivo('{"type":').poligonos).toHaveLength(0);
  });
});

describe('contorno que se cruza', () => {
  it('quadrado e polígono côncavo são válidos; "gravata borboleta" é detectada', () => {
    expect(contornoCruzado(quadrado)).toBe(false);
    const L: Coord[] = [[0, 0], [2 * grau, 0], [2 * grau, grau], [grau, grau], [grau, 2 * grau], [0, 2 * grau]];
    expect(contornoCruzado(L)).toBe(false);
    const gravata: Coord[] = [[0, 0], [grau, grau], [grau, 0], [0, grau]];
    expect(contornoCruzado(gravata)).toBe(true);
    expect(contornoCruzado([[0, 0], [grau, 0], [grau, grau]])).toBe(false); // triângulo
    expect(contornoCruzado([...quadrado, quadrado[0]])).toBe(false); // já fechado
  });
});
