import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { Coord } from '../geo/medidas';

export type Talhao = {
  id: string;
  nome: string;
  fazenda: string;
  cultura: string;
  safra: string;
  obs?: string;
  contorno: Coord[];
  criadoEm: number;
};

export type Medicao = {
  id: string;
  tipo: 'area' | 'linha';
  nome: string;
  pontos: Coord[];
  origem: 'gps' | 'mapa' | 'importado';
  criadoEm: number;
};

export type ParteCampo = {
  /** talhão de origem */
  talhaoId: string;
  indice: number;
  pedacos: Coord[][];
  areaM2: number;
  variedade: string;
};

export type BandeiraCampo = { id: string; coord: Coord; rotulo: string; colocada: boolean; linha: number };

export type ConfigCampo = {
  talhaoId: string;
  partes: number;
  anguloGraus: number | null;
  inverter: boolean;
  /** 'iguais' (padrão) ou 'manual': hectares digitados pelo usuário */
  modo?: 'iguais' | 'manual';
  /** hectares digitados (a última parte é o que sobra e não precisa ser informada) */
  areasHa?: number[];
  /** área informada do talhão (ex.: 92), usada para calibrar os hectares digitados */
  areaInformadaHa?: number | null;
};

export type PlanoCampo = {
  id: string;
  nome: string;
  criadoEm: number;
  /** partes por talhão (ex.: Andropogon 5, Amendoim 6) */
  config: ConfigCampo[];
  corredorM: number;
  espacamentoM: number;
  variedades: string[];
  /** meta de hectares por variedade (ex.: 16) */
  metaHa?: number | null;
  partes: ParteCampo[];
  bandeiras: BandeiraCampo[];
  /** linhas de divisa (para guiar "seguindo a linha") */
  divisas: { id: number; talhaoId: string; pontos: Coord[] }[];
};

export type Viagem = { id: string; destino: string; inicioMs: number; fimMs: number; distanciaM: number; vmedKmh: number; vmaxKmh: number };

export const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const memoria: Record<string, string> = {};
const armazem: StateStorage = {
  getItem: (k) => {
    try { return localStorage.getItem(k); } catch { return memoria[k] ?? null; }
  },
  setItem: (k, v) => {
    try { localStorage.setItem(k, v); } catch { memoria[k] = v; }
  },
  removeItem: (k) => {
    try { localStorage.removeItem(k); } catch { delete memoria[k]; }
  },
};

type Dados = {
  talhoes: Talhao[];
  medicoes: Medicao[];
  viagens: Viagem[];
  campos: PlanoCampo[];
  salvarCampo: (c: PlanoCampo) => void;
  atualizarCampo: (id: string, p: Partial<PlanoCampo>) => void;
  removerCampo: (id: string) => void;
  registrarViagem: (v: Omit<Viagem, 'id'>) => void;
  adicionarTalhao: (t: Omit<Talhao, 'id' | 'criadoEm'>) => string;
  atualizarTalhao: (id: string, p: Partial<Omit<Talhao, 'id'>>) => void;
  removerTalhao: (id: string) => void;
  adicionarMedicao: (m: Omit<Medicao, 'id' | 'criadoEm'>) => string;
  removerMedicao: (id: string) => void;
  limparTudo: () => void;
};

export const useDados = create<Dados>()(
  persist(
    (set) => ({
      talhoes: [],
      medicoes: [],
      viagens: [],
      campos: [],
      salvarCampo: (c) => set((s) => ({ campos: [c, ...s.campos.filter((x) => x.id !== c.id)] })),
      atualizarCampo: (id, p) => set((s) => ({ campos: s.campos.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      removerCampo: (id) => set((s) => ({ campos: s.campos.filter((x) => x.id !== id) })),
      registrarViagem: (v) => set((s) => ({ viagens: [{ ...v, id: novoId() }, ...s.viagens].slice(0, 30) })),
      adicionarTalhao: (t) => {
        const id = novoId();
        set((s) => ({ talhoes: [{ ...t, id, criadoEm: Date.now() }, ...s.talhoes] }));
        return id;
      },
      atualizarTalhao: (id, p) => set((s) => ({ talhoes: s.talhoes.map((t) => (t.id === id ? { ...t, ...p } : t)) })),
      removerTalhao: (id) => set((s) => ({ talhoes: s.talhoes.filter((t) => t.id !== id) })),
      adicionarMedicao: (m) => {
        const id = novoId();
        set((s) => ({ medicoes: [{ ...m, id, criadoEm: Date.now() }, ...s.medicoes] }));
        return id;
      },
      removerMedicao: (id) => set((s) => ({ medicoes: s.medicoes.filter((m) => m.id !== id) })),
      limparTudo: () => set({ talhoes: [], medicoes: [], campos: [] }),
    }),
    {
      name: 'gpsthomas-dados',
      version: 1,
      storage: createJSONStorage(() => armazem),
      // v0 -> v1: garante os campos que surgiram nas versões 0.5–0.7 (viagens, campos)
      migrate: (estado: any) => ({
        ...estado,
        talhoes: Array.isArray(estado?.talhoes) ? estado.talhoes : [],
        medicoes: Array.isArray(estado?.medicoes) ? estado.medicoes : [],
        viagens: Array.isArray(estado?.viagens) ? estado.viagens : [],
        campos: Array.isArray(estado?.campos) ? estado.campos : [],
      }),
    },
  ),
);

export type Comando =
  | { n: number; tipo: 'voar'; coord: Coord; zoom?: number }
  | { n: number; tipo: 'ajustar'; pontos: Coord[] };

/** Estado de interface compartilhado entre telas (não persiste). */
type SemN<T> = T extends unknown ? Omit<T, 'n'> : never;
export const useUi = create<{ comando: Comando | null; enviar: (c: SemN<Comando>) => void; destino: { coord: Coord; nome: string; n: number } | null; irPara: (coord: Coord, nome: string) => void }>((set) => ({
  comando: null,
  destino: null,
  irPara: (coord, nome) => set({ destino: { coord, nome, n: Date.now() } }),
  enviar: (c) => set({ comando: { ...c, n: Date.now() } as Comando }),
}));
