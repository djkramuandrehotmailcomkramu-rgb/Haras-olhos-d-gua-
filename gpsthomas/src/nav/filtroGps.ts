import type { Coord } from '../geo/medidas';

/** Um fixo cru do GPS. */
export type FixoGps = { coord: Coord; precisaoM: number | null; tempoMs: number; velocidadeMs?: number | null };
export type EstadoGps = { coord: Coord; precisaoM: number; tempoMs: number };
export type QualidadeGps = 'procurando' | 'estabilizando' | 'pronto';

const KY = 111319.49;
const PRECISAO_PADRAO_M = 20;
const PRECISAO_MIN_M = 1.5;

/** Procurando (> 15 m), estabilizando (até 15 m) ou pronto (até 8 m). */
export const qualidadeGps = (precisaoM: number | null | undefined): QualidadeGps =>
  precisaoM == null || precisaoM > 15 ? 'procurando' : precisaoM > 8 ? 'estabilizando' : 'pronto';

/**
 * Filtro de Kalman simples (posição, 2D) que pesa cada fixo pela precisão informada pelo GPS:
 * o primeiro fixo ruim (±300 m, comum no Android) quase não pesa depois de um bom, e o ruído de ±5 m é suavizado.
 */
export class FiltroGps {
  private lat = 0;
  private lon = 0;
  private variancia = 0; // m²
  private t = 0;
  private tem = false;
  private forasSeguidos = 0;

  reiniciar() { this.tem = false; this.forasSeguidos = 0; }

  atualizar(f: FixoGps): EstadoGps | null {
    const acc = Math.max(PRECISAO_MIN_M, f.precisaoM != null && isFinite(f.precisaoM) && f.precisaoM > 0 ? f.precisaoM : PRECISAO_PADRAO_M);
    if (acc > 1500) return null; // localização por antena/IP: inútil para guiar
    const lon = f.coord[0], lat = f.coord[1];
    const r = acc * acc;

    if (!this.tem) {
      this.lat = lat; this.lon = lon; this.variancia = r; this.t = f.tempoMs; this.tem = true; this.forasSeguidos = 0;
      return this.estado();
    }
    if (f.tempoMs < this.t) return null; // fixo velho
    const dt = Math.min(60, (f.tempoMs - this.t) / 1000);
    const vel = f.velocidadeMs != null && isFinite(f.velocidadeMs) ? Math.max(0, f.velocidadeMs) : 1.5;
    const q = Math.max(1.2, vel); // quanto a posição pode andar por segundo
    const varPrev = this.variancia + (q * dt) ** 2;

    const kx = Math.cos((this.lat * Math.PI) / 180) * KY;
    const dx = (lon - this.lon) * kx, dy = (lat - this.lat) * KY;
    const dist = Math.hypot(dx, dy);
    // salto impossível com precisão pior que a atual: provavelmente um fixo ruim; se persistir, o aparelho "teleportou"
    const limite = 4 * Math.sqrt(varPrev) + 3 * q * Math.max(dt, 1) + 40;
    if (dist > limite && acc >= Math.sqrt(this.variancia)) {
      this.forasSeguidos += 1;
      if (this.forasSeguidos < 4) return this.estado();
      this.lat = lat; this.lon = lon; this.variancia = r; this.t = f.tempoMs; this.forasSeguidos = 0;
      return this.estado();
    }
    this.forasSeguidos = 0;

    const k = varPrev / (varPrev + r);
    this.lat += (dy * k) / KY;
    this.lon += (dx * k) / kx;
    this.variancia = (1 - k) * varPrev;
    this.t = f.tempoMs;
    return this.estado();
  }

  private estado(): EstadoGps {
    return { coord: [this.lon, this.lat], precisaoM: Math.max(PRECISAO_MIN_M, Math.sqrt(this.variancia)), tempoMs: this.t };
  }
}
