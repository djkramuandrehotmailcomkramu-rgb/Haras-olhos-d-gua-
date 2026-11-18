import area from '@turf/area';
import length from '@turf/length';
import { lineString, polygon } from '@turf/helpers';

/** Coordenada no formato [longitude, latitude], padrão GeoJSON. */
export type Coord = [number, number];

/** O contorno cruza a si mesmo (arestas que se atravessam)? Nesse caso a área e a divisão ficam erradas. */
export function contornoCruzado(pts: Coord[]): boolean {
  const a = fecharAnel(pts);
  const n = a.length - 1; // arestas
  if (n < 4) return false;
  const kx = Math.cos((a[0][1] * Math.PI) / 180);
  const P = a.map((c) => [c[0] * kx, c[1]]);
  const cruz = (o: number[], p: number[], q: number[]) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // primeira e última aresta se encostam no ponto de fechamento
      const [p1, p2, p3, p4] = [P[i], P[i + 1], P[j], P[j + 1]];
      if (cruz(p1, p2, p3) * cruz(p1, p2, p4) < 0 && cruz(p3, p4, p1) * cruz(p3, p4, p2) < 0) return true;
    }
  }
  return false;
}

/** Fecha o anel se o último ponto ainda não repete o primeiro. */
export function fecharAnel(pts: Coord[]): Coord[] {
  if (pts.length === 0) return pts;
  const a = pts[0];
  const z = pts[pts.length - 1];
  return a[0] === z[0] && a[1] === z[1] ? pts : [...pts, a];
}

/** Área geodésica em m². Precisa de pelo menos 3 pontos distintos. */
export function areaM2(pts: Coord[]): number {
  const anel = fecharAnel(pts);
  if (anel.length < 4) return 0;
  return area(polygon([anel]));
}

/** Comprimento de uma linha aberta, em metros. */
export function comprimentoM(pts: Coord[]): number {
  if (pts.length < 2) return 0;
  return length(lineString(pts), { units: 'kilometers' }) * 1000;
}

/** Perímetro (contorno fechado), em metros. */
export function perimetroM(pts: Coord[]): number {
  if (pts.length < 3) return 0;
  return comprimentoM(fecharAnel(pts));
}
