import polygonClipping from 'polygon-clipping';
import { areaM2, fecharAnel, type Coord } from './medidas';

type XY = [number, number];
type Anel = XY[];
type Poligono = Anel[];

export type Parte = {
  indice: number;
  /** anel externo (lon/lat) da parte; se o talhão for côncavo a parte pode ter mais de um pedaço */
  pedacos: Coord[][];
  areaM2: number;
  /** distância do início (m) até a faixa, ao longo da direção de corte */
  deM: number;
  ateM: number;
};

export type Divisao = {
  partes: Parte[];
  /** linhas de corte (divisas entre partes vizinhas), do lado a lado do talhão */
  cortes: Coord[][];
  /** direção das divisas, em graus (0 = norte, sentido horário, 0–180) */
  anguloGraus: number;
  areaTotalM2: number;
};

export type OpcoesDivisao = {
  /** quantidade de partes OU lista com a área desejada de cada uma (m²) */
  partes?: number;
  areasM2?: number[];
  /** direção das divisas em graus (0 = norte). Padrão: acompanha o lado mais longo. */
  anguloGraus?: number;
  /** começa a contar pelo lado oposto */
  inverter?: boolean;
  /** largura (m) de corredor deixado entre partes vizinhas */
  corredorM?: number;
};

const RAD = Math.PI / 180;

/** Projeção local plana (metros) em torno de um ponto; boa para áreas de poucos km. */
function projecao(ref: Coord) {
  // mesmas constantes (esfera) do cálculo oficial de área, para as áreas baterem
  const kx = Math.cos(ref[1] * RAD) * 111319.49;
  const ky = 111319.49;
  return {
    para: (c: Coord): XY => [(c[0] - ref[0]) * kx, (c[1] - ref[1]) * ky],
    de: (p: XY): Coord => [ref[0] + p[0] / kx, ref[1] + p[1] / ky],
  };
}

/** Ângulo (graus, 0 = norte, 0–180) do lado mais longo do contorno. */
export function anguloLadoMaisLongo(pts: Coord[]): number {
  const anel = fecharAnel(pts);
  const proj = projecao(anel[0]);
  let melhor = { len: -1, ang: 0 };
  for (let i = 0; i < anel.length - 1; i++) {
    const a = proj.para(anel[i]);
    const b = proj.para(anel[i + 1]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > melhor.len) {
      melhor = { len, ang: (Math.atan2(b[0] - a[0], b[1] - a[1]) / RAD + 360) % 180 };
    }
  }
  return melhor.ang;
}

const areaPlana = (mp: Poligono[]): number => {
  let total = 0;
  for (const pg of mp) {
    pg.forEach((anel, i) => {
      let s = 0;
      for (let k = 0; k < anel.length - 1; k++) s += anel[k][0] * anel[k + 1][1] - anel[k + 1][0] * anel[k][1];
      total += (i === 0 ? 1 : -1) * Math.abs(s / 2);
    });
  }
  return total;
};

/** Faixa (retângulo) entre duas posições d0..d1 medidas ao longo de `normal`, cobrindo todo o talhão. */
function faixa(d0: number, d1: number, normal: XY, tang: XY, meio: XY, raio: number): Poligono {
  const p = (d: number, t: number): XY => [meio[0] + normal[0] * d + tang[0] * t, meio[1] + normal[1] * d + tang[1] * t];
  return [[p(d0, -raio), p(d1, -raio), p(d1, raio), p(d0, raio), p(d0, -raio)]];
}

/**
 * Divide um talhão em partes com divisas paralelas, cada uma com a área desejada.
 * Funciona também em talhões côncavos (a parte pode ficar em mais de um pedaço).
 */
