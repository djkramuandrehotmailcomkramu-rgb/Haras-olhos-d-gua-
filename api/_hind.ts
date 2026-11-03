import { addDias, estatisticasErro, hojeLocal } from '../shared/calc';
import type { ParPrevMedido } from '../shared/calc';
import { MODELOS } from '../shared/tipos';
import { fmtCoord } from './_om';

const HORIZ: [number, string][] = [
  [0, 'precipitation'],
  [1, 'precipitation_previous_day1'],
  [3, 'precipitation_previous_day3'],
  [7, 'precipitation_previous_day7'],
];

async function jget(u: string): Promise<any> {
  const r = await fetch(u, { headers: { 'User-Agent': 'chuva-pro/1.0' } });
  const j: any = await r.json();
  if (!r.ok || j.error) throw new Error(`${new URL(u).hostname}: ${j.reason || r.status}`);
  return j;
}

/**
 * Hindcast: compara, nos últimos 90 dias, a previsão que cada modelo fez com D-0/1/3/7 de antecedência
 * contra a chuva "observada" estimada (média de ERA5 e NASA POWER/MERRA-2 corrigida). NÃO é pluviômetro:
 * serve para dar peso inicial aos modelos até haver ≥ 20 dias de chuva medida.
 */
export async function calcularHindcast(fazendaId: string, lat: number, lon: number, fuso: string) {
  const hoje = hojeLocal(fuso);
  const fim = addDias(hoje, -1);
  const ini = addDias(hoje, -91);
  const hourly = HORIZ.map((h) => h[1]).join(',');
  const prev = await jget(
    `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${fmtCoord(lat)}&longitude=${fmtCoord(lon)}&hourly=${hourly}&models=${MODELOS.join(',')}&past_days=92&forecast_days=1&timezone=${encodeURIComponent(fuso)}`,
  );
  const refs: Record<string, number>[] = [];
  try {
    const era = await jget(`https://archive-api.open-meteo.com/v1/archive?latitude=${fmtCoord(lat)}&longitude=${fmtCoord(lon)}&start_date=${ini}&end_date=${fim}&daily=precipitation_sum&timezone=${encodeURIComponent(fuso)}`);
    refs.push(Object.fromEntries(era.daily.time.map((d: string, i: number) => [d, era.daily.precipitation_sum[i]]).filter((x: [string, number | null]) => x[1] != null)));
  } catch {
    /* tenta só com a outra */
  }
  try {
    const a = ini.replace(/-/g, '');
    const b = fim.replace(/-/g, '');
    const pw = await jget(`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG&longitude=${lon.toFixed(3)}&latitude=${lat.toFixed(3)}&start=${a}&end=${b}&format=JSON`);
    const o: Record<string, number> = {};
    for (const [d, v] of Object.entries(pw.properties.parameter.PRECTOTCORR as Record<string, number>)) if (v > -900) o[`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`] = v;
    refs.push(o);
  } catch {
    /* idem */
  }
  if (!refs.length) throw new Error('nenhuma referência observada disponível (ERA5/POWER)');
  const ref = (d: string): number | null => {
    const v = refs.map((r) => r[d]).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  const tempo: string[] = prev.hourly.time;
  const linhas: any[] = [];
  for (const m of MODELOS) {
    for (const [h, pre] of HORIZ) {
      const arr: (number | null)[] | undefined = prev.hourly[`${pre}_${m}`];
      if (!arr) continue;
      const dia = new Map<string, { s: number; n: number }>();
      tempo.forEach((t, i) => {
        const d = t.slice(0, 10);
        const v = arr[i];
        const x = dia.get(d) || { s: 0, n: 0 };
        if (v != null) {
          x.s += v;
          x.n++;
        }
        dia.set(d, x);
      });
      const pares: ParPrevMedido[] = [];
      for (const [d, x] of dia) {
        const r = d >= ini && d <= fim ? ref(d) : null;
        if (x.n >= 24 && r != null) pares.push({ prev: x.s, med: r });
      }
      const st = estatisticasErro(pares);
      if (st.n < 20) continue; // modelo sem histórico suficiente nesse horizonte
      linhas.push({
        fazenda_id: fazendaId,
        modelo: m,
        horizonte: h,
        janela: 90,
        n_dias: st.n,
        mae: Math.round((st.mae as number) * 100) / 100,
        vies: Math.round((st.vies as number) * 100) / 100,
        acerto: Math.round((st.acerto as number) * 1000) / 1000,
        atualizado_em: new Date().toISOString(),
      });
    }
  }
  return { linhas, referencias: refs.length };
}
