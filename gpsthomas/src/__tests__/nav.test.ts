import { interpretarOSRM, textoPasso } from '../nav/rota';
import { interpretarNominatim } from '../nav/geocodificar';
import { prepararRota, projetar, estadoNavegacao, fraseFalada, formatarDuracao } from '../nav/progresso';

const g = 1 / 111132;
const osrm = {
  code: 'Ok',
  routes: [
    {
      distance: 2000, duration: 120,
      geometry: { coordinates: [[0, 0], [0, 1000 * g], [1000 * g, 1000 * g]] },
      legs: [{ steps: [
        { distance: 1000, duration: 60, name: 'BR-163', ref: 'BR-163', maneuver: { type: 'depart', location: [0, 0] } },
        { distance: 1000, duration: 60, name: 'Rua das Flores', maneuver: { type: 'turn', modifier: 'right', location: [0, 1000 * g] } },
        { distance: 0, duration: 0, name: '', maneuver: { type: 'arrive', location: [1000 * g, 1000 * g] } },
      ] }],
    },
  ],
};

describe('rotas', () => {
  it('interpreta OSRM e escreve em português', () => {
    const [r] = interpretarOSRM(osrm);
    expect(r.passos).toHaveLength(3);
    expect(r.passos[1].texto).toBe('Vire à direita em Rua das Flores');
    expect(r.passos[2].texto).toBe('Você chegou ao destino');
    expect(r.via).toBe('via BR-163');
    expect(r.passos[1].inicioM).toBe(1000);
  });
  it('resposta ruim vira lista vazia', () => {
    expect(interpretarOSRM({ code: 'NoRoute' })).toEqual([]);
    expect(interpretarOSRM(null)).toEqual([]);
  });
  it('textos de manobra', () => {
    expect(textoPasso('turn', 'uturn', '')).toBe('Faça o retorno');
    expect(textoPasso('roundabout', 'right', 'BR-050', 2)).toBe('Na rotatória, pegue a 2ª saída em BR-050');
    expect(textoPasso('fork', 'left', '')).toBe('Mantenha-se à esquerda');
  });
});

describe('busca', () => {
  it('interpreta Nominatim', () => {
    const r = interpretarNominatim([{ lat: '-16.68', lon: '-49.25', name: 'Goiânia', display_name: 'Goiânia, Região Geográfica Imediata de Goiânia, Goiás, Brasil' }]);
    expect(r[0].nome).toBe('Goiânia');
    expect(r[0].coord).toEqual([-49.25, -16.68]);
    expect(r[0].sub).toContain('Goiás');
    expect(interpretarNominatim([{ lat: 'x', lon: 'y' }])).toEqual([]);
  });
});

describe('progresso', () => {
  const prep = prepararRota(interpretarOSRM(osrm)[0]);
  it('projeta na rota e mede o desvio', () => {
    const noMeio = projetar(prep, [30 * g, 500 * g]);
    expect(noMeio.alongM).toBeGreaterThan(490);
    expect(noMeio.alongM).toBeLessThan(510);
    expect(noMeio.desvioM).toBeGreaterThan(25);
    expect(noMeio.desvioM).toBeLessThan(35);
    expect(projetar(prep, [0, 0]).alongM).toBeCloseTo(0, 0);
  });
  it('acha a próxima manobra e o que falta', () => {
    const e = estadoNavegacao(prep, 700);
    expect(e.proximo?.tipo).toBe('turn');
    expect(Math.round(e.distAteProximoM)).toBeGreaterThan(290);
    expect(Math.round(e.distAteProximoM)).toBeLessThan(310);
    expect(e.chegou).toBe(false);
    expect(estadoNavegacao(prep, 1990).chegou).toBe(true);
  });
  it('frases e duração', () => {
    expect(fraseFalada(310, 'Vire à direita')).toBe('Em 300 metros, vire à direita');
    expect(fraseFalada(20, 'Vire à direita')).toBe('Vire à direita');
    expect(fraseFalada(1480, 'Siga em frente')).toMatch(/1,5 quilômetros/);
    expect(formatarDuracao(5400)).toBe('1 h 30 min');
    expect(formatarDuracao(1500)).toBe('25 min');
  });
});
