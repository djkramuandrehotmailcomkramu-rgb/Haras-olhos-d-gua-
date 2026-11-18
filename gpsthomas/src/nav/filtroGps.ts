import type { Coord } from '../geo/medidas';

/** Um fixo cru do GPS. */
export type FixoGps = { coord: Coord; precisaoM: number | null; tempoMs: number; velocidadeMs?: number | null };
export type EstadoGps = { coord: Coord; precisaoM: number; tempoMs: number; /** velocidade estimada (m/s) */ velMs: number; /** rumo estimado (0 = norte) quando anda o bastante, senão null */ rumoGraus: number | null };
export type QualidadeGps = 'procurando' | 'estabilizando' | 'pronto';

const KY = 111319.49;
const PRECISAO_PADRAO_M = 20;
const PRECISAO_MIN_M = 1.5;

/** Procurando (> 15 m), estabilizando (até 15 m) ou pronto (até 8 m). */
export const qualidadeGps = (precisaoM: number | null | undefined): QualidadeGps =>
  precisaoM == null || precisaoM > 15 ? 'procurando' : precisaoM > 8 ? 'estabilizando' : 'pronto';

/**
 * Filtro de Kalman (posição + velocidade) que pesa cada fixo pela precisão informada pelo GPS: o primeiro fixo ruim
 * (±300 m, comum no Android) quase não pesa depois de um bom, o ruído de ±5 m é suavizado e, andando, a posição não
 * fica "atrasada" nem corta curvas. As duas direções (leste/norte) compartilham a mesma covariância.
 */
const SIGMA_ACEL = 0.35; // m/s²: o quanto a velocidade pode mudar sozinha

export class FiltroGps {
  private lat = 0;
  private lon = 0;
  private vx = 0; // m/s, leste
  private vy = 0; // m/s, norte
  // covariância por eixo: [posição, posição×velocidade, velocidade]
  private pxx = 0;
  private pxv = 0;
  private pvv = 0;
  private t = 0;
  private tem = false;
  private forasSeguidos = 0;

  reiniciar() { this.tem = false; this.forasSeguidos = 0; this.vx = 0; this.vy = 0; }

  private iniciar(lat: number, lon: number, r: number, t: number) {
    this.lat = lat; this.lon = lon; this.pxx = r; this.pxv = 0; this.pvv = 4; this.t = t; this.tem = true; this.forasSeguidos = 0; this.vx = 0; this.vy = 0;
  }

  atualizar(f: FixoGps): EstadoGps | null {
    const acc = Math.max(PRECISAO_MIN_M, f.precisaoM != null && isFinite(f.precisaoM) && f.precisaoM > 0 ? f.precisaoM : PRECISAO_PADRAO_M);
    if (acc > 1500) return null; // localização por antena/IP: inútil para guiar
    const lon = f.coord[0], lat = f.coord[1];
    const r = acc * acc;

    if (!this.tem) { this.iniciar(lat, lon, r, f.tempoMs); return this.estado(); }
    if (f.tempoMs <= this.t) return null; // fixo velho ou repetido
    const dt = Math.min(60, (f.tempoMs - this.t) / 1000);

    // previsão: continua na mesma velocidade; a incerteza cresce
    const q = SIGMA_ACEL * SIGMA_ACEL;
    const pxx = this.pxx + 2 * dt * this.pxv + dt * dt * this.pvv + q * dt ** 4 / 4;
    const pxv = this.pxv + dt * this.pvv + q * dt ** 3 / 2;
    const pvv = this.pvv + q * dt * dt;
    const kx = Math.cos((this.lat * Math.PI) / 180) * KY;
    const predLat = this.lat + (this.vy * dt) / KY;
    const predLon = this.lon + (this.vx * dt) / kx;
    const dx = (lon - predLon) * kx, dy = (lat - predLat) * KY;
    const S = pxx + r;

    // salto impossível com precisão pior que a atual: provavelmente um fixo ruim; se persistir, o aparelho "teleportou"
    if (Math.hypot(dx, dy) > 4 * Math.sqrt(S) + 40 && acc >= Math.sqrt(this.pxx)) {
      this.forasSeguidos += 1;
      if (this.forasSeguidos < 4) return this.estado();
      this.iniciar(lat, lon, r, f.tempoMs);
      return this.estado();
    }
    this.forasSeguidos = 0;

    const Kx = pxx / S, Kv = pxv / S;
    this.lat = predLat + (Kx * dy) / KY;
    this.lon = predLon + (Kx * dx) / kx;
    this.vx += Kv * dx;
    this.vy += Kv * dy;
    const v = Math.hypot(this.vx, this.vy);
    if (v > 12) { this.vx *= 12 / v; this.vy *= 12 / v; }
    this.pxx = (1 - Kx) * pxx;
    this.pxv = (1 - Kx) * pxv;
    this.pvv = Math.max(0.01, pvv - Kv * pxv);
    this.t = f.tempoMs;
    return this.estado();
  }

  private estado(): EstadoGps {
    const v = Math.hypot(this.vx, this.vy);
    return {
      coord: [this.lon, this.lat],
      precisaoM: Math.max(PRECISAO_MIN_M, Math.sqrt(this.pxx)),
      tempoMs: this.t,
      velMs: v,
      rumoGraus: v >= 0.9 ? (((Math.atan2(this.vx, this.vy) * 180) / Math.PI) + 360) % 360 : null,
    };
  }
}
