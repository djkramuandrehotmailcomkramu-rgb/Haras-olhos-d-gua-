import type { Coord } from '../geo/medidas';
import { nomeRumo } from '../geo/rastro';

const KY = 111319.49;
const norm360 = (g: number) => ((g % 360) + 360) % 360;
/** Diferença angular com sinal, −180..180 (de `a` para `b`). */
export const difAng = (a: number, b: number) => ((b - a + 540) % 360) - 180;

/* ------------------------------------------------------------------ declinação magnética */

// Declinação magnética aproximada (graus, leste positivo) em cidades do Brasil, por volta de 2026.
// É só o ponto de partida: andando, o app aprende o desvio real da bússola pelo rumo do GPS.
const DECLINACAO: { lat: number; lon: number; d: number }[] = [
  { lat: -3.1, lon: -60.0, d: -13.5 }, { lat: -1.4, lon: -48.5, d: -18 }, { lat: -3.7, lon: -38.5, d: -21 },
  { lat: -8.0, lon: -35.0, d: -22.5 }, { lat: -13.0, lon: -38.5, d: -23.5 }, { lat: -15.8, lon: -47.9, d: -21 },
  { lat: -15.6, lon: -56.0, d: -15.5 }, { lat: -19.9, lon: -43.9, d: -23.5 }, { lat: -22.9, lon: -43.2, d: -24 },
  { lat: -23.5, lon: -46.6, d: -21.5 }, { lat: -25.4, lon: -49.3, d: -19 }, { lat: -30.0, lon: -51.0, d: -15 },
  { lat: -20.5, lon: -54.6, d: -16.5 }, { lat: -16.7, lon: -49.3, d: -20.5 }, { lat: -10.0, lon: -67.8, d: -8 },
  { lat: -9.5, lon: -50.0, d: -17.5 }, { lat: -5.1, lon: -42.8, d: -20 },
];

/** Declinação magnética aproximada para uma posição (média ponderada pelo inverso do quadrado da distância). */
export function declinacaoAproximada(c: Coord): number {
  let soma = 0, peso = 0;
  for (const p of DECLINACAO) {
    const kx = Math.cos((c[1] * Math.PI) / 180) * KY;
    const dist = Math.hypot((c[0] - p.lon) * kx, (c[1] - p.lat) * KY) / 1000; // km
    if (dist < 1) return p.d;
    const w = 1 / (dist * dist);
    soma += w * p.d; peso += w;
  }
  return soma / peso;
}

/** Rumo verdadeiro a partir do magnético da bússola. */
export const rumoVerdadeiro = (magnetico: number, desvioGraus: number) => norm360(magnetico + desvioGraus);

/* ------------------------------------------------------------------ aprender o desvio andando */

/**
 * Aprende, andando, o desvio da bússola (declinação + erro do sensor + jeito de segurar o celular):
 * diferença entre o rumo do GPS e o da bússola, com média circular ponderada pela velocidade.
 */
export class AprendizDesvio {
  private c = 0;
  private s = 0;
  private peso = 0;
  amostras = 0;
  private rumoGpsAnt: number | null = null;

  reiniciar() { this.c = 0; this.s = 0; this.peso = 0; this.amostras = 0; this.rumoGpsAnt = null; }

  /** Devolve o desvio estimado (ou null enquanto não há dados). Só conta quando anda reto e rápido o bastante. */
  adicionar(rumoGps: number | null, velMs: number | null, magnetico: number | null): number | null {
    if (rumoGps == null || magnetico == null || velMs == null || velMs < 1.0) { this.rumoGpsAnt = rumoGps; return this.estimado(); }
    const reto = this.rumoGpsAnt == null || Math.abs(difAng(this.rumoGpsAnt, rumoGps)) < 20;
    this.rumoGpsAnt = rumoGps;
    if (!reto) return this.estimado();
    const d = difAng(magnetico, rumoGps) * (Math.PI / 180);
    const w = Math.min(velMs, 2.5);
    // esquecimento leve: o desvio muda com a forma de segurar o celular
    this.c = this.c * 0.97 + Math.cos(d) * w; this.s = this.s * 0.97 + Math.sin(d) * w; this.peso = this.peso * 0.97 + w;
    this.amostras += 1;
    return this.estimado();
  }

  estimado(): number | null {
    if (this.amostras < 1 || this.peso <= 0) return null;
    return norm360((Math.atan2(this.s, this.c) * 180) / Math.PI);
  }

  /** 0..1: quão firme está o aprendizado (amostras e coerência). */
  confianca(): number {
    if (this.amostras < 1 || this.peso <= 0) return 0;
    const coerencia = Math.hypot(this.c, this.s) / this.peso; // 1 = todas iguais
    return Math.min(1, this.amostras / 10) * coerencia;
  }
}

/* ------------------------------------------------------------------ calibrar o GPS por ponto conhecido */

export type DeslocamentoGps = { dxM: number; dyM: number; ate: number };
export const VALIDADE_CALIBRACAO_MS = 3 * 60 * 60 * 1000;

/** Quanto somar ao GPS para cair no ponto conhecido (metros leste/norte). */
export function calcularDeslocamento(conhecido: Coord, medido: Coord, agoraMs = Date.now()): DeslocamentoGps {
  const kx = Math.cos((conhecido[1] * Math.PI) / 180) * KY;
  return { dxM: (conhecido[0] - medido[0]) * kx, dyM: (conhecido[1] - medido[1]) * KY, ate: agoraMs + VALIDADE_CALIBRACAO_MS };
}

export function aplicarDeslocamento(c: Coord, d: DeslocamentoGps | null | undefined, agoraMs = Date.now()): Coord {
  if (!d || d.ate < agoraMs) return c;
  const kx = Math.cos((c[1] * Math.PI) / 180) * KY;
  return [c[0] + d.dxM / kx, c[1] + d.dyM / KY];
}

export const deslocamentoAtivo = (d: DeslocamentoGps | null | undefined, agoraMs = Date.now()) => !!d && d.ate >= agoraMs;

/** "3,2 m a nordeste" */
export function textoDeslocamento(d: DeslocamentoGps): string {
  const m = Math.hypot(d.dxM, d.dyM);
  const rumo = (Math.atan2(d.dxM, d.dyM) * 180) / Math.PI;
  const dir: Record<string, string> = { N: 'norte', NNE: 'norte-nordeste', NE: 'nordeste', ENE: 'leste-nordeste', L: 'leste', ESE: 'leste-sudeste', SE: 'sudeste', SSE: 'sul-sudeste', S: 'sul', SSO: 'sul-sudoeste', SO: 'sudoeste', OSO: 'oés-sudoeste', O: 'oeste', ONO: 'oés-noroeste', NO: 'noroeste', NNO: 'norte-noroeste' };
  return `${m.toFixed(1).replace('.', ',')} m a ${dir[nomeRumo(rumo)] ?? nomeRumo(rumo)}`;
}
