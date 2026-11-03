import { describe, expect, it } from 'vitest';
import { baldeHorizonte, calcularFator, calcularPesos, estatisticasErro, faixaMm, fatorCorrecao, fmtMm, hojeLocal, partesLocais, semaforos } from '../shared/calc';
import type { ValorHora } from '../shared/calc';
import { ErroModelo, LIMITES_PADRAO } from '../shared/tipos';

const erro = (modelo: string, mae: number, n: number, h = 1, janela = 90, fonte = 'pluviometro'): ErroModelo => ({ fazenda_id: 'x', modelo, horizonte: h, janela, fonte, n_dias: n, mae, vies: 0, acerto: 0.8, atualizado_em: '' });

describe('formatação pt-BR', () => {
  it('mm com 1 casa e vírgula', () => {
    expect(fmtMm(5)).toBe('5,0');
    expect(fmtMm(12.34)).toBe('12,3');
    expect(fmtMm(null)).toBe('—');
  });
});

describe('fuso', () => {
  it('Cuiabá e São Paulo têm dias diferentes perto da meia-noite UTC', () => {
    const ts = Date.UTC(2026, 10, 3, 3, 30) / 1000; // 03:30Z
    expect(partesLocais(ts, 'America/Sao_Paulo').dia).toBe('2026-11-03'); // 00:30 -03
    expect(partesLocais(ts, 'America/Cuiaba').dia).toBe('2026-11-02'); // 23:30 -04
    expect(hojeLocal('America/Sao_Paulo', ts * 1000)).toBe('2026-11-03');
  });
});

describe('pesos do ensemble', () => {
  it('sem dados suficientes: pesos iguais e NÃO calibrado', () => {
    const r = calcularPesos([erro('ecmwf_ifs025', 1, 5), erro('gfs_seamless', 3, 5)], 1);
    expect(r.calibrado).toBe(false);
    expect(r.fonte).toBeNull();
    expect(new Set(Object.values(r.pesos)).size).toBe(1);
    expect(r.nDias).toBe(5);
  });
  it('hindcast de 90 dias (valores reais, ERA5, D+1): GFS pesa mais que ECMWF e GEM', () => {
    const h = (m: string, mae: number) => erro(m, mae, 91, 1, 90, 'hindcast');
    const r = calcularPesos([h('gfs_seamless', 0.94), h('ecmwf_ifs025', 1.11), h('ukmo_seamless', 1.15), h('icon_seamless', 1.59), h('jma_seamless', 1.62), h('gem_global', 1.71)], 1);
    expect(r.calibrado).toBe(true);
    expect(r.fonte).toBe('hindcast');
    expect(r.pesos.gfs_seamless).toBeGreaterThan(r.pesos.ecmwf_ifs025);
    expect(r.pesos.ecmwf_ifs025).toBeGreaterThan(r.pesos.gem_global);
  });
  it('o ranking inverte com o horizonte: a D+3 o GFS (MAE 2,87) pesa menos que GEM (1,14)', () => {
    const h = (m: string, mae: number) => erro(m, mae, 91, 3, 90, 'hindcast');
    const r = calcularPesos([h('gem_global', 1.14), h('ukmo_seamless', 1.28), h('ecmwf_ifs025', 1.42), h('icon_seamless', 1.6), h('jma_seamless', 2.06), h('gfs_seamless', 2.87)], 3);
    expect(r.pesos.gem_global).toBeGreaterThan(r.pesos.gfs_seamless * 2);
  });
  it('encolhimento: com poucos dias o peso fica perto do igual', () => {
    const f = (n: number) => calcularPesos([erro('a', 0.5, n, 1, 90, 'hindcast'), erro('ecmwf_ifs025', 0.5, n, 1, 90, 'hindcast'), erro('gfs_seamless', 3, n, 1, 90, 'hindcast')], 1);
    const poucos = f(30).pesos;
    const muitos = f(90).pesos;
    expect(poucos.gfs_seamless).toBeGreaterThan(muitos.gfs_seamless);
    expect(poucos.gfs_seamless).toBeLessThan(1);
  });
  it('pluviômetro (≥ 20 dias) tem prioridade sobre o hindcast', () => {
    const r = calcularPesos(
      [erro('ecmwf_ifs025', 0.5, 25), erro('gfs_seamless', 4, 25), erro('ecmwf_ifs025', 4, 91, 1, 90, 'hindcast'), erro('gfs_seamless', 0.5, 91, 1, 90, 'hindcast')],
      1,
    );
    expect(r.fonte).toBe('pluviometro');
    expect(r.pesos.ecmwf_ifs025).toBeGreaterThan(r.pesos.gfs_seamless);
  });
  it('baldes de horizonte', () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(baldeHorizonte)).toEqual([0, 1, 3, 3, 3, 7, 7]);
  });
});

