import { useColorScheme } from 'react-native';
import { create } from 'zustand';

export const useTemaForcado = create<{ modo: 'auto' | 'escuro'; definir: (m: 'auto' | 'escuro') => void }>((set) => ({ modo: 'auto', definir: (modo) => set({ modo }) }));

export type Paleta = {
  fundo: string; cartao: string; cartaoSuave: string; texto: string; textoSuave: string; linha: string;
  primaria: string; primariaSuave: string; sobrePrimaria: string; destaque: string; perigo: string;
  vidro: 'light' | 'dark'; vidroCor: string;
  gps: string; terra: string; ok: string; atencao: string;
  /** texto verde sobre fundos suaves (contraste AA) */
  primariaTexto: string;
  /** texto sobre o botão de perigo */
  sobrePerigo: string;
};

export const paletas: Record<'claro' | 'escuro', Paleta> = {
  claro: {
    fundo: '#F1F4EF',
    cartao: '#FFFFFF',
    cartaoSuave: '#E8EDE6',
    texto: '#13201A',
    textoSuave: '#5B6B61',
    linha: 'rgba(19,32,26,0.10)',
    primaria: '#1F7A3E',
    primariaSuave: 'rgba(31,122,62,0.12)',
    sobrePrimaria: '#FFFFFF',
    destaque: '#D99A00',
    perigo: '#C73636',
    vidro: 'light',
    vidroCor: 'rgba(255,255,255,0.82)',
    gps: '#2F7DF6', terra: '#8B5E34', ok: '#166A38', atencao: '#9A6400', primariaTexto: '#17632F', sobrePerigo: '#FFFFFF',
  },
  escuro: {
    fundo: '#0A110D',
    cartao: '#151F19',
    cartaoSuave: '#1D2A22',
    texto: '#EEF4EF',
    textoSuave: '#93A59A',
    linha: 'rgba(238,244,239,0.12)',
    primaria: '#3FB063',
    primariaSuave: 'rgba(63,176,99,0.18)',
    sobrePrimaria: '#06210F',
    destaque: '#F2B73D',
    perigo: '#F07070',
    vidro: 'dark',
    vidroCor: 'rgba(16,25,20,0.80)',
    gps: '#5B9BFF', terra: '#C28A55', ok: '#3FB063', atencao: '#F2B73D', primariaTexto: '#3FB063', sobrePerigo: '#2B0A0A',
  },
};


export function useTema(): Paleta {
  const forcado = useTemaForcado((s) => s.modo);
  const sistema = useColorScheme();
  return forcado === 'escuro' || sistema === 'dark' ? paletas.escuro : paletas.claro;
}

export const espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const raio = { sm: 10, md: 16, lg: 22, xl: 30, pilula: 999 };

export const fonte = {
  regular: 'Inter_400Regular',
  media: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  negrito: 'Inter_700Bold',
};

export const tipo = {
  tituloGrande: { fontFamily: fonte.negrito, fontSize: 34, letterSpacing: -0.8 },
  titulo: { fontFamily: fonte.negrito, fontSize: 22, letterSpacing: -0.4 },
  subtitulo: { fontFamily: fonte.semi, fontSize: 17, letterSpacing: -0.2 },
  corpo: { fontFamily: fonte.regular, fontSize: 15 },
  legenda: { fontFamily: fonte.media, fontSize: 12.5, letterSpacing: 0.2 },
  numeroGrande: { fontFamily: fonte.negrito, fontSize: 40, letterSpacing: -1, fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
};
