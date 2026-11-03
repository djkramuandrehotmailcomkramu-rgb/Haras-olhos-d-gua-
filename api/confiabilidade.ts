import { db, erro, q1, Req, Res } from './_db';

export default async function handler(req: Req, res: Res) {
  try {
    const fid = q1(req.query.fazenda);
    if (!fid) return erro(res, 'parâmetro fazenda obrigatório', 400);
    const q = `fazenda_id=eq.${encodeURIComponent(fid)}`;
    const [pluv, hind] = await Promise.all([db<any[]>('erro_modelo', { query: q }), db<any[]>('erro_hindcast', { query: q })]);
    const rows = [...pluv.map((r) => ({ ...r, fonte: 'pluviometro' })), ...hind.map((r) => ({ ...r, fonte: 'hindcast' }))];
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.status(200).json(rows);
  } catch (e) {
    erro(res, e);
  }
}
