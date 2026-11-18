import { comprimentoM, type Coord } from '../geo/medidas';
import { rumoEntre } from './movimento';

export type Guia = {
  distanciaM: number;
  /** rumo absoluto até o ponto (0 = norte) */
  rumoAteOPonto: number;
  /** quanto girar a partir de para onde você está virado: + direita, − esquerda (−180..180) */
  giroGraus: number | null;
};

/** Diferença angular com sinal, −180..180. */
export const diferencaAngulo = (de: number, para: number) => ((para - de + 540) % 360) - 180;

export function guiaAtePonto(pos: Coord, alvo: Coord, rumoAtual: number | null): Guia {
  const rumoAteOPonto = rumoEntre(pos, alvo);
  return {
    distanciaM: comprimentoM([pos, alvo]),
    rumoAteOPonto,
    giroGraus: rumoAtual == null ? null : diferencaAngulo(rumoAtual, rumoAteOPonto),
  };
}

/**
 * Desvio lateral (m) da posição em relação à reta a→b.
 * Positivo = você está à DIREITA da linha (olhando de a para b); negativo = à esquerda.
 */
export function desvioLateral(pos: Coord, a: Coord, b: Coord): number {
  const kx = Math.cos((a[1] * Math.PI) / 180) * 111319.49;
  const ky = 111319.49;
  const px = (pos[0] - a[0]) * kx, py = (pos[1] - a[1]) * ky;
  const bx = (b[0] - a[0]) * kx, by = (b[1] - a[1]) * ky;
  const len = Math.hypot(bx, by) || 1;
  // produto vetorial: >0 quando o ponto está à esquerda de a→b
  const cruz = (bx * py - by * px) / len;
  return -cruz;
}

export function textoDesvio(m: number): string {
  const a = Math.abs(m);
  if (a < 1) return 'Sobre a linha';
  return `${a.toFixed(a < 10 ? 1 : 0).replace('.', ',')} m à ${m > 0 ? 'direita' : 'esquerda'} da linha`;
}

export function textoGiro(g: number | null): string {
  if (g == null) return 'Ande para o lado do ponto e a seta se ajusta';
  const a = Math.abs(g);
  if (a < 12) return 'Siga em frente';
  if (a > 150) return 'Dê meia-volta';
  return `Vire ${a < 45 ? 'um pouco ' : ''}à ${g > 0 ? 'direita' : 'esquerda'}`;
}

/** Ordem de visita: começa no ponto mais perto de você e vai sempre ao próximo mais próximo. */
export function ordenarVisita<T extends { coord: Coord }>(pontos: T[], inicio: Coord | null): T[] {
  const restantes = [...pontos];
  const ordem: T[] = [];
  let atual: Coord | null = inicio;
  while (restantes.length) {
    let melhor = 0;
    if (atual) {
      let dmin = Infinity;
      restantes.forEach((p, i) => {
        const d = comprimentoM([atual as Coord, p.coord]);
        if (d < dmin) { dmin = d; melhor = i; }
      });
    }
    const [p] = restantes.splice(melhor, 1);
    ordem.push(p);
    atual = p.coord;
  }
  return ordem;
}

/** Mensagem falada ao se aproximar. Devolve o degrau já anunciado para não repetir. */
export function degrauDeAviso(distM: number): 0 | 50 | 20 | 10 {
  return distM <= 10 ? 10 : distM <= 20 ? 20 : distM <= 50 ? 50 : 0;
}

/* ------------------------------------------------------------------ fonte do rumo e "Chegou" estável */

export type FonteRumo = 'gps' | 'bussola' | 'ultimo' | null;

/**
 * Para onde você está virado: o rumo do GPS vale andando (≥ 1 m/s); parado, a bússola (já com o desvio aplicado).
 */
export function escolherRumo(o: { gpsRumo: number | null; gpsVelMs: number | null; bussolaVerdadeira: number | null; ultimo: number | null }): { rumo: number | null; fonte: FonteRumo } {
  if (o.gpsRumo != null && (o.gpsVelMs ?? 0) >= 1.0) return { rumo: o.gpsRumo, fonte: 'gps' };
  if (o.bussolaVerdadeira != null) return { rumo: o.bussolaVerdadeira, fonte: 'bussola' };
  if (o.ultimo != null) return { rumo: o.ultimo, fonte: 'ultimo' };
  return { rumo: null, fonte: null };
}

export const PRECISAO_MAX_GUIA_M = 15;
export const PRECISAO_CHEGADA_M = 8;

export type EstadoChegada = { dentro: boolean; seguidos: number };

/**
 * "Chegou" com histerese: entra quando está a ≤ 3 m com precisão boa por 3 leituras seguidas; só sai acima de 5 m.
 * Evita piscar com o ruído do GPS.
 */
export function atualizarChegada(e: EstadoChegada, distM: number, precisaoM: number | null): EstadoChegada {
  if (e.dentro) return distM > 5 ? { dentro: false, seguidos: 0 } : e;
  const bom = distM <= 3 && (precisaoM == null || precisaoM <= PRECISAO_CHEGADA_M);
  const seguidos = bom ? e.seguidos + 1 : 0;
  return { dentro: seguidos >= 3, seguidos };
}
