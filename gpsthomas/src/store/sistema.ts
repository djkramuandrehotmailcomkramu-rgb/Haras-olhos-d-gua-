import { create } from 'zustand';

/** Estado do aparelho/navegador (não persiste): armazenamento, versão nova, internet. */
export const useSistema = create<{
  armazenamentoPersistente: boolean | null;
  novaVersao: boolean;
  offline: boolean;
  definir: (p: Partial<{ armazenamentoPersistente: boolean | null; novaVersao: boolean; offline: boolean }>) => void;
}>((set) => ({
  armazenamentoPersistente: null,
  novaVersao: false,
  offline: false,
  definir: (p) => set(p),
}));
