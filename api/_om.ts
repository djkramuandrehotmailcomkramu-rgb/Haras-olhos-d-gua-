import type { ForecastRaw, MeteoRaw } from '../shared/tipos';

const MODELOS = 'best_match,ecmwf_ifs025,gfs_seamless,icon_seamless';

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
    `&hourly=wind_speed_10m,temperature_2m,relative_humidity_2m` +
    `&timezone=${encodeURIComponent(fuso)}&past_days=${pastDays}&forecast_days=${forecastDays}&timeformat=unixtime`;
  return getJson(u);
}
