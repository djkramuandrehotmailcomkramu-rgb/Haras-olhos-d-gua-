import area from '@turf/area';
import length from '@turf/length';
import { lineString, polygon } from '@turf/helpers';

/** Coordenada no formato [longitude, latitude], padrão GeoJSON. */
export type Coord = [number, number];

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
