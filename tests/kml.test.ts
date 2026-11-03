import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { lerKml, areaHa } from '../shared/kml';
import { agrupar, distKm } from '../shared/grupos';

const kml = readFileSync('data/lagoa-formosa.kml', 'utf8'); // KML real enviado pelo usuário

describe('KML Lagoa Formosa (arquivo real)', () => {
  const r = lerKml(kml);
  it('lê 18 talhões únicos e avisa do duplicado', () => {
    expect(r.talhoes).toHaveLength(18);
    expect(r.avisos.some((a) => a.includes('Área do Curral'))).toBe(true);
  });
  it('nomes e áreas plausíveis', () => {
    const nomes = r.talhoes.map((t) => t.nome);
    expect(nomes).toContain('Andropogon');
    expect(nomes).toContain('Palmeira 3A');
    const total = r.talhoes.reduce((s, t) => s + t.ha, 0);
    expect(total).toBeGreaterThan(2000);
    expect(total).toBeLessThan(2600);
    expect(r.talhoes.find((t) => t.nome === 'Área do Toninho')!.ha).toBeGreaterThan(300);
  });
  it('centroides dentro da região (MG)', () => {
    for (const t of r.talhoes) {
      expect(t.lat).toBeGreaterThan(-16.4);
      expect(t.lat).toBeLessThan(-16.2);
      expect(t.lon).toBeGreaterThan(-46.3);
      expect(t.lon).toBeLessThan(-46.0);
    }
  });
  it('simplificação preserva a área (±1%)', () => {
    const bruto = (kml.match(/<Placemark[\s\S]*?<\/Placemark>/g) || [])[0]!;
    const pts = /<coordinates>([\s\S]*?)<\/coordinates>/.exec(bruto)![1].trim().split(/\s+/).map((c) => c.split(',').map(Number) as [number, number]);
    const t = r.talhoes.find((x) => x.nome === 'Andropogon')!;
    expect(Math.abs(t.ha - areaHa(pts)) / areaHa(pts)).toBeLessThan(0.01);
  });
});

describe('agrupamento', () => {
  const r = lerKml(kml);
  const pontos = r.talhoes.map((t) => ({ id: t.nome, lat: t.lat, lon: t.lon }));
  it('todo talhão fica em exatamente um grupo e a ≤ 5 km do centro', () => {
    const g = agrupar(pontos, 5);
    const ids = g.flatMap((x) => x.ids);
    expect(ids.sort()).toEqual(pontos.map((p) => p.id).sort());
    expect(g.length).toBeGreaterThanOrEqual(2);
    expect(g.length).toBeLessThanOrEqual(5);
  });
  it('é determinístico', () => {
    expect(agrupar(pontos, 5)).toEqual(agrupar([...pontos].reverse(), 5));
  });
  it('distância conhecida', () => {
    expect(distKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111.2, 0);
  });
});
