import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UnidadeArea } from '../geo/unidades';
import type { Coord } from '../geo/medidas';

export type Recente = { nome: string; sub: string; coord: Coord };

export type Camada = 'satelite' | 'mapa';

type Prefs = {
  unidadeArea: UnidadeArea;
  camada: Camada;
  onboardingVisto: boolean;
  recentes: Recente[];
  vozLigada: boolean;
  lembrarDestino: (r: Recente) => void;
  definirVoz: (v: boolean) => void;
  concluirOnboarding: () => void;
  definirUnidadeArea: (u: UnidadeArea) => void;
  definirCamada: (c: Camada) => void;
};

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      unidadeArea: 'ha',
      camada: 'satelite',
      onboardingVisto: false,
      recentes: [],
      vozLigada: true,
      lembrarDestino: (r) => set((s) => ({ recentes: [r, ...s.recentes.filter((x) => x.nome !== r.nome)].slice(0, 6) })),
      definirVoz: (vozLigada) => set({ vozLigada }),
      concluirOnboarding: () => set({ onboardingVisto: true }),
      definirUnidadeArea: (unidadeArea) => set({ unidadeArea }),
      definirCamada: (camada) => set({ camada }),
    }),
    {
      name: 'gpsthomas-prefs',
      storage: createJSONStorage(() => ({
        getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
        setItem: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
        removeItem: (k) => { try { localStorage.removeItem(k); } catch {} },
      })),
    },
  ),
);
