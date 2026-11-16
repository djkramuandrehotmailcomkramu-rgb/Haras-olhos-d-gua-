import { areaM2, perimetroM, comprimentoM, fecharAnel, type Coord } from '../geo/medidas';
import type { Talhao, Medicao } from '../store/dados';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();

export type Importado = {
  poligonos: { nome: string; pontos: Coord[] }[];
  linhas: { nome: string; pontos: Coord[] }[];
};

// ---------- exportação ----------

export function paraGeoJSON(talhoes: Talhao[], medicoes: Medicao[] = []): string {
  const feats = [
    ...talhoes.map((t) => ({
      type: 'Feature',
      properties: {
        nome: t.nome, fazenda: t.fazenda, cultura: t.cultura, safra: t.safra,
        area_ha: +(areaM2(t.contorno) / 10000).toFixed(4), perimetro_m: +perimetroM(t.contorno).toFixed(1),
      },
      geometry: { type: 'Polygon', coordinates: [fecharAnel(t.contorno)] },
    })),
    ...medicoes.map((m) =>
      m.tipo === 'area'
        ? { type: 'Feature', properties: { nome: m.nome, area_ha: +(areaM2(m.pontos) / 10000).toFixed(4) }, geometry: { type: 'Polygon', coordinates: [fecharAnel(m.pontos)] } }
        : { type: 'Feature', properties: { nome: m.nome, comprimento_m: +comprimentoM(m.pontos).toFixed(1) }, geometry: { type: 'LineString', coordinates: m.pontos } },
    ),
  ];
  return JSON.stringify({ type: 'FeatureCollection', features: feats }, null, 2);
}

const coordsKml = (pts: Coord[]) => pts.map((c) => `${c[0]},${c[1]},0`).join(' ');

export function paraKML(talhoes: Talhao[], medicoes: Medicao[] = []): string {
  const poly = (nome: string, desc: string, pts: Coord[]) =>
    `<Placemark><name>${esc(nome)}</name><description>${esc(desc)}</description><Polygon><outerBoundaryIs><LinearRing><coordinates>${coordsKml(fecharAnel(pts))}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
  const linha = (nome: string, pts: Coord[]) =>
    `<Placemark><name>${esc(nome)}</name><LineString><coordinates>${coordsKml(pts)}</coordinates></LineString></Placemark>`;
  const corpo = [
    ...talhoes.map((t) => poly(t.nome, `${t.fazenda} · ${t.cultura} ${t.safra} · ${(areaM2(t.contorno) / 10000).toFixed(2)} ha`, t.contorno)),
    ...medicoes.map((m) => (m.tipo === 'area' ? poly(m.nome, `${(areaM2(m.pontos) / 10000).toFixed(2)} ha`, m.pontos) : linha(m.nome, m.pontos))),
  ].join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>GPSThomas</name>\n${corpo}\n</Document></kml>\n`;
}

export function paraGPX(talhoes: Talhao[], medicoes: Medicao[] = []): string {
  const trk = (nome: string, pts: Coord[]) =>
    `<trk><name>${esc(nome)}</name><trkseg>${pts.map((c) => `<trkpt lat="${c[1]}" lon="${c[0]}"></trkpt>`).join('')}</trkseg></trk>`;
  const corpo = [
    ...talhoes.map((t) => trk(t.nome, fecharAnel(t.contorno))),
    ...medicoes.map((m) => trk(m.nome, m.tipo === 'area' ? fecharAnel(m.pontos) : m.pontos)),
  ].join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GPSThomas" xmlns="http://www.topografix.com/GPX/1/1">\n${corpo}\n</gpx>\n`;
}

export function paraCSV(talhoes: Talhao[]): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const linhas = talhoes.map((t) =>
    [q(t.nome), q(t.fazenda), q(t.cultura), q(t.safra), (areaM2(t.contorno) / 10000).toFixed(4), perimetroM(t.contorno).toFixed(1), t.contorno.length].join(';'),
  );
  return ['nome;fazenda;cultura;safra;area_ha;perimetro_m;vertices', ...linhas].join('\n') + '\n';
}

// ---------- importação ----------

const semFechamento = (pts: Coord[]): Coord[] => {
  if (pts.length > 1) {
    const a = pts[0], z = pts[pts.length - 1];
    if (a[0] === z[0] && a[1] === z[1]) return pts.slice(0, -1);
  }
  return pts;
};
const valida = (c: unknown): c is Coord => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number' && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;

