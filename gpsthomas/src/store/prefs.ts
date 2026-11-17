import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UnidadeArea } from '../geo/unidades';
import type { Coord } from '../geo/medidas';
import type { Veiculo } from '../components/veiculos';

export type Recente = { nome: string; sub: string; coord: Coord };

export type Camada = 'satelite' | 'mapa';

type Prefs = {
  unidadeArea: UnidadeArea;
  camada: Camada;
  onboardingVisto: boolean;
  recentes: Recente[];
  vozLigada: boolean;
  painelRecolhido: boolean;
  avisoInstalarFechado: boolean;
  fecharAvisoInstalar: () => void;
  ultimoBackupMs: number | null;
  marcarBackup: () => void;
  definirPainel: (v: boolean) => void;
  veiculo: Veiculo;
  favoritos: Recente[];
  viagemAtiva: Recente | null;
  definirVeiculo: (v: Veiculo) => void;
  alternarFavorito: (r: Recente) => void;
  definirViagemAtiva: (r: Recente | null) => void;
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
      painelRecolhido: false,
      avisoInstalarFechado: false,
      fecharAvisoInstalar: () => set({ avisoInstalarFechado: true }),
      ultimoBackupMs: null,
      marcarBackup: () => set({ ultimoBackupMs: Date.now() }),
      definirPainel: (painelRecolhido) => set({ painelRecolhido }),
      veiculo: 'carro',
      favoritos: [],
      viagemAtiva: null,
      definirVeiculo: (veiculo) => set({ veiculo }),
      alternarFavorito: (r) => set((s) => ({ favoritos: s.favoritos.some((x) => x.nome === r.nome) ? s.favoritos.filter((x) => x.nome !== r.nome) : [r, ...s.favoritos].slice(0, 12) })),
      definirViagemAtiva: (viagemAtiva) => set({ viagemAtiva }),
      lembrarDestino: (r) => set((s) => ({ recentes: [r, ...s.recentes.filter((x) => x.nome !== r.nome)].slice(0, 6) })),
      definirVoz: (vozLigada) => set({ vozLigada }),
      concluirOnboarding: () => set({ onboardingVisto: true }),
      definirUnidadeArea: (unidadeArea) => set({ unidadeArea }),
      definirCamada: (camada) => set({ camada }),
    }),
    {
      name: 'gpsthomas-prefs',
      version: 1,
      migrate: (estado: any) => ({ ...estado }),
      storage: createJSONStorage(() => ({
        getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
        setItem: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
        removeItem: (k) => { try { localStorage.removeItem(k); } catch {} },
      })),
    },
  ),
);