export function dividirEmFaixas(contorno: Coord[], op: OpcoesDivisao): Divisao {
  const anel = fecharAnel(contorno);
  const proj = projecao(anel[0]);
  const xy: Anel = anel.map(proj.para);
  const poli: Poligono = [xy];
  const total = areaPlana([poli]);

  const ang = op.anguloGraus != null ? ((op.anguloGraus % 180) + 180) % 180 : anguloLadoMaisLongo(contorno);
  // direção das divisas (tangente) e perpendicular (normal, ao longo da qual as faixas se empilham)
  const tang: XY = [Math.sin(ang * RAD), Math.cos(ang * RAD)];
  const normal: XY = op.inverter ? [tang[1], -tang[0]] : [-tang[1], tang[0]];

  const xs = xy.map((p) => p[0] * normal[0] + p[1] * normal[1]);
  const dMin = Math.min(...xs);
  const dMax = Math.max(...xs);
  const raio = Math.hypot(Math.max(...xy.map((p) => Math.abs(p[0]))), Math.max(...xy.map((p) => Math.abs(p[1])))) * 2 + 100;
  const meio: XY = [0, 0];

  // Áreas-alvo em m² reais (geodésicos). Com lista, a última parte é o que sobra do talhão.
  const totalReal = areaM2(contorno);
  const escala = total / (totalReal || 1); // área plana / área real (≈ 1)
  let alvosReal: number[];
  if (op.areasM2 && op.areasM2.length) {
    const n = op.areasM2.length;
    const dadas = op.areasM2.slice(0, n - 1);
    const soma = dadas.reduce((s, a) => s + a, 0);
    if (soma >= totalReal) throw new Error('As áreas das partes somam mais do que o talhão.');
    alvosReal = [...dadas, totalReal - soma];
  } else {
    const n = Math.max(1, op.partes ?? 1);
    alvosReal = Array.from({ length: n }, () => totalReal / n);
  }
  const alvosN = alvosReal.map((a) => a * escala);

  // Área do talhão com projeção <= d, por recorte contra um semiplano (O(n)).
  // Sutherland–Hodgman gera arestas degeneradas em polígonos côncavos, mas a área com sinal sai correta.
  const proj1 = (p: XY) => p[0] * normal[0] + p[1] * normal[1];
  const areaAte = (d: number): number => {
    if (d <= dMin) return 0;
    if (d >= dMax) return total;
    const n = xy.length - 1; // o anel repete o primeiro ponto no fim
    let soma = 0;
    let ant: XY = xy[n - 1];
    let antDentro = proj1(ant) <= d;
    let ultimo: XY | null = null, primeiro: XY | null = null;
    const emite = (q: XY) => {
      if (ultimo) soma += ultimo[0] * q[1] - q[0] * ultimo[1]; else primeiro = q;
      ultimo = q;
    };
    for (let i = 0; i < n; i++) {
      const cur = xy[i];
      const curDentro = proj1(cur) <= d;
      if (curDentro !== antDentro) {
        const a = proj1(ant), b = proj1(cur);
        const f = (d - a) / (b - a);
        emite([ant[0] + (cur[0] - ant[0]) * f, ant[1] + (cur[1] - ant[1]) * f]);
      }
      if (curDentro) emite(cur);
      ant = cur;
      antDentro = curDentro;
    }
    if (ultimo && primeiro) soma += (ultimo as XY)[0] * (primeiro as XY)[1] - (primeiro as XY)[0] * (ultimo as XY)[1];
    return Math.abs(soma) / 2;
  };

  // posição de cada corte por busca binária da área acumulada
  const cortesD: number[] = [dMin];
  let acumulado = 0;
  for (let i = 0; i < alvosN.length - 1; i++) {
    acumulado += alvosN[i];
    let lo = cortesD[cortesD.length - 1];
    let hi = dMax;
    for (let it = 0; it < 55; it++) {
      const mid = (lo + hi) / 2;
      if (areaAte(mid) < acumulado) lo = mid; else hi = mid;
    }
    cortesD.push((lo + hi) / 2);
  }
  cortesD.push(dMax);

  const corredor = Math.max(0, op.corredorM ?? 0);
  const partes: Parte[] = [];
  for (let i = 0; i < alvosN.length; i++) {
    const d0 = cortesD[i] + (i > 0 ? corredor / 2 : 0);
    const d1 = cortesD[i + 1] - (i < alvosN.length - 1 ? corredor / 2 : 0);
    const r = polygonClipping.intersection(poli, faixa(d0 - (i === 0 ? 1 : 0), d1 + (i === alvosN.length - 1 ? 1 : 0), normal, tang, meio, raio)) as Poligono[];
    const pedacos = r.map((pg) => pg[0].map(proj.de) as Coord[]);
    partes.push({ indice: i, pedacos, areaM2: pedacos.reduce((s, pc) => s + areaM2(pc), 0), deM: cortesD[i] - dMin, ateM: cortesD[i + 1] - dMin });
  }

  // linhas de corte: onde a reta atravessa o talhão (pode ter mais de um trecho em côncavos)
  const cortes: Coord[][] = [];
  for (let i = 1; i < cortesD.length - 1; i++) {
    const d = cortesD[i];
    const fina = polygonClipping.intersection(poli, faixa(d - 0.02, d + 0.02, normal, tang, meio, raio)) as Poligono[];
    for (const pg of fina) {
      const t = pg[0].map((p) => p[0] * tang[0] + p[1] * tang[1]);
      const tMin = Math.min(...t), tMax = Math.max(...t);
      const pt = (tt: number): Coord => proj.de([normal[0] * d + tang[0] * tt, normal[1] * d + tang[1] * tt]);
      cortes.push([pt(tMin), pt(tMax)]);
    }
  }

  return { partes, cortes, anguloGraus: ang, areaTotalM2: areaM2(contorno) };
}

export type Bandeira = { id: string; coord: Coord; rotulo: string; colocada: boolean };

/** Pontos onde ficam as bandeirinhas: pontas de cada divisa e, se pedido, pontos intermediários. */
export function pontosDeDivisa(cortes: Coord[][], opcoes: { espacamentoM?: number; prefixo?: string } = {}): Bandeira[] {
  const { espacamentoM = 0, prefixo = 'D' } = opcoes;
  const out: Bandeira[] = [];
  cortes.forEach((linha, i) => {
    const a = linha[0], b = linha[linha.length - 1];
    const proj = projecao(a);
    const pa = proj.para(a), pb = proj.para(b);
    const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
    const n = espacamentoM > 0 ? Math.max(1, Math.round(len / espacamentoM)) : 1;
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const c = k === 0 ? a : k === n ? b : proj.de([pa[0] + (pb[0] - pa[0]) * f, pa[1] + (pb[1] - pa[1]) * f]);
      out.push({ id: `${prefixo}${i + 1}-${k + 1}`, coord: c, rotulo: `Divisa ${i + 1} · ponto ${k + 1}`, colocada: false });
    }
  });
  return out;
}
