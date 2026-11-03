import { db, erro, q1, Req, Res } from './_db';

export default async function handler(req: Req, res: Res) {
  try {
    const fid = q1(req.query.fazenda);
    if (req.method === 'GET') {
      if (!fid) return erro(res, 'parâmetro fazenda obrigatório', 400);
      const de = q1(req.query.de);
      const f = de && /^\d{4}-\d{2}-\d{2}$/.test(de) ? `&data=gte.${de}` : '';
      const rows = await db('chuva_medida', {
        query: `fazenda_id=eq.${encodeURIComponent(fid)}${f}&select=id,fazenda_id,talhao_id,data,mm,origem,obs&order=data.desc&limit=5000`,
      });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const itens = Array.isArray(req.body) ? req.body : [req.body];
      const ok = itens.every(
        (m: any) => m && m.fazenda_id && /^\d{4}-\d{2}-\d{2}$/.test(m.data) && typeof m.mm === 'number' && m.mm >= 0 && m.mm < 500,
      );
      if (!ok) return erro(res, 'dados inválidos (fazenda_id, data yyyy-mm-dd, mm 0–500)', 400);
      const out = await db('chuva_medida', {
        method: 'POST',
        body: itens.map((m: any) => ({
          fazenda_id: m.fazenda_id,
          talhao_id: m.talhao_id || null,
          data: m.data,
          mm: Math.round(m.mm * 10) / 10,
          origem: m.origem || 'pluviometro',
          obs: m.obs ? String(m.obs).slice(0, 500) : null,
          foto: typeof m.foto === 'string' && m.foto.length < 400_000 ? m.foto : null,
        })),
      });
      return res.status(201).json(out);
    }
    if (req.method === 'DELETE') {
      const id = q1(req.query.id);
      if (!/^[0-9a-f-]{36}$/.test(id)) return erro(res, 'id inválido', 400);
      await db('chuva_medida', { method: 'DELETE', query: `id=eq.${id}`, retorno: false });
      return res.status(200).json({ ok: true });
    }
    erro(res, 'método não suportado', 405);
  } catch (e) {
    erro(res, e);
  }
}
