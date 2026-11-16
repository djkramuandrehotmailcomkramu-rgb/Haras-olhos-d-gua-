import { create } from 'zustand';

type Tipo = 'info' | 'ok' | 'erro';
export const useToast = create<{ msg: string | null; tipo: Tipo; id: number; mostrar: (m: string, t?: Tipo) => void; esconder: () => void }>((set) => ({
  msg: null,
  tipo: 'info',
  id: 0,
  mostrar: (msg, tipo = 'info') => set((s) => ({ msg, tipo, id: s.id + 1 })),
  esconder: () => set({ msg: null }),
}));
