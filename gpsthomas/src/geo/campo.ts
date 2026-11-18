import { dividirAneis, dividirEmFaixas, pontosDeDivisa } from './dividir';
import { anguloDaLinha } from './rastro';
import { areaM2 } from './medidas';
import { formatarNumeroBR } from './numero';
import type { BandeiraCampo, ConfigCampo, ConfigJunto, ParteCampo, PlanoCampo, Talhao } from '../store/dados';

export const CORES_VARIEDADE = ['#3FB063', '#F2B73D', '#5B9BFF', '#E5484D', '#B07CFF', '#FF8A5B', '#2EC4B6', '#C28A55', '#E86AB5', '#8FA39A', '#7DD3FC', '#FDE047'];

export type ConfigTalhao = ConfigCampo;

export type ConferenciaManual = {
  /** soma dos hectares digitados nas partes informadas (todas menos a última) */
  somaHa: number;
  /** hectares que sobram para a última parte (negativo = passou) */
  restoHa: number;
  ok: boolean;
  erro: string | null;
};

/** Fator que converte hectares digitados para hectares reais medidos (calibração pela área informada). */
export function fatorCalibracao(medidaM2: number, informadaHa: number | null | undefined): number {
  if (!informadaHa || informadaHa <= 0) return 1;
  return medidaM2 / 10000 / informadaHa;
}

/**
 * Confere os hectares digitados contra a área do talhão.
 * `areasHa` traz todas as partes menos a última (que é o que sobra).
 */
export function conferirManual(medidaM2: number, areasHa: number[], informadaHa?: number | null): ConferenciaManual {
  const k = fatorCalibracao(medidaM2, informadaHa);
  const somaHa = areasHa.reduce((s, a) => s + (isFinite(a) ? a : 0), 0);
  const totalHa = medidaM2 / 10000;
  const restoHa = totalHa - somaHa * k;
  if (areasHa.some((a) => !isFinite(a) || a <= 0)) return { somaHa, restoHa, ok: false, erro: 'Informe os hectares de todas as partes (maiores que zero).' };
  if (restoHa < 0.005) return { somaHa, restoHa, ok: false, erro: `Passou ${formatarNumeroBR(-restoHa)} ha da área do talhão.` };
  return { somaHa, restoHa, ok: true, erro: null };
}

/** Atalho "X ha cada": preenche as partes com X e deixa o resto para a última. */
export function preencherCada(partes: number, haCada: number): number[] {
  return Array.from({ length: Math.max(0, partes - 1) }, () => haCada);
}

/** Divide cada talhão escolhido e gera as partes, as divisas e as bandeirinhas. */
export function gerarCampo(talhoes: Talhao[], config: ConfigCampo[], corredorM: number, espacamentoM: number) {
  const partes: ParteCampo[] = [];
  const bandeiras: BandeiraCampo[] = [];
  const divisas: PlanoCampo['divisas'] = [];
  config.forEach((cfg, ti) => {
    const t = talhoes.find((x) => x.id === cfg.talhaoId);
    if (!t || cfg.partes < 1) return;
    let areasM2: number[] | undefined;
    if (cfg.modo === 'manual') {
      const medida = areaM2(t.contorno);
      const digitadas = (cfg.areasHa ?? []).slice(0, cfg.partes - 1);
      const conf = conferirManual(medida, digitadas, cfg.areaInformadaHa);
      if (digitadas.length !== cfg.partes - 1 || !conf.ok) throw new Error(`${t.nome}: ${conf.erro ?? 'informe os hectares de cada parte.'}`);
      const k = fatorCalibracao(medida, cfg.areaInformadaHa);
      // a última parte é o que sobra: o divisor completa o total do talhão
      areasM2 = [...digitadas.map((a) => a * 10000 * k), 1];
    }
    const d = dividirEmFaixas(t.contorno, { partes: cfg.partes, areasM2, anguloGraus: cfg.anguloGraus ?? undefined, inverter: cfg.inverter, corredorM });
    d.partes.forEach((p) => partes.push({ talhaoId: t.id, indice: p.indice, pedacos: p.pedacos, areaM2: p.areaM2, variedade: '' }));
    d.cortes.forEach((c, i) => divisas.push({ id: ti * 100 + i + 1, talhaoId: t.id, pontos: c }));
    pontosDeDivisa(d.cortes, { espacamentoM, prefixo: `T${ti + 1}D` }).forEach((b) => {
      const linha = Number(/D(\d+)-/.exec(b.id)?.[1] ?? 0);
      bandeiras.push({ id: b.id, coord: b.coord, rotulo: `${t.nome} · ${b.rotulo.toLowerCase()}`, colocada: false, linha: ti * 100 + linha });
    });
  });
  return { partes, bandeiras, divisas };
}

