import type { Anel } from './tipos';

export interface TalhaoKml {
  nome: string;
  ha: number;
  anel: Anel;
  lat: number;
  lon: number;
}

export interface ResultadoKml {
  talhoes: TalhaoKml[];
  avisos: string[];
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

/** Área de um anel [lon,lat] em hectares (aproximação equiretangular local). */
export function areaHa(anel: Anel): number {
  if (anel.length < 4) return 0;
  const lat0 = (anel.reduce((s, p) => s + p[1], 0) / anel.length) * (Math.PI / 180);
  const kx = 111320 * Math.cos(lat0);
  const ky = 110574;
  let a = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    a += anel[i][0] * kx * anel[i + 1][1] * ky - anel[i + 1][0] * kx * anel[i][1] * ky;
  }
  return Math.abs(a) / 2 / 10000;
}

/** Centroide (média ponderada por área; cai para média simples em polígonos degenerados). */
export function centroide(anel: Anel): { lat: number; lon: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    const f = anel[i][0] * anel[i + 1][1] - anel[i + 1][0] * anel[i][1];
    a += f;
    cx += (anel[i][0] + anel[i + 1][0]) * f;
    cy += (anel[i][1] + anel[i + 1][1]) * f;
  }
  if (Math.abs(a) < 1e-14) {
    const n = anel.length || 1;
    return { lon: anel.reduce((s, p) => s + p[0], 0) / n, lat: anel.reduce((s, p) => s + p[1], 0) / n };
  }
  return { lon: cx / (3 * a), lat: cy / (3 * a) };
}

/** Douglas-Peucker em graus; tolerância 3e-5 ≈ 3 m. */
export function simplificar(anel: Anel, tol = 3e-5): Anel {
  if (anel.length <= 8) return anel;
  const pts = anel.slice(0, -1);
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let max = 0;
    let idx = -1;
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[j];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1e-12;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs(dy * pts[k][0] - dx * pts[k][1] + x2 * y1 - y2 * x1) / len;
      if (d > max) {
        max = d;
        idx = k;
      }
    }
    if (max > tol && idx > 0) {
      keep[idx] = true;
      stack.push([i, idx], [idx, j]);
    }
  }
  const out = pts.filter((_, i) => keep[i]);
  if (out.length < 3) return anel;
  out.push(out[0]);
  return out;
}

function lerAneis(bloco: string): Anel[] {
  const aneis: Anel[] = [];
  const re = /<Polygon[\s\S]*?<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bloco))) {
    const pts = m[1]
      .trim()
      .split(/\s+/)
      .map((c) => c.split(',').map(Number))
      .filter((c) => c.length >= 2 && isFinite(c[0]) && isFinite(c[1]))
      .map((c) => [c[0], c[1]] as [number, number]);
    if (pts.length >= 3) {
      const a = pts[0];
      const b = pts[pts.length - 1];
      if (a[0] !== b[0] || a[1] !== b[1]) pts.push([a[0], a[1]]);
      aneis.push(pts);
    }
  }
  return aneis;
}

/** Lê um KML (Google Earth) sem depender de DOM: serve no servidor e no celular. */
export function lerKml(texto: string): ResultadoKml {
  const avisos: string[] = [];
  const placemarks = texto.match(/<Placemark[\s\S]*?<\/Placemark>/g) || [];
  const talhoes: TalhaoKml[] = [];
  const vistos = new Map<string, number>();

  for (const p of placemarks) {
    const sd: Record<string, string> = {};
    for (const m of p.matchAll(/<SimpleData name="([^"]+)">([\s\S]*?)<\/SimpleData>/g)) sd[m[1].toLowerCase()] = decode(m[2]);
    const nomeTag = /<name>([\s\S]*?)<\/name>/.exec(p);
    const nome = sd['talhao'] || sd['talhão'] || sd['nome'] || sd['name'] || (nomeTag ? decode(nomeTag[1]) : '');
    if (!nome) {
      avisos.push('Polígono sem nome ignorado.');
      continue;
    }
    const aneis = lerAneis(p);
    if (!aneis.length) {
      avisos.push(`"${nome}": sem polígono (ponto/linha) — ignorado.`);
      continue;
    }
    // vários polígonos no mesmo Placemark: usa o maior
    const anel = simplificar(aneis.sort((a, b) => areaHa(b) - areaHa(a))[0]);
    const ha = areaHa(anel);
    const c = centroide(anel);
    const chave = nome.trim().toLowerCase();
    if (vistos.has(chave)) {
      const prev = talhoes[vistos.get(chave)!];
      if (Math.abs(prev.ha - ha) < 0.05) avisos.push(`"${nome}" aparece duplicado no KML (mesma área); mantido uma vez.`);
      else avisos.push(`"${nome}" aparece duas vezes com áreas diferentes; mantido o primeiro.`);
      continue;
    }
    vistos.set(chave, talhoes.length);
    talhoes.push({ nome: nome.trim(), ha: Math.round(ha * 10) / 10, anel, lat: c.lat, lon: c.lon });
  }
  if (!talhoes.length) avisos.push('Nenhum talhão válido encontrado no KML.');
  return { talhoes, avisos };
}
