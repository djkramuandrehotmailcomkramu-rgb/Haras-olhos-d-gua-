import { agrupar } from '../shared/grupos';
import type { Fazenda, Grupo, PayloadPrevisao, Talhao } from '../shared/tipos';
import { db, erro, q1, Req, Res } from './_db';
import { buscarForecast, buscarMeteo } from './_om';

// Previsão por GRUPO de talhões (~5 km), cacheada 30 min na CDN para todos os usuários.
export default async function handler(req: Req, res: Res) {
  try {
    const fid = q1(req.query.fazenda);
    if (!fid) return erro(res, 'parâmetro fazenda obrigatório', 400);
    const km = Math.min(20, Math.max(1, Number(q1(req.query.km)) || 5));
    const [faz] = await db<Fazenda[]>('fazendas', { query: `id=eq.${encodeURIComponent(fid)}` });
    if (!faz) return erro(res, 'fazenda não encontrada', 404);
    const talhoes = await db<Talhao[]>('talhoes', { query: `fazenda_id=eq.${encodeURIComponent(fid)}&select=id,lat,lon` });
    if (!talhoes.length) return erro(res, 'fazenda sem talhões: importe o KML em Ajustes', 404);

    const gps = agrupar(talhoes, km);
    const erros: string[] = [];
    const grupos: Grupo[] = [];
    await Promise.all(
      gps.map(async (g) => {
        try {
          const [forecast, meteo] = await Promise.all([
            buscarForecast(g.lat, g.lon, faz.fuso),
            buscarMeteo(g.lat, g.lon, faz.fuso).catch((e) => {
              erros.push(`vento/temperatura/UR do grupo ${g.id}: ${e.message}`);
              return null;
            }),
          ]);
          grupos.push({
            id: g.id,
            lat: g.lat,
            lon: g.lon,
            talhoes: g.ids,
            grade: { lat: forecast.latitude, lon: forecast.longitude, elev: forecast.elevation },
            forecast,
            meteo,
          });
        } catch (e) {
          erros.push(`grupo ${g.id}: ${(e as Error).message}`);
        }
      }),
    );
    if (!grupos.length) return erro(res, `Open-Meteo indisponível: ${erros.join(' | ')}`, 502);
    grupos.sort((a, b) => a.id.localeCompare(b.id));
    const out: PayloadPrevisao = { fazenda: faz, gerado_em: new Date().toISOString(), grupos, erros };
    res.setHeader('Cache-Control', erros.length ? 'public, s-maxage=60' : 'public, s-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json(out);
  } catch (e) {
    erro(res, e);
  }
}
