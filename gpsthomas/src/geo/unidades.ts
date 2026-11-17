// Conversões de área e distância. Base: metro quadrado (m²) e metro (m).

export type UnidadeArea = 'ha' | 'm2' | 'alqPaulista' | 'alqMineiro' | 'alqGoiano' | 'alqBaiano';
export type UnidadeDistancia = 'm' | 'km';

/** Quantos m² vale cada unidade. */
export const M2_POR_UNIDADE: Record<UnidadeArea, number> = {
  ha: 10_000,
  m2: 1,
  alqPaulista: 24_200,
  alqMineiro: 48_400,
  alqGoiano: 48_400,
  alqBaiano: 96_800,
};

export const ROTULO_AREA: Record<UnidadeArea, string> = {
  ha: 'ha',
  m2: 'm²',
  alqPaulista: 'alq. paulista',
  alqMineiro: 'alq. mineiro',
  alqGoiano: 'alq. goiano',
  alqBaiano: 'alq. baiano',
};

export function converterArea(m2: number, para: UnidadeArea): number {
  return m2 / M2_POR_UNIDADE[para];
}

export function paraM2(valor: number, de: UnidadeArea): number {
  return valor * M2_POR_UNIDADE[de];
}

const fmt = (n: number, casas: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function formatarArea(m2: number, unidade: UnidadeArea = 'ha'): string {
  const v = converterArea(m2, unidade);
  const casas = unidade === 'm2' ? 0 : 2;
  return `${fmt(v, casas)} ${ROTULO_AREA[unidade]}`;
}

export function formatarDistancia(m: number, unidade?: UnidadeDistancia): string {
  const u = unidade ?? (m >= 1000 ? 'km' : 'm');
  return u === 'km' ? `${fmt(m / 1000, 2)} km` : `${fmt(m, 0)} m`;
}

/** Hectares com vírgula e casas fixas: 163,64 ha. Usado em telas, PDF e exportações. */
export const formatarHa = (m2: number, casas = 2) => `${fmt(m2 / 10000, casas)} ha`;
export const formatarHaSemUnidade = (m2: number, casas = 2) => fmt(m2 / 10000, casas);
