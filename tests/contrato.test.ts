// Contrato contra a API REAL (Open-Meteo via /api/previsao). Roda só com CONTRATO_URL definido:
//   CONTRATO_URL=https://chuva-pro-fazenda-itaguaia.vercel.app npx vitest run tests/contrato.test.ts
import { describe, expect, it } from 'vitest';
import { diasPrevistos, horasPrevistas, hojeLocal, semaforos } from '../shared/calc';
import { MODELOS } from '../shared/tipos';
import type { PayloadPrevisao } from '../shared/tipos';

const URL_ = process.env.CONTRATO_URL;
describe.skipIf(!URL_)('contrato com dados reais', async () => {
  const p: PayloadPrevisao = await fetch(`${URL_}/api/previsao?fazenda=lagoa-formosa&km=5`).then((r) => r.json());
  it('2+ grupos cobrindo os 18 talhões, sem erros de coleta', () => {
    expect(p.erros).toEqual([]);
    expect(p.grupos.length).toBeGreaterThanOrEqual(2);
    expect(p.grupos.flatMap((g) => g.talhoes)).toHaveLength(18);
  });
  it('chaves por modelo (sufixo _<modelo>) e séries do mesmo tamanho', () => {
    for (const g of p.grupos) {
      const n = g.forecast.hourly.time.length;
      for (const m of MODELOS) {
        expect((g.forecast.hourly[`precipitation_${m}`] as unknown[]).length).toBe(n);
        expect((g.forecast.hourly[`precipitation_probability_${m}`] as unknown[]).length).toBe(n);
        expect((g.forecast.daily[`precipitation_sum_${m}`] as unknown[]).length).toBe(g.forecast.daily.time.length);
      }
      expect(n).toBeGreaterThanOrEqual(16 * 24);
      expect(g.forecast.utc_offset_seconds).toBe(-10800);
    }
  });
  it('valores plausíveis (mm ≥ 0, prob 0–100) e nulos só onde o modelo não cobre', () => {
    for (const g of p.grupos)
      for (const m of MODELOS) {
        for (const v of g.forecast.hourly[`precipitation_${m}`] as (number | null)[]) if (v != null) expect(v).toBeGreaterThanOrEqual(0);
        for (const v of g.forecast.hourly[`precipitation_probability_${m}`] as (number | null)[]) if (v != null) expect(v >= 0 && v <= 100).toBe(true);
      }
  });
  it('cálculo roda sobre dados reais e acha o dia de hoje', () => {
    const g = p.grupos[0];
    const hoje = hojeLocal(p.fazenda.fuso);
    const dias = diasPrevistos(g.forecast, p.fazenda.fuso, [], hoje);
    const d = dias.find((x) => x.data === hoje);
    expect(d).toBeTruthy();
    expect(d!.nModelos).toBeGreaterThanOrEqual(3);
    expect(d!.min! <= d!.provavel! + 1e-9 && d!.provavel! <= d!.max! + 1e-9).toBe(true);
    const horas = horasPrevistas(g.forecast, g.meteo, p.fazenda.fuso, [], hoje);
    expect(horas.filter((h) => h.data === hoje)).toHaveLength(24);
    const s = semaforos(horas.filter((h) => h.data === hoje), d!.provavel, null);
    expect(['verde', 'amarelo', 'vermelho', 'sem-dados']).toContain(s.pulverizacao.estado);
  });
  it('grupos distintos usam células de grade distintas (não finge diferença entre talhões da mesma célula)', () => {
    const cel = new Set(p.grupos.map((g) => `${g.grade.lat},${g.grade.lon}`));
    expect(cel.size).toBe(p.grupos.length);
  });
});
