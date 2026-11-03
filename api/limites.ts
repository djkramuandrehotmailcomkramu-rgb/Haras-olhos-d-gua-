import { LIMITES_PADRAO } from '../shared/tipos';
import { db, erro, q1, Req, Res } from './_db';

export default async function handler(req: Req, res: Res) {
  try {
    const fid = q1(req.query.fazenda);
    if (!fid) return erro(res, 'parâmetro fazenda obrigatório', 400);
    if (req.method === 'PUT') {
      const cfg: Record<string, unknown> = { ...LIMITES_PADRAO };
      const padrao = LIMITES_PADRAO as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(req.body || {})) {
        if (!(k in padrao)) continue;
        if (typeof v !== typeof padrao[k]) return erro(res, `valor inválido em ${k}`, 400);
        cfg[k] = v;
      }
      await db('limites_operacao', { method: 'POST', upsert: 'fazenda_id', retorno: false, body: [{ fazenda_id: fid, cfg }] });
      return res.status(200).json(cfg);
    }
    const [r] = await db<any[]>('limites_operacao', { query: `fazenda_id=eq.${encodeURIComponent(fid)}` });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ...LIMITES_PADRAO, ...(r?.cfg || {}) });
  } catch (e) {
    erro(res, e);
  }
}
