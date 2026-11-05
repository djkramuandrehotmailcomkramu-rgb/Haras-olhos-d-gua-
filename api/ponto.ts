import type { ErroModelo, Grupo, Lugar, PayloadLugar } from '../shared/tipos';
import { erro, q1, Req, Res } from './_db';
import { calcularHindcast } from './_hind';
import { buscarEnsemble, buscarForecast, buscarMeteo } from './_om';

// Previsão completa para QUALQUER ponto (lat, lon), com pesos dos modelos calculados no histórico daquele ponto.
export default async function handler(req: Req, res: Res) {
  try {
    const lat = Math.round(Number(q1(req.query.lat)) * 100) / 100;
    const lon = Math.round(Number(q1(req.query.lon)) * 100) / 100;
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return erro(res, 'lat/lon inválidos', 400);
    const lugar: Lugar = { nome: q1(req.query.nome).slice(0, 80) || `${lat}, ${lon}`, detalhe: q1(req.query.detalhe).slice(0, 120), lat, lon, tipo: q1(req.query.tipo).slice(0, 20) };

    const erros: string[] = [];
    const forecast = await buscarForecast(lat, lon, 'auto');
    const fuso: string = (forecast as any).timezone || 'UTC';
    const [meteo, ens, hind] = await Promise.all([
      buscarMeteo(lat, lon, fuso).catch((e) => (erros.push(`vento/temperatura/UR: ${e.message}`), null)),
      buscarEnsemble(lat, lon, fuso).catch((e) => (erros.push(`ensemble: ${e.message}`), null)),
      calcularHindcast('ponto', lat, lon, fuso).then((h) => h.linhas.map((l): ErroModelo => ({ ...l, fonte: 'hindcast' }))).catch((e) => (erros.push(`histórico de calibração: ${e.message}`), [] as ErroModelo[])),
    ]);
    const grupo: Grupo = { id: 'ponto', lat, lon, talhoes: [], grade: { lat: forecast.latitude, lon: forecast.longitude, elev: forecast.elevation }, forecast, meteo, ens };
    const out: PayloadLugar = { lugar, fuso, gerado_em: new Date().toISOString(), grupo, hind, erros };
    res.setHeader('Cache-Control', erros.length ? 'public, s-maxage=60' : 'public, s-maxage=600, stale-while-revalidate=1800');
    res.status(200).json(out);
  } catch (e) {
    erro(res, e);
  }
}
