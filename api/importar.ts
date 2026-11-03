import { centroide, lerKml } from '../shared/kml';
import { db, erro, Req, Res } from './_db';

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// POST { nome, fuso, kml, substituir? } → cria/atualiza a fazenda e seus talhões a partir do KML.
export default async function handler(req: Req, res: Res) {
  try {
    if (req.method !== 'POST') return erro(res, 'use POST', 405);
    const { nome, fuso, kml, substituir, id: idEnviado } = req.body || {};
    if (!nome || !fuso || !kml) return erro(res, 'nome, fuso e kml são obrigatórios', 400);
    if (!['America/Sao_Paulo', 'America/Cuiaba'].includes(fuso) && !/^[A-Za-z_]+\/[A-Za-z_]+$/.test(fuso)) return erro(res, 'fuso inválido', 400);
    if (String(kml).length > 5_000_000) return erro(res, 'KML grande demais (máx. 5 MB)', 413);
    const r = lerKml(String(kml));
    if (!r.talhoes.length) return erro(res, r.avisos.join(' '), 422);
    const id = idEnviado ? slug(String(idEnviado)) : slug(nome);
    const todos = r.talhoes.map((t) => ({ lat: t.lat, lon: t.lon }));
    const c = centroide([...todos.map((p) => [p.lon, p.lat] as [number, number]), [todos[0].lon, todos[0].lat]]);
    await db('fazendas', { method: 'POST', upsert: 'id', body: [{ id, nome, fuso, lat: c.lat, lon: c.lon }], retorno: false });
    if (substituir) await db('talhoes', { method: 'DELETE', query: `fazenda_id=eq.${id}`, retorno: false });
    await db('talhoes', {
      method: 'POST',
      upsert: 'fazenda_id,nome',
      retorno: false,
      body: r.talhoes.map((t) => ({
        fazenda_id: id,
        nome: t.nome,
        ha: t.ha,
        geom: { type: 'Polygon', coordinates: [t.anel] },
        lat: t.lat,
        lon: t.lon,
      })),
    });
    res.status(200).json({ fazenda_id: id, importados: r.talhoes.length, ha_total: Math.round(r.talhoes.reduce((s, t) => s + t.ha, 0)), avisos: r.avisos });
  } catch (e) {
    erro(res, e);
  }
}
