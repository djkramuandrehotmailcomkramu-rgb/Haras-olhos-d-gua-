import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UnidadeArea } from '../geo/unidades';

export type Camada = 'satelite' | 'mapa';

type Prefs = {
  unidadeArea: UnidadeArea;
  camada: Camada;
  definirUnidadeArea: (u: UnidadeArea) => void;
  definirCamada: (c: Camada) => void;
};

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      unidadeArea: 'ha',
      camada: 'satelite',
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
