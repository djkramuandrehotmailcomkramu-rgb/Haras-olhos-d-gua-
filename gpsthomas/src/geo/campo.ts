import { dividirEmFaixas, pontosDeDivisa } from './dividir';
import { areaM2 } from './medidas';
import { formatarNumeroBR } from './numero';
import type { BandeiraCampo, ConfigCampo, ParteCampo, PlanoCampo, Talhao } from '../store/dados';

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
