import { db, erro, Req, Res } from './_db';

// POST { fazenda_id, sub } inscreve; DELETE ?endpoint= cancela.
export default async function handler(req: Req, res: Res) {
  try {
    if (req.method === 'POST') {
      const { fazenda_id, sub } = req.body || {};
      if (!fazenda_id || !sub?.endpoint || !sub?.keys) return erro(res, 'inscrição inválida', 400);
      await db('push_subs', { method: 'POST', upsert: 'endpoint', retorno: false, body: [{ endpoint: sub.endpoint, fazenda_id, sub }] });
      return res.status(201).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const ep = String(req.query.endpoint || '');
      if (!ep) return erro(res, 'endpoint obrigatório', 400);
      await db('push_subs', { method: 'DELETE', query: `endpoint=eq.${encodeURIComponent(ep)}`, retorno: false });
      return res.status(200).json({ ok: true });
    }
    erro(res, 'método não suportado', 405);
  } catch (e) {
    erro(res, e);
  }
}
