import { db, erro, q1, Req, Res } from './_db';

export default async function handler(req: Req, res: Res) {
  try {
    const fid = q1(req.query.fazenda);
    if (!fid) return erro(res, 'parâmetro fazenda obrigatório', 400);
    const t = await db('talhoes', { query: `fazenda_id=eq.${encodeURIComponent(fid)}&order=nome` });
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    res.status(200).json(t);
  } catch (e) {
    erro(res, e);
  }
}
