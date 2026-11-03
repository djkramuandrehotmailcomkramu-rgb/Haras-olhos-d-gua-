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

const FAMILIAS = 'ecmwf_ifs025,ecmwf_aifs025,gfs025,icon_seamless,gem_global,ukmo_global_ensemble_20km';

/** Quantil ponderado (cada membro tem um peso; soma dos pesos = 1). */
function quantilPonderado(v: { x: number; w: number }[], q: number): number {
  const ord = [...v].sort((a, b) => a.x - b.x);
  const tot = ord.reduce((s, o) => s + o.w, 0);
  let acc = 0;
  for (const o of ord) {
    acc += o.w;
    if (acc >= q * tot - 1e-9) return o.x;
  }
  return ord[ord.length - 1].x;
}

/**
 * Ensemble multi-sistema: chuva total por dia local de cada membro; cada SISTEMA (IFS, AIFS, GEFS, ICON, GEM, UKMO)
 * pesa igual (peso do membro = 1/nº de membros do sistema). % de peso com ≥ 1 mm e ≥ 10 mm e quantis P10/P50/P90.
 * O dia só conta com 24 h completas por membro e pelo menos 2 sistemas.
 */
export async function buscarEnsemble(lat: number, lon: number, fuso: string, dias = 15): Promise<EnsDia[]> {
  const u =
    `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${fmtCoord(lat)}&longitude=${fmtCoord(lon)}` +
    `&hourly=precipitation&models=${FAMILIAS}&timezone=${encodeURIComponent(fuso)}&forecast_days=${dias}`;
  const j = await getJson(u);
  const tempo: string[] = j.hourly.time;
  const chaves = Object.keys(j.hourly).filter((k) => k !== 'time');
  const familia = (k: string) => k.replace(/^precipitation_/, '').replace(/^member\d+_/, '');
  const porDia = new Map<string, number[][]>();
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
    const porFam = new Map<string, number[]>();
    membros.forEach((h, m) => {
      if (h.length < 24) return;
      const f = familia(chaves[m]);
      porFam.set(f, [...(porFam.get(f) || []), h.reduce((a, b) => a + b, 0)]);
    });
    const fams = [...porFam.values()].filter((v) => v.length >= 5);
    if (fams.length < 2) continue;
    const pts = fams.flatMap((v) => v.map((x) => ({ x, w: 1 / v.length })));
    const wsum = pts.reduce((s, p) => s + p.w, 0);
    const pct = (f: (x: number) => boolean) => Math.round((pts.filter((p) => f(p.x)).reduce((s, p) => s + p.w, 0) / wsum) * 100);
    const r1 = (n: number) => Math.round(n * 10) / 10;
    out.push({
      data,
      n: fams.reduce((s, v) => s + v.length, 0),
      sistemas: fams.length,
      p1: pct((x) => x >= 1),
      p10mm: pct((x) => x >= 10),
      q10: r1(quantilPonderado(pts, 0.1)),
      q50: r1(quantilPonderado(pts, 0.5)),
      q90: r1(quantilPonderado(pts, 0.9)),
    });
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}