export type PartesJunto = {
  /** áreas-alvo em m² (a última é o que sobra do campo) — null quando as partes são todas iguais */
  areasM2: number[] | null;
  partes: number;
  /** área de cada parte "cheia" (m² reais) */
  cadaM2: number;
  /** o que sobra depois das partes cheias (m²); 0 se a sobra foi repartida ou não houve */
  sobraM2: number;
  /** a última parte é uma parte de sobra menor que as outras */
  temSobra: boolean;
};

/** Quantas partes de X ha cabem no campo e o que sobra. `totalM2` é a área medida (real). */
export function planejarPartesJunto(totalM2: number, j: Pick<ConfigJunto, 'haPorParte' | 'areaInformadaHa' | 'sobra'>): PartesJunto {
  if (!(j.haPorParte > 0)) throw new Error('Informe os hectares de cada parte (maior que zero).');
  const k = fatorCalibracao(totalM2, j.areaInformadaHa);
  const cadaM2 = j.haPorParte * 10000 * k;
  const n = Math.floor(totalM2 / cadaM2 + 1e-9);
  if (n < 1) throw new Error(`O campo tem ${formatarNumeroBR(totalM2 / 10000)} ha: menos que uma parte de ${formatarNumeroBR(j.haPorParte)} ha.`);
  const resto = totalM2 - n * cadaM2;
  if (j.sobra === 'dividir') return { areasM2: null, partes: n, cadaM2: totalM2 / n, sobraM2: 0, temSobra: false };
  if (resto < 500) return { areasM2: [...Array.from({ length: n - 1 }, () => cadaM2), 1], partes: n, cadaM2, sobraM2: 0, temSobra: false };
  return { areasM2: [...Array.from({ length: n }, () => cadaM2), 1], partes: n + 1, cadaM2, sobraM2: resto, temSobra: true };
}

/** Direção das divisas do campo junto: a da linha AB, a escolhida à mão ou (undefined) o lado mais longo. */
export const anguloJunto = (j: ConfigJunto): number | undefined =>
  j.usarLinhaAB && j.linhaAB ? anguloDaLinha(j.linhaAB.a, j.linhaAB.b) : j.anguloGraus ?? undefined;

/** Divide vários talhões como um só campo (faixas paralelas que atravessam todos) e gera partes, divisas e bandeirinhas. */
export function gerarCampoJunto(talhoes: Talhao[], junto: ConfigJunto, corredorM: number, espacamentoM: number) {
  const ts = junto.talhaoIds.map((id) => talhoes.find((x) => x.id === id)).filter((x): x is Talhao => !!x);
  if (ts.length === 0) throw new Error('Marque pelo menos um talhão.');
  const total = ts.reduce((s, x) => s + areaM2(x.contorno), 0);
  const plano = planejarPartesJunto(total, junto);
  const d = dividirAneis(ts.map((x) => x.contorno), {
    areasM2: plano.areasM2 ?? undefined, partes: plano.partes, anguloGraus: anguloJunto(junto), inverter: junto.inverter, corredorM,
  });
  const partes: ParteCampo[] = d.partes.map((p) => ({
    talhaoId: 'junto', indice: p.indice, pedacos: p.pedacos, areaM2: p.areaM2, variedade: '',
    origens: (p.origens ?? []).map((o) => ({ talhaoId: ts[o.anel].id, areaM2: o.areaM2 })),
  }));
  const divisas: PlanoCampo['divisas'] = d.cortes.map((c, i) => ({ id: i + 1, talhaoId: ts[d.cortesInfo?.[i]?.anel ?? 0].id, pontos: c }));
  const bandeiras: BandeiraCampo[] = pontosDeDivisa(d.cortes, { espacamentoM, prefixo: 'J' }).map((b) => {
    const m = /J(\d+)-(\d+)/.exec(b.id);
    const i = Number(m?.[1] ?? 1) - 1;
    const info = d.cortesInfo?.[i];
    return { id: b.id, coord: b.coord, rotulo: `${ts[info?.anel ?? 0].nome} · divisa ${info?.corte ?? i + 1} · ponto ${m?.[2] ?? 1}`, colocada: false, linha: i + 1 };
  });
  return { partes, bandeiras, divisas, resumo: plano, totalM2: total, anguloGraus: d.anguloGraus };
}

/** Texto das origens de uma parte do campo junto ("Andropgno 12,1 ha + Amendoim 3,9 ha"). */
export function textoOrigens(p: ParteCampo, nomeDe: (id: string) => string): string {
  return (p.origens ?? []).map((o) => `${nomeDe(o.talhaoId)} ${formatarNumeroBR(o.areaM2 / 10000)} ha`).join(' + ');
}

