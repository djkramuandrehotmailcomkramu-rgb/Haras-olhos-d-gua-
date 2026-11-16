import { comprimentoM, type Coord } from '../geo/medidas';

export type Amostra = { coord: Coord; tempoMs: number; velMs: number | null };

/** Rumo (0–360°, 0 = norte) de a para b. */
export function rumoEntre(a: Coord, b: Coord): number {
  const r = Math.PI / 180;
  const y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r);
  const x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

/** Velocidade (m/s) entre duas amostras, quando o GPS não informa. */
export function velocidadeEntre(a: Amostra, b: Amostra): number | null {
  const dt = (b.tempoMs - a.tempoMs) / 1000;
  if (dt < 0.3 || dt > 12) return null;
  return comprimentoM([a.coord, b.coord]) / dt;
}

/** Velocidade em km/h, suavizada pela média das últimas amostras. Abaixo de ~2 km/h vira 0 (ruído do GPS parado). */
export function velocidadeKmh(hist: Amostra[]): number {
  const ult = hist.slice(-4);
  const v: number[] = [];
  for (let i = 0; i < ult.length; i++) {
    const m = ult[i].velMs ?? (i > 0 ? velocidadeEntre(ult[i - 1], ult[i]) : null);
    if (m != null && isFinite(m) && m >= 0) v.push(m);
  }
  if (v.length === 0) return 0;
  const kmh = (v.reduce((s, x) => s + x, 0) / v.length) * 3.6;
  return kmh < 2 ? 0 : kmh;
}

/** Suaviza o giro do ícone pelo menor arco (evita voltar 350° ao passar de 359° para 1°). */
export function suavizarRumo(anterior: number, novo: number, fator = 0.5): number {
  const d = ((novo - anterior + 540) % 360) - 180;
  return (anterior + d * fator + 360) % 360;
}

export const formatarKmh = (kmh: number) => String(Math.round(kmh));
