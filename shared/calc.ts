import { EnsDia, ErroModelo, ForecastRaw, Limites, LIMITES_PADRAO, MeteoRaw, MODELOS, ModeloId, Serie } from './tipos';

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
  fonte: 'pluviometro' | 'hindcast' | null;
  nDias: number;
}

const pesosIguais = (): Record<ModeloId, number> =>
  Object.fromEntries(MODELOS.map((m) => [m, 1])) as Record<ModeloId, number>;

/** Horizonte em dias → balde de erro usado (0, 1, 3 ou 7). */
export function baldeHorizonte(dias: number): number {
  if (dias <= 0) return 0;
  if (dias <= 1) return 1;
  if (dias <= 4) return 3;
  return 7;
}

const mediana = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/**
 * Peso por modelo e horizonte aprendido do erro (MAE): habilidade = 1/(MAE+0,3)², normalizada,
 * e puxada para pesos iguais conforme poucos dias (encolhimento λ = min(1, dias/60)).
 * Fonte preferida: o SEU pluviômetro (≥ minDias); senão o histórico de 90 dias contra
 * satélite/reanálise ("hindcast", ≥ 30 dias). Sem nenhum dos dois → pesos iguais, `calibrado=false`.
 */
export function calcularPesos(erros: ErroModelo[], horizonteDias: number, minDias = 20): PesosModelo {
  const h = baldeHorizonte(horizonteDias);
  const doBalde = (fonte: string, min: number) =>
    erros.filter(
      (e) => (e.fonte ?? 'pluviometro') === fonte && e.janela === 90 && e.horizonte === h && e.mae != null && e.n_dias >= min && (MODELOS as string[]).includes(e.modelo),
    );
  const nMax = erros.filter((e) => e.janela === 90 && e.horizonte === h && (MODELOS as string[]).includes(e.modelo)).reduce((m, e) => Math.max(m, e.n_dias), 0);
  for (const [fonte, min] of [['pluviometro', minDias], ['hindcast', 30]] as const) {
    const rows = doBalde(fonte, min);
    if (rows.length < 2) continue;
    const hab = rows.map((e) => 1 / ((e.mae as number) + 0.3) ** 2);
    const media = hab.reduce((a, b) => a + b, 0) / hab.length;
    const lambda = Math.min(1, mediana(rows.map((e) => e.n_dias)) / 60);
    const pesos = pesosIguais();
    rows.forEach((e, i) => (pesos[e.modelo as ModeloId] = (1 - lambda) + lambda * (hab[i] / media)));
    return { pesos, calibrado: true, fonte, nDias: Math.max(...rows.map((e) => e.n_dias)) };
  }
  return { pesos: pesosIguais(), calibrado: false, fonte: null, nDias: nMax };
}

/** Fator multiplicativo de correção de viés — SÓ com chuva medida no pluviômetro (≥ minDias). */
export function fatorCorrecao(erros: ErroModelo[], minDias = 20): { fator: number; nDias: number; ativo: boolean } {
  const r = erros.find((e) => e.modelo === '_fator' && e.janela === 90 && (e.fonte ?? 'pluviometro') === 'pluviometro');
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
  prob: number | null; // % de chance de ≥ 1 mm (ensemble, quando disponível)
  probFonte: 'ensemble' | 'modelos' | null;
  q10: number | null; // faixa realista (ensemble) já corrigida
  q90: number | null;
  p10mm: number | null; // % de chance de ≥ 10 mm
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
  ens: EnsDia[] | null = null,
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
    const e = ens?.find((x) => x.data === data) ?? null;
    const pm = mediaPonderada(probs);
    return {
      data,
      ts,
      porModelo,
      bruto,
      provavel: bruto == null ? null : bruto * fator,
      min: mms.length ? Math.min(...mms) * fator : null,
      max: mms.length ? Math.max(...mms) * fator : null,
      prob: e ? e.p1 : pm,
      probFonte: e ? 'ensemble' : pm != null ? 'modelos' : null,
      q10: e ? e.q10 * fator : null,
      q90: e ? e.q90 * fator : null,
      p10mm: e ? e.p10mm : null,
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
  rajada: number | null;
  dir: number | null;
  temp: number | null;
  ur: number | null;
  nuvem: number | null;
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
      rajada: get('wind_gusts_10m'),
      dir: get('wind_direction_10m'),
      temp: get('temperature_2m'),
      ur: get('relative_humidity_2m'),
      nuvem: get('cloud_cover'),
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

export type Operacao = 'pulv' | 'plantio' | 'colheita';

/** Hora a hora: true = condição adequada para a operação (mesma regra dos semáforos). */
export function horasOk(op: Operacao, horas: ValorHora[], lim: Limites = LIMITES_PADRAO): boolean[] {
  const sec = (i: number, n: number) => horas.slice(i, i + n).every((h) => (h.mm ?? 0) <= 0.2);
  return horas.map((h, i) => {
    if (op === 'pulv')
      return (
        (h.mm ?? 0) <= lim.pulv_chuva_max &&
        sec(i, 3) &&
        (h.vento == null || h.vento <= lim.pulv_vento_max) &&
        (h.temp == null || h.temp <= lim.pulv_temp_max) &&
        (h.ur == null || h.ur >= lim.pulv_ur_min)
      );
    if (op === 'plantio') return (h.mm ?? 0) <= 2;
    return (h.mm ?? 0) <= lim.colheita_chuva_max && sec(i, 2) && (h.ur == null || h.ur <= lim.colheita_ur_max);
  });
}

/** horas = horas do dia local; só 6h–20h são operacionais. */
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

  const faltaMeteo = op.every((h) => h.vento == null);
  const motivoPFalha = faltaMeteo
    ? 'Chuva prevista nas horas de trabalho'
    : `Chuva, vento > ${lim.pulv_vento_max} km/h, temp. > ${lim.pulv_temp_max} °C ou UR < ${lim.pulv_ur_min}% em todas as horas`;
  const pulverizacao = classificar(
    melhorJanela(horasOk('pulv', op, lim), horas),
    lim.janela_min_h,
    motivoPFalha,
    'Sem chuva e dentro dos limites de vento/temperatura/UR',
  );

  let plantio: Semaforo;
  if (chuvaDiaMm == null) plantio = { estado: 'sem-dados', janela: null, motivo: 'Sem previsão do dia' };
  else if (chuvaDiaMm > lim.plantio_dia_max)
    plantio = { estado: 'vermelho', janela: null, motivo: `${fmtMm(chuvaDiaMm)} mm previstos (limite ${lim.plantio_dia_max} mm)` };
  else if (medido3d != null && medido3d > lim.plantio_acum_max)
    plantio = { estado: 'vermelho', janela: null, motivo: `Solo encharcado: ${fmtMm(medido3d)} mm medidos em 3 dias` };
  else plantio = classificar(melhorJanela(horasOk('plantio', op, lim), horas), lim.janela_min_h, 'Chuva forte em todas as horas', 'Chuva dentro do limite');

  const colheita = classificar(
    melhorJanela(horasOk('colheita', op, lim), horas),
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

/** Assinatura curta da previsão diária de todos os modelos: grupos com a mesma assinatura têm exatamente os mesmos números. */
export function assinaturaPrevisao(f: ForecastRaw): string {
  const txt = MODELOS.map((m) => ((f.daily[`precipitation_sum_${m}`] as Serie | undefined) ?? []).slice(0, 16).map((v) => (v == null ? 'n' : v)).join(',')).join('|');
  let h = 5381;
  for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
