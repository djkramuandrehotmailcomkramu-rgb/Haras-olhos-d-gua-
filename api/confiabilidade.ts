import { db, erro, q1, Req, Res } from './_db';

export default async function handler(req: Req, res: Res) {
  try {
    const fid = q1(req.query.fazenda);
    if (!fid) return erro(res, 'parâmetro fazenda obrigatório', 400);
    const rows = await db('erro_modelo', { query: `fazenda_id=eq.${encodeURIComponent(fid)}` });
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.status(200).json(rows);
  } catch (e) {
    erro(res, e);
  }
}
