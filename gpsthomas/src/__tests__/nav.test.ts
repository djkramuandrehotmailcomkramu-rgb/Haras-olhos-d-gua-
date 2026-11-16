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

import { rumoEntre, velocidadeKmh, suavizarRumo, type Amostra } from '../nav/movimento';
import { limiteNoTrecho } from '../nav/progresso';

describe('movimento', () => {
  it('rumo entre pontos', () => {
    expect(Math.round(rumoEntre([0, 0], [0, 1]))).toBe(0); // norte
    expect(Math.round(rumoEntre([0, 0], [1, 0]))).toBe(90); // leste
    expect(Math.round(rumoEntre([0, 0], [0, -1]))).toBe(180); // sul
    expect(Math.round(rumoEntre([0, 0], [-1, 0]))).toBe(270); // oeste
  });
  it('velocidade a partir da posição (GPS sem speed)', () => {
    // 100 m em 5 s = 20 m/s = 72 km/h
    const g = 100 / 111132;
    const h: Amostra[] = [0, 1, 2, 3].map((i) => ({ coord: [0, i * g] as [number, number], tempoMs: i * 5000, velMs: null }));
    expect(Math.round(velocidadeKmh(h))).toBe(72);
  });
  it('usa a velocidade do GPS quando existe e zera parado', () => {
    const a: Amostra[] = [{ coord: [0, 0], tempoMs: 0, velMs: 25 }, { coord: [0, 0], tempoMs: 1000, velMs: 25 }];
    expect(Math.round(velocidadeKmh(a))).toBe(90);
    const parado: Amostra[] = [{ coord: [0, 0], tempoMs: 0, velMs: 0.2 }, { coord: [0, 0], tempoMs: 1000, velMs: 0.1 }];
    expect(velocidadeKmh(parado)).toBe(0);
    expect(velocidadeKmh([])).toBe(0);
  });
  it('gira pelo menor arco', () => {
    expect(Math.round(suavizarRumo(350, 10, 1))).toBe(10);
    expect(Math.round(suavizarRumo(350, 10, 0.5))).toBe(0);
    expect(Math.round(suavizarRumo(10, 350, 0.5))).toBe(0);
  });
});

describe('limite de velocidade', () => {
  it('lê maxspeed do OSRM e ignora desconhecidos', () => {
    const j = JSON.parse(JSON.stringify(osrm));
    j.routes[0].legs[0].annotation = { maxspeed: [{ speed: 80, unit: 'km/h' }, { unknown: true }] };
    const [r] = interpretarOSRM(j);
    expect(r.limites).toEqual([80, null]);
    const prep = prepararRota(r);
    expect(limiteNoTrecho(prep, 0)).toBe(80);
    expect(limiteNoTrecho(prep, 1)).toBeNull();
    expect(limiteNoTrecho(prepararRota(interpretarOSRM(osrm)[0]), 0)).toBeNull();
  });
});
