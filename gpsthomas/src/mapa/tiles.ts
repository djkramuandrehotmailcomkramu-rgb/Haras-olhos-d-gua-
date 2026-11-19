import type { Coord } from '../geo/medidas';
import { CAMADAS, type CamadaId } from './camadas';

export type Caixa = { oeste: number; sul: number; leste: number; norte: number };

const KY = 111319.49;

/** Menor caixa (lon/lat) que contém os pontos, com uma margem em metros. */
export function caixaDeCoords(coords: Coord[], margemM = 0): Caixa | null {
  if (coords.length === 0) return null;
  let oeste = Infinity, sul = Infinity, leste = -Infinity, norte = -Infinity;
  for (const [lon, lat] of coords) { oeste = Math.min(oeste, lon); leste = Math.max(leste, lon); sul = Math.min(sul, lat); norte = Math.max(norte, lat); }
  const kx = Math.cos((((sul + norte) / 2) * Math.PI) / 180) * KY;
  return { oeste: oeste - margemM / kx, leste: leste + margemM / kx, sul: sul - margemM / KY, norte: norte + margemM / KY };
}

/** Caixa quadrada em torno de um ponto (raio em metros). */
export const caixaAoRedor = (c: Coord, raioM: number): Caixa => caixaDeCoords([c], raioM)!;

export const unir = (a: Caixa | null, b: Caixa | null): Caixa | null =>
  !a ? b : !b ? a : { oeste: Math.min(a.oeste, b.oeste), sul: Math.min(a.sul, b.sul), leste: Math.max(a.leste, b.leste), norte: Math.max(a.norte, b.norte) };

/** Área aproximada da caixa em km². */
export function areaKm2(c: Caixa): number {
  const kx = Math.cos((((c.sul + c.norte) / 2) * Math.PI) / 180) * KY;
  return ((c.leste - c.oeste) * kx * (c.norte - c.sul) * KY) / 1e6;
}

export const lonParaX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
export function latParaY(lat: number, z: number): number {
  const r = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

/** Faixa de blocos (x e y) que cobre a caixa em um zoom. */
export function faixaDeTiles(c: Caixa, z: number) {
  const max = 2 ** z - 1;
  return {
    x0: Math.max(0, lonParaX(c.oeste, z)), x1: Math.min(max, lonParaX(c.leste, z)),
    y0: Math.max(0, latParaY(c.norte, z)), y1: Math.min(max, latParaY(c.sul, z)),
  };
}

export function contarTiles(c: Caixa, zmin: number, zmax: number): number {
  let n = 0;
  for (let z = zmin; z <= zmax; z++) { const f = faixaDeTiles(c, z); n += (f.x1 - f.x0 + 1) * (f.y1 - f.y0 + 1); }
  return n;
}

const preencher = (modelo: string, x: number, y: number, z: number) => modelo.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

/** Todas as URLs de blocos (imagem + rótulos, se houver) da área, na ordem do zoom menor para o maior. */
export function urlsDaArea(camada: CamadaId, c: Caixa, zmin: number, zmax: number): string[] {
  const def = CAMADAS[camada];
  const urls: string[] = [];
  for (let z = zmin; z <= zmax; z++) {
    const f = faixaDeTiles(c, z);
    for (let x = f.x0; x <= f.x1; x++) for (let y = f.y0; y <= f.y1; y++) {
      urls.push(preencher(def.base, x, y, z));
      if (def.rotulos) urls.push(preencher(def.rotulos, x, y, z));
    }
  }
  return urls;
}

/** Estimativa de tamanho (MB) do download. */
export const estimarMB = (camada: CamadaId, tiles: number) => (tiles * CAMADAS[camada].kbPorTile) / 1024;

export const formatarMB = (mb: number) => (mb < 1 ? `${Math.max(1, Math.round(mb * 1024))} KB` : mb < 100 ? `${mb.toFixed(1).replace('.', ',')} MB` : `${Math.round(mb)} MB`);
