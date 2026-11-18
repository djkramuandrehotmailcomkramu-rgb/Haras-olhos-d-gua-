import type { Coord } from './medidas';

/** Linha AB (rastro reto) do monitor da máquina. Coordenadas em [longitude, latitude]. */
export type LinhaAB = { nome: string; a: Coord; b: Coord };

/** Linha "TRABALHO" lida no monitor (Intelliview, tipo Reto): usada como ponto de partida, pode ser editada. */
export const LINHA_AB_PADRAO: LinhaAB = {
  nome: 'TRABALHO',
  a: [-46.13416156, -16.282406],
  b: [-46.14329233, -16.28437727],
};

/** Lê um número de coordenada digitado (ponto OU vírgula como decimal; sem separador de milhar). */
export function lerCoordenada(texto: string): number | null {
  const s = texto.trim().replace(/[−–]/g, '-').replace(/\s+/g, '').replace(',', '.');
  if (!/^-?\d{1,3}(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Latitude e longitude digitadas → [longitude, latitude], ou null se algo estiver fora do intervalo. */
export function lerLatLon(lat: string, lon: string): Coord | null {
  const la = lerCoordenada(lat), lo = lerCoordenada(lon);
  if (la == null || lo == null || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  return [lo, la];
}

const KM = 111319.49;

/** Distância (m) e rumo (0–360, 0 = norte, sentido horário) de A para B. */
export function medidasDaLinha(a: Coord, b: Coord): { metros: number; rumo: number } {
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180)) * KM;
  const dy = (b[1] - a[1]) * KM;
  return { metros: Math.hypot(dx, dy), rumo: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360 };
}

/** Direção das divisas paralelas à linha, no formato do divisor (0–180, 0 = norte). */
export const anguloDaLinha = (a: Coord, b: Coord): number => medidasDaLinha(a, b).rumo % 180;

const PONTOS = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
/** Nome do rumo em português (ex.: 257° → "OSO"). */
export const nomeRumo = (graus: number): string => PONTOS[Math.round((((graus % 360) + 360) % 360) / 22.5) % 16];
