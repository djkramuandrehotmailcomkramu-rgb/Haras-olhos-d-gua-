export type ModeloId = 'ecmwf_aifs025_single' | 'ecmwf_ifs025' | 'gfs_seamless' | 'icon_seamless' | 'gem_global' | 'ukmo_seamless';
// Escolhidos por teste real (90 dias, D+1 a D+7, vs ERA5+NASA POWER): o AIFS (IA do ECMWF) teve o menor erro em todos os horizontes.
// Fora: best_match (repete o ECMWF), JMA/Météo-France/CMA (erro maior ou pouca cobertura), ECMWF IFS 9 km (mesmo viés úmido do 25 km).
export const MODELOS: ModeloId[] = ['ecmwf_aifs025_single', 'ecmwf_ifs025', 'gfs_seamless', 'icon_seamless', 'gem_global', 'ukmo_seamless'];
export const NOME_MODELO: Record<ModeloId, string> = {
  ecmwf_aifs025_single: 'ECMWF AIFS (IA)',
  ecmwf_ifs025: 'ECMWF IFS',
  gfs_seamless: 'GFS',
  icon_seamless: 'ICON',
  gem_global: 'GEM',
  ukmo_seamless: 'UKMO',
};

/** Resumo diário do ensemble multi-sistema (ECMWF IFS 51, AIFS 51, GEFS 31, ICON 40, GEM 21, UKMO 18 membros; cada sistema pesa igual). */
export interface EnsDia {
  data: string; // yyyy-mm-dd local
  n: number; // membros usados
  sistemas: number; // sistemas de ensemble com dados neste dia
  p1: number; // % de membros com ≥ 1 mm
  p10mm: number; // % de membros com ≥ 10 mm
  q10: number;
  q50: number;
  q90: number;
}

export interface Fazenda {
  id: string;
  nome: string;
  fuso: string;
  lat: number | null;
  lon: number | null;
}

export type Anel = [number, number][]; // [lon, lat]

export interface Talhao {
  id: string;
  fazenda_id: string;
  nome: string;
  ha: number | null;
  geom: { type: 'Polygon'; coordinates: Anel[] };
  lat: number;
  lon: number;
}

export type Serie = (number | null)[];

/** Resposta crua do Open-Meteo /v1/forecast com vários modelos e timeformat=unixtime. */
export interface ForecastRaw {
  latitude: number;
  longitude: number;
  elevation: number;
  utc_offset_seconds: number;
  hourly: { time: number[] } & Record<string, Serie | number[]>;
  daily: { time: number[] } & Record<string, Serie | number[]>;
}

/** Resposta crua para vento/temperatura/umidade (sem `models`, chaves sem sufixo). */
export interface MeteoRaw {
  hourly: { time: number[] } & Record<string, Serie | number[]>;
  daily?: { time: number[]; sunrise?: number[]; sunset?: number[] };
}

export interface Grupo {
  id: string;
  lat: number;
  lon: number;
  talhoes: string[];
  grade: { lat: number; lon: number; elev: number };
  forecast: ForecastRaw;
  meteo: MeteoRaw | null;
  ens: EnsDia[] | null;
}

export interface PayloadPrevisao {
  fazenda: Fazenda;
  gerado_em: string;
  grupos: Grupo[];
  erros: string[];
}

export interface ErroModelo {
  fazenda_id: string;
  modelo: string;
  horizonte: number;
  janela: number; // 30 ou 90 dias
  fonte: 'pluviometro' | 'hindcast' | string;
  n_dias: number;
  mae: number | null;
  vies: number | null;
  acerto: number | null;
  atualizado_em: string;
}

export interface Medida {
  id: string;
  fazenda_id: string;
  talhao_id: string | null;
  data: string; // yyyy-mm-dd
  mm: number;
  origem: string;
  obs: string | null;
  foto?: string | null;
}

export interface Limites {
  pulv_vento_max: number; // km/h
  pulv_temp_max: number; // °C
  pulv_ur_min: number; // %
  pulv_chuva_max: number; // mm/h
  plantio_dia_max: number; // mm no dia
  plantio_acum_max: number; // mm medido nos 3 dias anteriores
  colheita_chuva_max: number; // mm/h
  colheita_ur_max: number; // %
  janela_min_h: number; // horas contínuas para "verde"
  agrupamento_km: number;
  safra_inicio: string; // mm-dd
  alerta_mm24: number;
  alerta_prob6: number;
}

export const LIMITES_PADRAO: Limites = {
  pulv_vento_max: 15,
  pulv_temp_max: 32,
  pulv_ur_min: 55,
  pulv_chuva_max: 0.1,
  plantio_dia_max: 10,
  plantio_acum_max: 40,
  colheita_chuva_max: 0.1,
  colheita_ur_max: 80,
  janela_min_h: 3,
  agrupamento_km: 5,
  safra_inicio: '10-01',
  alerta_mm24: 20,
  alerta_prob6: 80,
};

/** Local pesquisado (qualquer cidade/estado/coordenada), fora dos talhões do KML. */
export interface Lugar {
  nome: string;
  detalhe?: string;
  lat: number;
  lon: number;
  tipo?: string;
}

export interface PayloadLugar {
  lugar: Lugar;
  fuso: string;
  gerado_em: string;
  grupo: Grupo;
  hind: ErroModelo[];
  erros: string[];
}
