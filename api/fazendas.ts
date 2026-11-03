import { db, erro, Req, Res } from './_db';

export default async function handler(_req: Req, res: Res) {
  try {
    const fazendas = await db<any[]>('fazendas', { query: 'order=nome' });
    const talhoes = await db<any[]>('talhoes', { query: 'select=fazenda_id' });
    const cont: Record<string, number> = {};
    for (const t of talhoes) cont[t.fazenda_id] = (cont[t.fazenda_id] || 0) + 1;
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    res.status(200).json(fazendas.map((f) => ({ ...f, n_talhoes: cont[f.id] || 0 })));
  } catch (e) {
    erro(res, e);
  }
}
