import { comprimentoM, type Coord } from './medidas';

export type AmostraGps = { coord: Coord; precisaoM: number | null; tempoMs: number };

export type OpcoesFiltro = {
  /** Descarta amostras com precisão pior que isso (m). */
  precisaoMaximaM?: number;
  /** Só aceita ponto novo se andou ao menos isso desde o último (m). */
  distanciaMinimaM?: number;
};

/** Decide se uma nova amostra entra no rastro. */
export function aceitarAmostra(
  anterior: AmostraGps | null,
  nova: AmostraGps,
  { precisaoMaximaM = 15, distanciaMinimaM = 3 }: OpcoesFiltro = {},
): boolean {
  if (nova.precisaoM != null && nova.precisaoM > precisaoMaximaM) return false;
  if (!anterior) return true;
  return comprimentoM([anterior.coord, nova.coord]) >= distanciaMinimaM;
}
