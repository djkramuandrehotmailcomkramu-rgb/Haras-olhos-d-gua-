import { rumoDaOrientacao, suavizarCircular } from '../nav/bussola';
import { FiltroGps, qualidadeGps } from '../nav/filtroGps';
import { AprendizDesvio, aplicarDeslocamento, calcularDeslocamento, declinacaoAproximada, deslocamentoAtivo, rumoVerdadeiro, textoDeslocamento } from '../nav/calibracao';
import { atualizarChegada, escolherRumo } from '../nav/guiaPonto';
import { comprimentoM, type Coord } from '../geo/medidas';

const perto = (a: number, b: number, tol = 0.5) => expect(Math.abs((((a - b) % 360) + 540) % 360 - 180)).toBeLessThan(tol);

describe('bússola com compensação de inclinação', () => {
  it('deitado: norte, oeste e leste', () => {
    perto(rumoDaOrientacao(0, 0, 0), 0);
    perto(rumoDaOrientacao(90, 0, 0), 270);
    perto(rumoDaOrientacao(270, 0, 0), 90);
  });
  it('em pé e inclinado dão o mesmo rumo que deitado (contínuo)', () => {
    for (const beta of [0, 20, 45, 70, 85, 90]) perto(rumoDaOrientacao(30, beta, 0), 330, 1);
    perto(rumoDaOrientacao(90, 90, 0), 270, 1);
  });
  it('tela deitada soma a rotação da tela', () => {
    perto(rumoDaOrientacao(0, 0, 0, 90), 90);
    perto(rumoDaOrientacao(350, 0, 0, 90), 100);
  });
  it('suavização circular pelo menor arco', () => {
    expect(suavizarCircular(null, 100)).toBe(100);
    const x = suavizarCircular(359, 1, 0.5);
    expect(x === 0 || Math.abs(x - 360) < 1 || Math.abs(x) < 1).toBe(true);
  });
});

describe('filtro do GPS', () => {
  const base: Coord = [-46.13, -16.28];
  const KX = Math.cos((16.28 * Math.PI) / 180) * 111319.49;
  const em = (dx: number, dy: number): Coord => [base[0] + dx / KX, base[1] + dy / 111319.49];
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

  it('suaviza o ruído de ±5 m parado', () => {
    const f = new FiltroGps();
    let brutoSoma = 0, filtSoma = 0, n = 0;
    for (let i = 0; i < 60; i++) {
      const c = em(gauss() * 5, gauss() * 5);
      const e = f.atualizar({ coord: c, precisaoM: 5, tempoMs: i * 1000 })!;
      if (i >= 15) { brutoSoma += comprimentoM([base, c]) ** 2; filtSoma += comprimentoM([base, e.coord]) ** 2; n++; }
    }
    expect(Math.sqrt(filtSoma / n)).toBeLessThan(Math.sqrt(brutoSoma / n) * 0.6);
  });
  it('andando em linha reta não fica atrasado e estima o rumo', () => {
    const f = new FiltroGps();
    let somaAlong = 0, n = 0, ult = null;
    for (let i = 0; i < 80; i++) {
      const verdadeiro = em(i * 1.4, 0); // 1,4 m/s para o leste
      const c = em(i * 1.4 + gauss() * 3, gauss() * 3);
      ult = f.atualizar({ coord: c, precisaoM: 4, tempoMs: i * 1000 })!;
      if (i >= 25) { somaAlong += (ult.coord[0] - verdadeiro[0]) * KX; n++; }
    }
    expect(Math.abs(somaAlong / n)).toBeLessThan(1.2); // sem filtro de velocidade o atraso passava de 3 m
    expect(Math.abs(ult!.rumoGraus! - 90)).toBeLessThan(20);
    expect(ult!.velMs).toBeGreaterThan(0.9);
    expect(ult!.velMs).toBeLessThan(2.2);
  });
  it('parado não inventa velocidade nem rumo', () => {
    const f = new FiltroGps();
    let e = null;
    for (let i = 0; i < 60; i++) e = f.atualizar({ coord: em(gauss() * 4, gauss() * 4), precisaoM: 5, tempoMs: i * 1000 })!;
    expect(e!.velMs).toBeLessThan(0.6);
    expect(e!.rumoGraus).toBeNull();
  });
  it('o primeiro fixo ruim (±300 m) deixa de pesar depois de fixos bons', () => {
    const f = new FiltroGps();
    f.atualizar({ coord: em(250, -180), precisaoM: 300, tempoMs: 0 });
    let e = null;
    for (let i = 1; i <= 4; i++) e = f.atualizar({ coord: em(gauss() * 3, gauss() * 3), precisaoM: 6, tempoMs: i * 1000 })!;
    expect(comprimentoM([base, e!.coord])).toBeLessThan(15);
    expect(e!.precisaoM).toBeLessThan(10);
  });
  it('ignora um salto isolado, mas aceita quando o aparelho realmente se mudou', () => {
    const f = new FiltroGps();
    for (let i = 0; i < 8; i++) f.atualizar({ coord: base, precisaoM: 5, tempoMs: i * 1000 });
    const salto = f.atualizar({ coord: em(500, 0), precisaoM: 10, tempoMs: 9000 })!;
    expect(comprimentoM([base, salto.coord])).toBeLessThan(5);
    let e = salto;
    for (let i = 10; i < 16; i++) e = f.atualizar({ coord: em(500, 0), precisaoM: 6, tempoMs: i * 1000 })!;
    expect(comprimentoM([em(500, 0), e.coord])).toBeLessThan(30);
  });
  it('descarta antena/IP e fixos velhos', () => {
    const f = new FiltroGps();
    expect(f.atualizar({ coord: base, precisaoM: 5000, tempoMs: 0 })).toBeNull();
    f.atualizar({ coord: base, precisaoM: 5, tempoMs: 5000 });
    expect(f.atualizar({ coord: base, precisaoM: 5, tempoMs: 1000 })).toBeNull();
  });
  it('qualidade do sinal', () => {
    expect(qualidadeGps(null)).toBe('procurando');
    expect(qualidadeGps(30)).toBe('procurando');
    expect(qualidadeGps(12)).toBe('estabilizando');
    expect(qualidadeGps(5)).toBe('pronto');
  });
});

