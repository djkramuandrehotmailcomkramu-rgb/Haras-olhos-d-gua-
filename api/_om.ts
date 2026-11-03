import type { EnsDia, ForecastRaw, MeteoRaw } from '../shared/tipos';
import { MODELOS as LISTA } from '../shared/tipos';

const MODELOS = LISTA.join(',');

async function getJson(url: string, tentativas = 3): Promise<any> {
  let ultimo = '';
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'chuva-pro/1.0' } });
      const j: any = await r.json();
      if (r.ok && !j.error) return j;
      ultimo = `HTTP ${r.status} ${j.reason || ''}`;
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) {
      ultimo = String(e);
    }
    await new Promise((ok) => setTimeout(ok, 400 * (i + 1)));
  }
  throw new Error(`Open-Meteo falhou: ${ultimo}`);
}

export const fmtCoord = (n: number) => n.toFixed(4);

export function buscarForecast(lat: number, lon: number, fuso: string, pastDays = 3, forecastDays = 16): Promise<ForecastRaw> {
  const u =
    `https://api.open-meteo.com/v1/forecast?latitude=${fmtCoord(lat)}&longitude=${fmtCoord(lon)}` +
    `&hourly=precipitation,precipitation_probability` +
    `&daily=precipitation_sum,precipitation_probability_max` +
    `&models=${MODELOS}&timezone=${encodeURIComponent(fuso)}&past_days=${pastDays}&forecast_days=${forecastDays}&timeformat=unixtime`;
  return getJson(u);
}

export function buscarMeteo(lat: number, lon: number, fuso: string, pastDays = 3, forecastDays = 16): Promise<MeteoRaw> {
  const u =
    `https://api.open-meteo.com/v1/forecast?latitude=${fmtCoord(lat)}&longitude=${fmtCoord(lon)}` +
    `&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,relative_humidity_2m,cloud_cover` +
    `&daily=sunrise,sunset` +
    `&timezone=${encodeURIComponent(fuso)}&past_days=${pastDays}&forecast_days=${forecastDays}&timeformat=unixtime`;
  return getJson(u);
}

const quantil = (ord: number[], q: number) => {
  const i = (ord.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return ord[lo] + (ord[hi] - ord[lo]) * (i - lo);
};

/**
 * Ensemble ECMWF (51 membros) + GEFS (30): chuva total por dia local de cada membro →
 * % de membros com ≥ 1 mm, ≥ 10 mm e quantis P10/P50/P90. Dia só conta com 24 h completas.
 */
export async function buscarEnsemble(lat: number, lon: number, fuso: string, dias = 15): Promise<EnsDia[]> {
  const u =
    `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${fmtCoord(lat)}&longitude=${fmtCoord(lon)}` +
    `&hourly=precipitation&models=ecmwf_ifs025,gfs025&timezone=${encodeURIComponent(fuso)}&forecast_days=${dias}`;
  const j = await getJson(u);
  const tempo: string[] = j.hourly.time;
  const chaves = Object.keys(j.hourly).filter((k) => k !== 'time');
  const porDia = new Map<string, number[][]>(); // dia -> membros -> horas
  tempo.forEach((t, i) => {
    const d = t.slice(0, 10);
    if (!porDia.has(d)) porDia.set(d, chaves.map(() => []));
    const arr = porDia.get(d)!;
    chaves.forEach((k, m) => {
      const v = j.hourly[k][i];
      if (v != null) arr[m].push(v);
    });
  });
  const out: EnsDia[] = [];
  for (const [data, membros] of porDia) {
    const somas = membros.filter((h) => h.length >= 24).map((h) => h.reduce((a, b) => a + b, 0));
    if (somas.length < 10) continue;
    const ord = [...somas].sort((a, b) => a - b);
    const pct = (f: (x: number) => boolean) => Math.round((somas.filter(f).length / somas.length) * 100);
    out.push({
      data,
      n: somas.length,
      p1: pct((x) => x >= 1),
      p10mm: pct((x) => x >= 10),
      q10: Math.round(quantil(ord, 0.1) * 10) / 10,
      q50: Math.round(quantil(ord, 0.5) * 10) / 10,
      q90: Math.round(quantil(ord, 0.9) * 10) / 10,
    });
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}