/** Distribui as variedades nas partes em ordem; as partes que sobram repetem a última variedade. */
export function distribuirVariedades(partes: ParteCampo[], variedades: string[]): ParteCampo[] {
  if (variedades.length === 0) return partes.map((p) => ({ ...p, variedade: '' }));
  return partes.map((p, i) => ({ ...p, variedade: variedades[Math.min(i, variedades.length - 1)] }));
}

export function totaisPorVariedade(partes: ParteCampo[]): { variedade: string; areaM2: number; partes: number }[] {
  const m = new Map<string, { areaM2: number; partes: number }>();
  for (const p of partes) {
    const k = p.variedade || '(sem variedade)';
    const a = m.get(k) ?? { areaM2: 0, partes: 0 };
    m.set(k, { areaM2: a.areaM2 + p.areaM2, partes: a.partes + 1 });
  }
  return [...m.entries()].map(([variedade, v]) => ({ variedade, ...v }));
}

export type SeloMeta = 'ok' | 'atencao' | 'sem-meta';
/** Compara a área de cada variedade com a meta (tolerância de 0,3 ha ou 2%). */
export function compararComMeta(areaM2Var: number, metaHa: number | null | undefined): { diffHa: number; selo: SeloMeta } {
  if (!metaHa || metaHa <= 0) return { diffHa: 0, selo: 'sem-meta' };
  const diffHa = areaM2Var / 10000 - metaHa;
  const tol = Math.max(0.3, metaHa * 0.02);
  return { diffHa, selo: Math.abs(diffHa) <= tol ? 'ok' : 'atencao' };
}

export type ConferenciaTalhao = { talhaoId: string; medidaM2: number; partesM2: number; diffPercentual: number; corredorEsperadoM2: number; alerta: boolean };

/** Confere se a soma das partes fecha com a área do talhão (descontando o corredor, que é esperado). */
export function conferirAreas(plano: PlanoCampo, talhoes: Talhao[]): ConferenciaTalhao[] {
  if (plano.junto) {
    const medidaM2 = plano.junto.talhaoIds.reduce((s, id) => { const t = talhoes.find((x) => x.id === id); return s + (t ? areaM2(t.contorno) : 0); }, 0);
    const partesM2 = plano.partes.reduce((s, p) => s + p.areaM2, 0);
    const compr = plano.divisas.reduce((s, d) => s + Math.hypot((d.pontos[1][0] - d.pontos[0][0]) * 111319.49 * Math.cos((d.pontos[0][1] * Math.PI) / 180), (d.pontos[1][1] - d.pontos[0][1]) * 111319.49), 0);
    const corredorEsperadoM2 = compr * (plano.corredorM || 0);
    const diffPercentual = medidaM2 ? ((partesM2 + corredorEsperadoM2 - medidaM2) / medidaM2) * 100 : 0;
    return [{ talhaoId: 'junto', medidaM2, partesM2, diffPercentual, corredorEsperadoM2, alerta: Math.abs(diffPercentual) > 0.5 }];
  }
  return plano.config.map((cfg) => {
    const t = talhoes.find((x) => x.id === cfg.talhaoId);
    const medidaM2 = t ? areaM2(t.contorno) : 0;
    const partesM2 = plano.partes.filter((p) => p.talhaoId === cfg.talhaoId).reduce((s, p) => s + p.areaM2, 0);
    const divisas = plano.divisas.filter((d) => d.talhaoId === cfg.talhaoId);
    const compr = divisas.reduce((s, d) => s + Math.hypot((d.pontos[1][0] - d.pontos[0][0]) * 111319.49 * Math.cos((d.pontos[0][1] * Math.PI) / 180), (d.pontos[1][1] - d.pontos[0][1]) * 111319.49), 0);
    const corredorEsperadoM2 = compr * (plano.corredorM || 0);
    const diffPercentual = medidaM2 ? ((partesM2 + corredorEsperadoM2 - medidaM2) / medidaM2) * 100 : 0;
    return { talhaoId: cfg.talhaoId, medidaM2, partesM2, diffPercentual, corredorEsperadoM2, alerta: Math.abs(diffPercentual) > 0.5 };
  });
}

/** Diferença entre a área que o usuário disse (ex.: 92 ha) e a medida no KML, em %. */
export const diferencaPercentual = (medidaM2: number, informadaHa: number) => ((medidaM2 / 10000 - informadaHa) / informadaHa) * 100;

export const areaTalhaoM2 = (t: Talhao) => areaM2(t.contorno);
