import { addDias, hojeLocal } from '../shared/calc';
import { db, erro, q1, Req, Res } from './_db';

// Previsão de D-1 (média dos modelos) por dia-alvo, para o comparativo previsto x medido.
export default async function handler(req: Req, res: Res) {
  try {
    const fid = q1(req.query.fazenda);
    if (!fid) return erro(res, 'parâmetro fazenda obrigatório', 400);
    const [f] = await db<any[]>('fazendas', { query: `id=eq.${encodeURIComponent(fid)}` });
    const hoje = hojeLocal(f?.fuso || 'America/Sao_Paulo');
    const rows = await db<{ rodada: string; alvo: string; mm: number }[]>('previsoes', {
      query: `fazenda_id=eq.${encodeURIComponent(fid)}&alvo=gte.${addDias(hoje, -60)}&alvo=lte.${hoje}&select=rodada,alvo,mm&limit=20000`,
    });
    const acc = new Map<string, number[]>();
    for (const r of rows) {
      const h = Math.round((Date.parse(r.alvo) - Date.parse(r.rodada.slice(0, 10))) / 86400000);
      if (h !== 1) continue;
      acc.set(r.alvo, [...(acc.get(r.alvo) || []), Number(r.mm)]);
    }
    const out = [...acc].map(([data, v]) => ({ data, prev: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 })).sort((a, b) => a.data.localeCompare(b.data));
    res.setHeader('Cache-Control', 'public, s-maxage=600');
    res.status(200).json(out);
  } catch (e) {
    erro(res, e);
  }
}