describe('correção de viés', () => {
  it('hindcast NUNCA gera correção de viés (só pluviômetro)', () => {
    expect(fatorCorrecao([{ ...erro('_fator', 0, 90, 0, 90, 'hindcast'), vies: 1.5 }]).ativo).toBe(false);
  });
  it('inativa abaixo de 20 dias', () => {
    const r = fatorCorrecao([{ ...erro('_fator', 0, 10), vies: 1.4 }]);
    expect(r).toEqual({ fator: 1, nDias: 10, ativo: false });
  });
  it('ativa com 20+ dias', () => {
    expect(fatorCorrecao([{ ...erro('_fator', 0, 30), vies: 1.4 }]).fator).toBe(1.4);
  });
  it('calcula fator e limita a 0,5–2', () => {
    expect(calcularFator([{ prev: 10, med: 5 }])).toBe(0.5);
    expect(calcularFator([{ prev: 10, med: 100 }])).toBe(2);
    expect(calcularFator([{ prev: 10, med: 12 }])).toBeCloseTo(1.2);
    expect(calcularFator([{ prev: 0.2, med: 3 }])).toBeNull();
  });
  it('estatísticas de erro', () => {
    const s = estatisticasErro([{ prev: 5, med: 0 }, { prev: 0, med: 0 }, { prev: 2, med: 4 }, { prev: 0, med: 3 }]);
    expect(s.mae).toBeCloseTo((5 + 0 + 2 + 3) / 4);
    expect(s.vies).toBeCloseTo((5 + 0 - 2 - 3) / 4);
    expect(s.acerto).toBeCloseTo(0.5); // acerta o par 2 (ambos ≥1) e o par 0/0
  });
});

const hora = (h: number, mm: number, extra: Partial<ValorHora> = {}): ValorHora => ({ ts: h, data: '2026-11-03', hora: h, mm, prob: 10, vento: 8, rajada: null, dir: null, temp: 28, ur: 70, nuvem: null, ...extra });
const dia = (f: (h: number) => Partial<ValorHora> & { mm?: number }) => Array.from({ length: 24 }, (_, h) => hora(h, f(h).mm ?? 0, f(h)));

describe('semáforos e janelas', () => {
  it('dia seco e calmo: pulverização verde com janela longa', () => {
    const s = semaforos(dia(() => ({})), 0, 0);
    expect(s.pulverizacao.estado).toBe('verde');
    expect(s.pulverizacao.janela).toEqual({ ini: 6, fim: 20 });
  });
  it('vento forte o dia todo: vermelho', () => {
    const s = semaforos(dia(() => ({ vento: 25 })), 0, 0);
    expect(s.pulverizacao.estado).toBe('vermelho');
  });
  it('chuva à tarde: melhor janela é a manhã', () => {
    const s = semaforos(dia((h) => ({ mm: h >= 14 ? 4 : 0 })), 16, 0);
    expect(s.pulverizacao.janela!.fim).toBeLessThanOrEqual(13);
    expect(s.plantio.estado).toBe('vermelho'); // 16 mm > limite 10
  });
  it('janela curta → amarelo', () => {
    const s = semaforos(dia((h) => ({ mm: h >= 9 ? 3 : 0 })), 8, 0);
    expect(['amarelo', 'verde']).toContain(s.pulverizacao.estado);
    const curto = semaforos(dia((h) => ({ mm: h > 10 ? 3 : 0 })), 8, 0, { ...LIMITES_PADRAO, janela_min_h: 6 });
    expect(curto.pulverizacao.estado).toBe('amarelo');
  });
  it('plantio vermelho com solo encharcado medido', () => {
    expect(semaforos(dia(() => ({})), 1, 55).plantio.estado).toBe('vermelho');
  });
  it('colheita exige UR baixa', () => {
    expect(semaforos(dia(() => ({ ur: 95 })), 0, 0).colheita.estado).toBe('vermelho');
    expect(semaforos(dia(() => ({ ur: 60 })), 0, 0).colheita.estado).toBe('verde');
  });
  it('sem horas operacionais restantes: sem-dados', () => {
    expect(semaforos([hora(22, 0)], 0, 0).pulverizacao.estado).toBe('sem-dados');
  });
});

describe('faixas do mapa', () => {
  it('limites 0, <1, 1–5, 5–15, 15–30, 30+', () => {
    expect([0, 0.5, 1, 4.9, 5, 14.9, 15, 29.9, 30, 80].map(faixaMm)).toEqual([0, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
});
