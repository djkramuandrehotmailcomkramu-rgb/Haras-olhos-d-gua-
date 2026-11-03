import { ErroModelo, ForecastRaw, Limites, LIMITES_PADRAO, MeteoRaw, MODELOS, ModeloId, Serie } from './tipos';

// ---------- tempo local ----------
export function partesLocais(ts: number, fuso: string) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ts * 1000));
  const g = (t: string) => f.find((p) => p.type === t)!.value;
  return { dia: `${g('year')}-${g('month')}-${g('day')}`, hora: Number(g('hour')) };
}

export function hojeLocal(fuso: string, agora = Date.now()): string {
  return partesLocais(agora / 1000, fuso).dia;
}

export function addDias(dia: string, n: number): string {
  const d = new Date(dia + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------- formatação pt-BR ----------
export const fmtMm = (v: number | null | undefined): string =>
  v == null || !isFinite(v) ? '—' : v.toFixed(1).replace('.', ',');
export const fmtDia = (dia: string): string => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
export const fmtHora = (h: number): string => `${String(h).padStart(2, '0')}h`;

// ---------- séries por modelo ----------
const serie = (obj: Record<string, unknown>, chave: string): Serie | null => {
  const s = obj[chave];
  return Array.isArray(s) ? (s as Serie) : null;
};

export interface PesosModelo {
  pesos: Record<ModeloId, number>;
  calibrado: boolean;
  nDias: number;
}

const pesosIguais = (): Record<ModeloId, number> => ({ best_match: 1, ecmwf_ifs025: 1, gfs_seamless: 1, icon_seamless: 1 });

/** Horizonte em dias → balde de erro usado (0, 1, 3 ou 7). */
export function baldeHorizonte(dias: number): number {
  if (dias <= 0) return 0;
  if (dias <= 1) return 1;
  if (dias <= 4) return 3;
  return 7;
}

/**
 * Peso por modelo ∝ 1/(MAE+0,5), só com ≥ minDias de erro medido naquele horizonte.
 * Sem dados suficientes → pesos iguais e `calibrado=false` (nunca finge calibração).
 */
export function calcularPesos(erros: ErroModelo[], horizonteDias: number, minDias = 20): PesosModelo {
  const h = baldeHorizonte(horizonteDias);
  const doBalde = erros.filter((e) => e.janela === 90 && e.horizonte === h && e.mae != null && (MODELOS as string[]).includes(e.modelo));
  const nDias = doBalde.reduce((m, e) => Math.max(m, e.n_dias), 0);
  if (doBalde.length < 2 || doBalde.some((e) => e.n_dias < minDias)) {
    return { pesos: pesosIguais(), calibrado: false, nDias };
  }
  const pesos = pesosIguais();
  for (const e of doBalde) pesos[e.modelo as ModeloId] = 1 / ((e.mae as number) + 0.5);
  return { pesos, calibrado: true, nDias };
}

/** Fator multiplicativo de correção de viés (linha `_fator`). Só vale com ≥ minDias. */
export function fatorCorrecao(erros: ErroModelo[], minDias = 20): { fator: number; nDias: number; ativo: boolean } {
  const r = erros.find((e) => e.modelo === '_fator' && e.janela === 90);
  if (!r) return { fator: 1, nDias: 0, ativo: false };
  const ativo = r.n_dias >= minDias && r.vies != null && r.vies > 0;
  return { fator: ativo ? (r.vies as number) : 1, nDias: r.n_dias, ativo };
}

export interface ValorDia {
  data: string; // yyyy-mm-dd local
  ts: number;
  porModelo: Partial<Record<ModeloId, { mm: number; prob: number | null }>>;
  bruto: number | null; // média ponderada
  provavel: number | null; // bruto × fator
  min: number | null;
  max: number | null;
  prob: number | null;
  nModelos: number;
}

function mediaPonderada(vals: { v: number; w: number }[]): number | null {
  const sw = vals.reduce((s, x) => s + x.w, 0);
  return sw > 0 ? vals.reduce((s, x) => s + x.v * x.w, 0) / sw : null;
}

export function diasPrevistos(
  f: ForecastRaw,
  fuso: string,
  erros: ErroModelo[] = [],
  hoje: string = hojeLocal(fuso),
): ValorDia[] {
  const t = f.daily.time as number[];
  const { fator } = fatorCorrecao(erros);
  return t.map((ts, i) => {
    const data = partesLocais(ts + 3600, fuso).dia; // +1h evita borda de meia-noite
    const dh = Math.round((Date.parse(data) - Date.parse(hoje)) / 86400000);
    const { pesos } = calcularPesos(erros, dh);
    const porModelo: ValorDia['porModelo'] = {};
    const vals: { v: number; w: number }[] = [];
    const probs: { v: number; w: number }[] = [];
    for (const m of MODELOS) {
      const mm = serie(f.daily, `precipitation_sum_${m}`)?.[i];
      if (mm == null) continue;
      const p = serie(f.daily, `precipitation_probability_max_${m}`)?.[i] ?? null;
      porModelo[m] = { mm, prob: p };
      vals.push({ v: mm, w: pesos[m] });
      if (p != null) probs.push({ v: p, w: pesos[m] });
    }
    const bruto = mediaPonderada(vals);
    const mms = vals.map((x) => x.v);
    return {
      data,
      ts,
      porModelo,
      bruto,
      provavel: bruto == null ? null : bruto * fator,
      min: mms.length ? Math.min(...mms) * fator : null,
      max: mms.length ? Math.max(...mms) * fator : null,
      prob: mediaPonderada(probs),
      nModelos: vals.length,
    };
  });
}

export interface ValorHora {
  ts: number;
  data: string;
  hora: number;
  mm: number | null;
  prob: number | null;
  vento: number | null;
  temp: number | null;
  ur: number | null;
}

export function horasPrevistas(
  f: ForecastRaw,
  meteo: MeteoRaw | null,
  fuso: string,
  erros: ErroModelo[] = [],
  hoje: string = hojeLocal(fuso),
): ValorHora[] {
  const t = f.hourly.time as number[];
  const { fator } = fatorCorrecao(erros);
  const mt = meteo ? (meteo.hourly.time as number[]) : [];
  const idxMeteo = new Map(mt.map((x, i) => [x, i]));
  return t.map((ts, i) => {
    const { dia, hora } = partesLocais(ts, fuso);
    const dh = Math.round((Date.parse(dia) - Date.parse(hoje)) / 86400000);
    const { pesos } = calcularPesos(erros, dh);
    const vals: { v: number; w: number }[] = [];
    const probs: { v: number; w: number }[] = [];
    for (const m of MODELOS) {
      const mm = serie(f.hourly, `precipitation_${m}`)?.[i];
      if (mm != null) vals.push({ v: mm, w: pesos[m] });
      const p = serie(f.hourly, `precipitation_probability_${m}`)?.[i];
      if (p != null) probs.push({ v: p, w: pesos[m] });
    }
    const mi = idxMeteo.get(ts);
    const get = (k: string) => (mi == null || !meteo ? null : serie(meteo.hourly, k)?.[mi] ?? null);
    const mm = mediaPonderada(vals);
    return {
      ts,
      data: dia,
      hora,
      mm: mm == null ? null : mm * fator,
      prob: mediaPonderada(probs),
      vento: get('wind_speed_10m'),
      temp: get('temperature_2m'),
      ur: get('relative_humidity_2m'),
    };
  });
}

// ---------- janelas e semáforos ----------
export type Estado = 'verde' | 'amarelo' | 'vermelho' | 'sem-dados';
export interface Semaforo {
  estado: Estado;
  janela: { ini: number; fim: number } | null; // horas locais [ini, fim)
  motivo: string;
}

function melhorJanela(ok: boolean[], horas: number[]): { ini: number; fim: number } | null {
  let melhor: { ini: number; fim: number } | null = null;
  let ini = -1;
  for (let i = 0; i <= ok.length; i++) {
    if (i < ok.length && ok[i]) {
      if (ini < 0) ini = i;
    } else if (ini >= 0) {
      const cand = { ini: horas[ini], fim: horas[i - 1] + 1 };
      if (!melhor || cand.fim - cand.ini > melhor.fim - melhor.ini) melhor = cand;
      ini = -1;
    }
  }
  return melhor;
}

function classificar(janela: { ini: number; fim: number } | null, minH: number, motivoFalha: string, motivoOk: string): Semaforo {
  if (!janela) return { estado: 'vermelho', janela: null, motivo: motivoFalha };
  const dur = janela.fim - janela.ini;
  if (dur >= minH) return { estado: 'verde', janela, motivo: `${motivoOk} (${dur} h seguidas)` };
  return { estado: 'amarelo', janela, motivo: `Janela curta de ${dur} h; mínimo recomendado ${minH} h` };
}

/** horas = apenas as do dia local (6h–20h são consideradas operacionais). */
export function semaforos(
  horasDia: ValorHora[],
  chuvaDiaMm: number | null,
  medido3d: number | null,
  lim: Limites = LIMITES_PADRAO,
): { pulverizacao: Semaforo; plantio: Semaforo; colheita: Semaforo } {
  const op = horasDia.filter((h) => h.hora >= 6 && h.hora < 20);
  if (!op.length) {
    const sd: Semaforo = { estado: 'sem-dados', janela: null, motivo: 'Sem horas restantes no dia' };
    return { pulverizacao: sd, plantio: sd, colheita: sd };
  }
  const horas = op.map((h) => h.hora);
  const prox = (i: number, n: number) => op.slice(i, i + n).every((h) => (h.mm ?? 0) <= 0.2);

  // Pulverização: sem chuva (hora e janela seguinte), vento, temperatura e UR dentro dos limites
  const faltaMeteo = op.every((h) => h.vento == null);
  const okP = op.map(
    (h, i) =>
      (h.mm ?? 0) <= lim.pulv_chuva_max &&
      prox(i, 3) &&
      (h.vento == null || h.vento <= lim.pulv_vento_max) &&
      (h.temp == null || h.temp <= lim.pulv_temp_max) &&
      (h.ur == null || h.ur >= lim.pulv_ur_min),
  );
  const motivoPFalha = faltaMeteo
    ? 'Chuva prevista nas horas de trabalho'
    : `Chuva, vento > ${lim.pulv_vento_max} km/h, temp. > ${lim.pulv_temp_max} °C ou UR < ${lim.pulv_ur_min}% em todas as horas`;
  const pulverizacao = classificar(
    melhorJanela(okP, horas),
    lim.janela_min_h,
    motivoPFalha,
    'Sem chuva e dentro dos limites de vento/temperatura/UR',
  );

  // Plantio: depende do total do dia + solo já úmido (medido) + sem chuva forte em hora
  let plantio: Semaforo;
  if (chuvaDiaMm == null) plantio = { estado: 'sem-dados', janela: null, motivo: 'Sem previsão do dia' };
  else if (chuvaDiaMm > lim.plantio_dia_max)
    plantio = { estado: 'vermelho', janela: null, motivo: `${fmtMm(chuvaDiaMm)} mm previstos (limite ${lim.plantio_dia_max} mm)` };
  else if (medido3d != null && medido3d > lim.plantio_acum_max)
    plantio = { estado: 'vermelho', janela: null, motivo: `Solo encharcado: ${fmtMm(medido3d)} mm medidos em 3 dias` };
  else {
    const okL = op.map((h) => (h.mm ?? 0) <= 2);
    plantio = classificar(melhorJanela(okL, horas), lim.janela_min_h, 'Chuva forte em todas as horas', 'Chuva dentro do limite');
  }

  // Colheita: sem chuva e UR baixa (grão seco)
  const okC = op.map((h, i) => (h.mm ?? 0) <= lim.colheita_chuva_max && prox(i, 2) && (h.ur == null || h.ur <= lim.colheita_ur_max));
  const colheita = classificar(
    melhorJanela(okC, horas),
    lim.janela_min_h,
    `Chuva ou UR > ${lim.colheita_ur_max}% em todas as horas`,
    'Sem chuva e umidade do ar adequada',
  );
  return { pulverizacao, plantio, colheita };
}

export const fmtJanela = (j: { ini: number; fim: number } | null): string => (j ? `${fmtHora(j.ini)}–${fmtHora(j.fim)}` : '—');

// ---------- agregados ----------
export function horaMaisProvavel(horasDia: ValorHora[]): number | null {
  let best: ValorHora | null = null;
  for (const h of horasDia) if ((h.mm ?? 0) > 0.05 && (!best || (h.mm ?? 0) > (best.mm ?? 0))) best = h;
  return best ? best.hora : null;
}

export function somaMm(horas: ValorHora[]): number {
  return horas.reduce((s, h) => s + (h.mm ?? 0), 0);
}

/** Faixa do mapa/legenda: 0, <1, 1–5, 5–15, 15–30, 30+. */
export function faixaMm(mm: number | null): 0 | 1 | 2 | 3 | 4 | 5 {
  if (mm == null || mm <= 0.05) return 0;
  if (mm < 1) return 1;
  if (mm < 5) return 2;
  if (mm < 15) return 3;
  if (mm < 30) return 4;
  return 5;
}
export const LEGENDA_FAIXAS = ['0', '< 1', '1–5', '5–15', '15–30', '30+'];

// ---------- erro (usado pelo cron e testes) ----------
export interface ParPrevMedido {
  prev: number;
  med: number;
}
export function estatisticasErro(pares: ParPrevMedido[], limiarChuva = 1) {
  const n = pares.length;
  if (!n) return { n: 0, mae: null, vies: null, acerto: null };
  const mae = pares.reduce((s, p) => s + Math.abs(p.prev - p.med), 0) / n;
  const vies = pares.reduce((s, p) => s + (p.prev - p.med), 0) / n;
  const acerto = pares.filter((p) => p.prev >= limiarChuva === p.med >= limiarChuva).length / n;
  return { n, mae, vies, acerto };
}

/** Fator = Σmedido / Σprevisto (clamp 0,5–2). Só faz sentido com ≥20 dias. */
export function calcularFator(pares: ParPrevMedido[]): number | null {
  const sp = pares.reduce((s, p) => s + p.prev, 0);
  const sm = pares.reduce((s, p) => s + p.med, 0);
  if (sp < 1) return null;
  return Math.min(2, Math.max(0.5, sm / sp));
}
