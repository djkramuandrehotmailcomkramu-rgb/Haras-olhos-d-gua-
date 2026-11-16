import { comprimentoM, type Coord } from '../geo/medidas';
import type { Passo, Rota } from './rota';

export type RotaPreparada = { rota: Rota; acum: number[]; totalM: number; inicios: number[] };

/** Pré-calcula distâncias acumuladas ao longo da geometria. */
export function prepararRota(rota: Rota): RotaPreparada {
  const g = rota.geometria;
  const acum = [0];
  for (let i = 1; i < g.length; i++) acum.push(acum[i - 1] + comprimentoM([g[i - 1], g[i]]));
  const totalM = acum[acum.length - 1] || rota.distanciaM;
  const somaPassos = rota.passos.length ? rota.passos[rota.passos.length - 1].inicioM + rota.passos[rota.passos.length - 1].distanciaM : 0;
  const k = somaPassos > 0 ? totalM / somaPassos : 1;
  return { rota, acum, totalM, inicios: rota.passos.map((p) => p.inicioM * k) };
}

/** Projeta a posição na rota: quanto já andou e a que distância dela está. */
export function projetar(p: RotaPreparada, pos: Coord, dica = 0): { alongM: number; desvioM: number; idx: number } {
  const g = p.rota.geometria;
  if (g.length < 2) return { alongM: 0, desvioM: 0, idx: 0 };
  const kx = Math.cos((pos[1] * Math.PI) / 180) * 111320;
  const ky = 111132;
  const busca = (ini: number, fim: number) => {
    let melhor = { alongM: 0, desvioM: Infinity, idx: ini };
    for (let i = ini; i <= fim; i++) {
      const ax = (g[i][0] - pos[0]) * kx, ay = (g[i][1] - pos[1]) * ky;
      const bx = (g[i + 1][0] - pos[0]) * kx, by = (g[i + 1][1] - pos[1]) * ky;
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
      const cx = ax + t * dx, cy = ay + t * dy;
      const d = Math.hypot(cx, cy);
      if (d < melhor.desvioM) melhor = { alongM: p.acum[i] + t * (p.acum[i + 1] - p.acum[i]), desvioM: d, idx: i };
    }
    return melhor;
  };
  const ult = g.length - 2;
  const janela = busca(Math.max(0, Math.min(ult, dica - 40)), Math.min(ult, dica + 600));
  return janela.desvioM > 80 ? busca(0, ult) : janela;
}

export type EstadoNav = {
  proximo: Passo | null;
  distAteProximoM: number;
  restanteM: number;
  restanteS: number;
  chegou: boolean;
};

export function estadoNavegacao(p: RotaPreparada, alongM: number): EstadoNav {
  const restanteM = Math.max(0, p.totalM - alongM);
  const restanteS = p.totalM > 0 ? p.rota.duracaoS * (restanteM / p.totalM) : 0;
  const j = p.inicios.findIndex((ini, i) => i > 0 && ini > alongM + 1);
  const proximo = j > 0 ? p.rota.passos[j] : null;
  return {
    proximo,
    distAteProximoM: proximo ? Math.max(0, p.inicios[j] - alongM) : restanteM,
    restanteM,
    restanteS,
    chegou: restanteM <= 30,
  };
}

export const formatarDuracao = (s: number) => {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, '0')} min`;
};

/** Frase falada: "Em 300 metros, vire à direita". */
export function fraseFalada(distM: number, texto: string): string {
  const minus = texto.charAt(0).toLowerCase() + texto.slice(1);
  if (distM <= 40) return texto;
  if (distM >= 950) return `Em ${(Math.round(distM / 100) / 10).toLocaleString('pt-BR')} quilômetros, ${minus}`;
  const r = distM >= 200 ? Math.round(distM / 100) * 100 : Math.round(distM / 50) * 50;
  return `Em ${r} metros, ${minus}`;
}
