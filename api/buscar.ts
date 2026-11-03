import { erro, q1, Req, Res } from './_db';

// Pesquisa de local (cidade, estado ou município) pelo geocoder gratuito do Open-Meteo.
export default async function handler(req: Req, res: Res) {
  try {
    const q = q1(req.query.q).trim();
    if (q.length < 2) return res.status(200).json([]);
    if (q.length > 80) return erro(res, 'busca longa demais', 400);
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=pt&format=json`, { headers: { 'User-Agent': 'chuva-pro/1.0' } });
    const j: any = await r.json();
    if (!r.ok || j.error) throw new Error(`geocodificação falhou: ${j.reason || r.status}`);
    const tipo = (f: string) => (f === 'ADM1' ? 'Estado' : f === 'ADM2' ? 'Município' : f === 'PCLI' ? 'País' : f?.startsWith('PPL') ? 'Cidade' : 'Local');
    const out = (j.results || []).slice(0, 8).map((x: any) => ({
      nome: x.name,
      detalhe: [x.admin2 && x.admin2 !== x.name ? x.admin2 : null, x.admin1, x.country].filter(Boolean).join(', '),
      lat: Math.round(x.latitude * 100) / 100,
      lon: Math.round(x.longitude * 100) / 100,
      tipo: tipo(x.feature_code),
    }));
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json(out);
  } catch (e) {
    erro(res, e);
  }
}
