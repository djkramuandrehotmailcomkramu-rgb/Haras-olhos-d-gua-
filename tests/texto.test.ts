import { describe, expect, it } from 'vitest';
import { LIMITES_PADRAO } from '../shared/tipos';
import type { ValorDia, ValorHora } from '../shared/calc';
import { causaPrincipal, classeChuva, confianca, fraseTrabalho, iconeDia, periodos, quandoChove, resumoDia } from '../shared/texto';

const hr = (hora: number, mm = 0, extra: Partial<ValorHora> = {}): ValorHora => ({ ts: hora, data: '2026-11-05', hora, mm, prob: 10, vento: 8, rajada: 12, dir: 90, temp: 28, ur: 70, nuvem: 30, ...extra });
const dia = (mm: number, prob: number, n = 6): ValorDia => ({ data: '2026-11-05', ts: 0, porModelo: {}, bruto: mm, provavel: mm, min: mm, max: mm, prob, probFonte: 'ensemble', q10: 0, q90: mm * 2, p10mm: 0, nModelos: n });
const dia24 = (f: (h: number) => number, e: Partial<ValorHora> = {}) => Array.from({ length: 24 }, (_, h) => hr(h, f(h), e));

describe('escala de chuva em palavras', () => {
  it('limites 0,2 / 2 / 10 / 25 / 50 mm', () => {
    expect([0, 0.1, 0.2, 1.9, 2, 9.9, 10, 24.9, 25, 49, 50, 120].map((v) => classeChuva(v).id)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(classeChuva(15).nome).toBe('Chuva forte');
    expect(classeChuva(null).nome).toBe('Sem chuva');
  });
});

describe('ícone do dia', () => {
  it('chuva manda; sem chuva depende das nuvens', () => {
    expect(iconeDia(0, 10)).toBe('sol');
    expect(iconeDia(0, 40)).toBe('parcial');
    expect(iconeDia(0, 90)).toBe('nuvem');
    expect(iconeDia(3, 90)).toBe('chuva');
    expect(iconeDia(14, 90)).toBe('forte');
    expect(iconeDia(30, 90)).toBe('tempestade');
    expect(iconeDia(6, 90, 70)).toBe('tempestade');
  });
});

describe('quando chove, em palavras', () => {
  it('janela curta vira "entre 15h e 18h"', () => {
    expect(quandoChove(dia24((h) => (h >= 15 && h < 18 ? 3 : 0)))).toBe('entre 15h e 18h');
  });
  it('à tarde / o dia todo / sem chuva', () => {
    expect(quandoChove(dia24((h) => (h >= 12 && h < 18 ? 2 : 0)))).toBe('à tarde');
    expect(quandoChove(dia24(() => 1))).toBe('o dia todo');
    expect(quandoChove(dia24(() => 0))).toBeNull();
  });
  it('períodos somam mm', () => {
    const p = periodos(dia24((h) => (h >= 12 && h < 18 ? 2 : 0)));
    expect(p.map((x) => x.mm)).toEqual([0, 12, 0]);
  });
});

describe('frase principal do dia', () => {
  it('dia seco', () => {
    const r = resumoDia(dia(0, 10), dia24(() => 0), true, 8);
    expect(r.titulo).toBe('Hoje não deve chover');
    expect(['sol', 'parcial', 'nuvem']).toContain(r.icone);
  });
  it('chuva forte à tarde cita mm, classe e horário', () => {
    const r = resumoDia(dia(12, 90), dia24((h) => (h >= 15 && h < 18 ? 4 : 0)), true, 8);
    expect(r.titulo).toBe('Vai chover forte');
    expect(r.sub).toContain('Chuva forte');
    expect(r.sub).toContain('entre 15h e 18h');
    expect(r.sub).toContain('12,0 mm');
  });
  it('chuva que já passou hoje', () => {
    const r = resumoDia(dia(6, 80), dia24((h) => (h >= 8 && h < 10 ? 3 : 0)), true, 14);
    expect(r.titulo).toBe('A chuva de hoje já passou');
  });
  it('chance média sem volume vira "Pode chover"', () => {
    const r = resumoDia(dia(1, 45), dia24((h) => (h === 14 ? 1 : 0)), false, 0);
    expect(['Pode chover', 'Chance baixa de chuva']).toContain(r.titulo);
  });
});

describe('confiança', () => {
  it('alta quando os cenários concordam', () => expect(confianca(dia(0, 5), 1).nivel).toBe('alta'));
  it('baixa quando se dividem', () => expect(confianca(dia(3, 50), 1).nivel).toBe('baixa'));
  it('cai um nível com poucos modelos ou previsão distante', () => {
    expect(confianca(dia(0, 5, 2), 1).nivel).toBe('media');
    expect(confianca(dia(0, 5), 10).nivel).toBe('media');
    expect(confianca(dia(0, 5, 2), 10).nivel).toBe('baixa');
    expect(confianca(undefined, 0).nivel).toBe('baixa');
  });
});

describe('operação em palavras', () => {
  const lim = LIMITES_PADRAO;
  it('causa principal: vento forte', () => {
    expect(causaPrincipal('pulv', dia24(() => 0, { vento: 25 }), lim)).toBe('Vento forte');
  });
  it('causa principal: chuva vence vento', () => {
    expect(causaPrincipal('pulv', dia24(() => 2, { vento: 25 }), lim)).toBe('Chuva');
  });
  it('colheita com ar úmido', () => {
    expect(causaPrincipal('colheita', dia24(() => 0, { ur: 95 }), lim)).toBe('Ar úmido');
  });
  it('frases PODE / CUIDADO / NÃO', () => {
    const h = dia24(() => 0);
    expect(fraseTrabalho('pulv', { estado: 'verde', janela: { ini: 6, fim: 11 }, motivo: '' }, h, lim)).toEqual({ palavra: 'PODE', frase: 'Melhor horário: 06h às 11h' });
    expect(fraseTrabalho('pulv', { estado: 'amarelo', janela: { ini: 17, fim: 19 }, motivo: '' }, h, lim).palavra).toBe('CUIDADO');
    expect(fraseTrabalho('plantio', { estado: 'vermelho', janela: null, motivo: 'Solo encharcado: 55 mm' }, h, lim).frase).toMatch(/encharcado/i);
    expect(fraseTrabalho('colheita', { estado: 'vermelho', janela: null, motivo: '' }, dia24(() => 3), lim)).toEqual({ palavra: 'NÃO', frase: 'Chuva o dia todo' });
  });
});