export function lerGeoJSON(texto: string): Importado {
  const out: Importado = { poligonos: [], linhas: [] };
  let raiz: any;
  try { raiz = JSON.parse(texto); } catch { return out; }
  const feats: any[] =
    raiz?.type === 'FeatureCollection' ? raiz.features ?? [] : raiz?.type === 'Feature' ? [raiz] : raiz?.type ? [{ type: 'Feature', properties: {}, geometry: raiz }] : [];
  let n = 1;
  for (const f of feats) {
    const g = f?.geometry;
    const p = f?.properties ?? {};
    const nome = String(p.nome ?? p.name ?? p.Name ?? p.NOME ?? '').trim();
    const cuida = (pts: unknown, tipo: 'poligonos' | 'linhas') => {
      if (!Array.isArray(pts)) return;
      const lista = pts.map((c: any) => [Number(c?.[0]), Number(c?.[1])] as Coord).filter(valida);
      const final = tipo === 'poligonos' ? semFechamento(lista) : lista;
      if (final.length >= (tipo === 'poligonos' ? 3 : 2)) out[tipo].push({ nome: nome || `Importado ${n++}`, pontos: final });
    };
    if (g?.type === 'Polygon') cuida(g.coordinates?.[0], 'poligonos');
    else if (g?.type === 'MultiPolygon') (g.coordinates ?? []).forEach((pg: any) => cuida(pg?.[0], 'poligonos'));
    else if (g?.type === 'LineString') cuida(g.coordinates, 'linhas');
    else if (g?.type === 'MultiLineString') (g.coordinates ?? []).forEach((ln: any) => cuida(ln, 'linhas'));
  }
  return out;
}

const lerCoordsKml = (bloco: string): Coord[] =>
  bloco
    .trim()
    .split(/\s+/)
    .map((s) => s.split(',').map(Number))
    .map((v) => [v[0], v[1]] as Coord)
    .filter(valida);

export function lerKML(texto: string): Importado {
  const out: Importado = { poligonos: [], linhas: [] };
  const marcas = texto.match(/<Placemark[\s\S]*?<\/Placemark>/gi) ?? [];
  let n = 1;
  for (const pm of marcas) {
    const nome = unesc(/<name>([\s\S]*?)<\/name>/i.exec(pm)?.[1] ?? '') || `Importado ${n++}`;
    const coords = /<coordinates>([\s\S]*?)<\/coordinates>/i.exec(pm)?.[1];
    if (!coords) continue;
    const pts = lerCoordsKml(coords);
    if (/<Polygon/i.test(pm)) {
      const s = semFechamento(pts);
      if (s.length >= 3) out.poligonos.push({ nome, pontos: s });
    } else if (/<LineString/i.test(pm) && pts.length >= 2) out.linhas.push({ nome, pontos: pts });
  }
  return out;
}

export function lerGPX(texto: string): Importado {
  const out: Importado = { poligonos: [], linhas: [] };
  const blocos = [...(texto.match(/<trk>[\s\S]*?<\/trk>/gi) ?? []), ...(texto.match(/<rte>[\s\S]*?<\/rte>/gi) ?? [])];
  let n = 1;
  for (const b of blocos) {
    const nome = unesc(/<name>([\s\S]*?)<\/name>/i.exec(b)?.[1] ?? '') || `Trilha ${n++}`;
    const pts: Coord[] = [];
    for (const tag of b.match(/<(?:trkpt|rtept)\b[^>]*>/gi) ?? []) {
      const lat = Number(/lat="([^"]+)"/i.exec(tag)?.[1]);
      const lon = Number(/lon="([^"]+)"/i.exec(tag)?.[1]);
      if (valida([lon, lat])) pts.push([lon, lat]);
    }
    if (pts.length >= 2) out.linhas.push({ nome, pontos: pts });
  }
  return out;
}

export function lerArquivo(texto: string): Importado {
  const t = texto.trim();
  if (t.startsWith('{')) return lerGeoJSON(t);
  if (/<kml/i.test(t)) return lerKML(t);
  if (/<gpx/i.test(t)) return lerGPX(t);
  return { poligonos: [], linhas: [] };
}
