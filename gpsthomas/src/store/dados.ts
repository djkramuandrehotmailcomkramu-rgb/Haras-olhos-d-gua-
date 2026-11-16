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
      limparTudo: () => set({ talhoes: [], medicoes: [] }),
    }),
    { name: 'gpsthomas-dados', storage: createJSONStorage(() => armazem) },
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