describe('calibração', () => {
  it('declinação aproximada do Brasil', () => {
    expect(declinacaoAproximada([-47.9, -15.8])).toBeCloseTo(-21, 0);
    const fazenda = declinacaoAproximada([-46.13, -16.28]);
    expect(fazenda).toBeLessThan(-19);
    expect(fazenda).toBeGreaterThan(-24);
    expect(declinacaoAproximada([-60, -3.1])).toBeCloseTo(-13.5, 0);
    expect(rumoVerdadeiro(100, -21)).toBe(79);
    expect(rumoVerdadeiro(10, -21)).toBe(349);
  });
  it('aprende o desvio da bússola andando (inclusive atravessando o norte)', () => {
    const a = new AprendizDesvio();
    let est: number | null = null;
    for (let i = 0; i < 12; i++) est = a.adicionar(112 + (i % 2), 1.4, 90);
    expect(Math.abs(est! - 22)).toBeLessThan(2);
    expect(a.confianca()).toBeGreaterThan(0.8);
    const b = new AprendizDesvio();
    for (let i = 0; i < 12; i++) est = b.adicionar(10, 1.5, 350);
    expect(Math.abs(est! - 20)).toBeLessThan(2);
  });
  it('ignora parado, devagar e curvas', () => {
    const a = new AprendizDesvio();
    expect(a.adicionar(100, 0.2, 80)).toBeNull();
    expect(a.adicionar(100, 1.5, null)).toBeNull();
    a.adicionar(100, 1.5, 80);
    const antes = a.amostras;
    a.adicionar(160, 1.5, 80); // virada brusca
    expect(a.amostras).toBe(antes);
  });
  it('desloca o GPS para cair no ponto conhecido e expira', () => {
    const conhecido: Coord = [-46.13416156, -16.282406];
    const KX = Math.cos((16.28 * Math.PI) / 180) * 111319.49;
    const medido: Coord = [conhecido[0] - 3 / KX, conhecido[1] - 4 / 111319.49]; // GPS 5 m ao sul-oeste
    const d = calcularDeslocamento(conhecido, medido, 1000);
    expect(Math.hypot(d.dxM, d.dyM)).toBeCloseTo(5, 1);
    expect(comprimentoM([aplicarDeslocamento(medido, d, 2000), conhecido])).toBeLessThan(0.05);
    expect(aplicarDeslocamento(medido, d, d.ate + 1)).toEqual(medido);
    expect(deslocamentoAtivo(d, 2000)).toBe(true);
    expect(deslocamentoAtivo(d, d.ate + 1)).toBe(false);
    expect(textoDeslocamento(d)).toMatch(/5,0 m a nordeste/);
  });
});

describe('guia: fonte do rumo e "Chegou"', () => {
  it('GPS andando, bússola parado, último como reserva', () => {
    expect(escolherRumo({ gpsRumo: 80, gpsVelMs: 1.4, bussolaVerdadeira: 120, ultimo: 50 })).toEqual({ rumo: 80, fonte: 'gps' });
    expect(escolherRumo({ gpsRumo: 80, gpsVelMs: 0.2, bussolaVerdadeira: 120, ultimo: 50 })).toEqual({ rumo: 120, fonte: 'bussola' });
    expect(escolherRumo({ gpsRumo: null, gpsVelMs: null, bussolaVerdadeira: null, ultimo: 50 })).toEqual({ rumo: 50, fonte: 'ultimo' });
    expect(escolherRumo({ gpsRumo: null, gpsVelMs: null, bussolaVerdadeira: null, ultimo: null })).toEqual({ rumo: null, fonte: null });
  });
  it('"Chegou" só depois de 3 leituras boas e só sai acima de 5 m', () => {
    let e = { dentro: false, seguidos: 0 };
    e = atualizarChegada(e, 2, 5); expect(e.dentro).toBe(false);
    e = atualizarChegada(e, 4, 5); expect(e.seguidos).toBe(0); // piscou para fora: recomeça
    e = atualizarChegada(e, 2.5, 5); e = atualizarChegada(e, 2, 6); expect(e.dentro).toBe(false);
    e = atualizarChegada(e, 1.8, 6); expect(e.dentro).toBe(true);
    e = atualizarChegada(e, 4.5, 6); expect(e.dentro).toBe(true); // histerese
    e = atualizarChegada(e, 5.5, 6); expect(e.dentro).toBe(false);
    let f = { dentro: false, seguidos: 0 };
    for (let i = 0; i < 5; i++) f = atualizarChegada(f, 1, 20); // precisão ruim nunca confirma
    expect(f.dentro).toBe(false);
  });
});
