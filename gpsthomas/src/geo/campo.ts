import { dividirEmFaixas, pontosDeDivisa } from './dividir';
import { areaM2 } from './medidas';
import type { BandeiraCampo, ParteCampo, PlanoCampo, Talhao } from '../store/dados';

export const CORES_VARIEDADE = ['#3FB063', '#F2B73D', '#5B9BFF', '#E5484D', '#B07CFF', '#FF8A5B', '#2EC4B6', '#C28A55', '#E86AB5', '#8FA39A', '#7DD3FC', '#FDE047'];

export type ConfigTalhao = PlanoCampo['config'][number];

/** Divide cada talhão escolhido e gera as partes, as divisas e as bandeirinhas. */
export function gerarCampo(talhoes: Talhao[], config: ConfigTalhao[], corredorM: number, espacamentoM: number) {
  const partes: ParteCampo[] = [];
  const bandeiras: BandeiraCampo[] = [];
  const divisas: PlanoCampo['divisas'] = [];
  config.forEach((cfg, ti) => {
    const t = talhoes.find((x) => x.id === cfg.talhaoId);
    if (!t || cfg.partes < 1) return;
    const d = dividirEmFaixas(t.contorno, { partes: cfg.partes, anguloGraus: cfg.anguloGraus ?? undefined, inverter: cfg.inverter, corredorM });
    d.partes.forEach((p) => partes.push({ talhaoId: t.id, indice: p.indice, pedacos: p.pedacos, areaM2: p.areaM2, variedade: '' }));
    d.cortes.forEach((c, i) => divisas.push({ id: ti * 100 + i + 1, talhaoId: t.id, pontos: c }));
    pontosDeDivisa(d.cortes, { espacamentoM, prefixo: `T${ti + 1}D` }).forEach((b) => {
      // "Divisa 2 · ponto 1" -> "Andropogon · divisa 2 · ponto 1"
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

/** Diferença entre a área que o usuário disse (ex.: 92 ha) e a medida no KML, em %. */
export const diferencaPercentual = (medidaM2: number, informadaHa: number) => ((medidaM2 / 10000 - informadaHa) / informadaHa) * 100;

export const areaTalhaoM2 = (t: Talhao) => areaM2(t.contorno);
