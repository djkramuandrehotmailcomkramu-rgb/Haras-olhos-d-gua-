import { create } from 'zustand';
import type { UnidadeArea } from '../geo/unidades';

type Prefs = {
  unidadeArea: UnidadeArea;
  definirUnidadeArea: (u: UnidadeArea) => void;
};

export const usePrefs = create<Prefs>((set) => ({
  unidadeArea: 'ha',
  definirUnidadeArea: (unidadeArea) => set({ unidadeArea }),
}));
