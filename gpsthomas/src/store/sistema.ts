import { create } from 'zustand';

/** Estado do aparelho/navegador (não persiste): armazenamento, versão nova, internet. */
export const useSistema = create<{
  armazenamentoPersistente: boolean | null;
  novaVersao: boolean;
  offline: boolean;
  instalado: boolean;
  podeInstalar: boolean;
  telaCheia: boolean;
  definir: (p: Partial<{ armazenamentoPersistente: boolean | null; novaVersao: boolean; offline: boolean; instalado: boolean; podeInstalar: boolean; telaCheia: boolean }>) => void;
}>((set) => ({
  armazenamentoPersistente: null,
  novaVersao: false,
  offline: false,
  instalado: true,
  podeInstalar: false,
  telaCheia: false,
  definir: (p) => set(p),
}));
