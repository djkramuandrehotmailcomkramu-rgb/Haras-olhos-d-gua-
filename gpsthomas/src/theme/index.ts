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
  // Visual inspirado no iOS: fundo cinza-azulado, cartões brancos, cor de destaque índigo (nada de verde "de agro").
  claro: {
    fundo: '#F2F2F7',
    cartao: '#FFFFFF',
    cartaoSuave: '#EBEBF0',
    texto: '#0E0E16',
    textoSuave: '#68687A',
    linha: 'rgba(60,60,80,0.16)',
    primaria: '#5B4FE0',
    primariaSuave: 'rgba(91,79,224,0.12)',
    sobrePrimaria: '#FFFFFF',
    destaque: '#FF9F0A',
    perigo: '#D92D20',
    vidro: 'light',
    vidroCor: 'rgba(250,250,254,0.80)',
    gps: '#0A84FF', terra: '#8B5E34', ok: '#1E8E4E', atencao: '#B45309', primariaTexto: '#4A3FC7', sobrePerigo: '#FFFFFF',
  },
  escuro: {
    fundo: '#000000',
    cartao: '#1C1C1E',
    cartaoSuave: '#2C2C2E',
    texto: '#F5F5F7',
    textoSuave: '#9C9CAA',
    linha: 'rgba(235,235,245,0.16)',
    primaria: '#8F86FF',
    primariaSuave: 'rgba(143,134,255,0.18)',
    sobrePrimaria: '#0E0A3A',
    destaque: '#FFB340',
    perigo: '#FF6B6B',
    vidro: 'dark',
    vidroCor: 'rgba(28,28,30,0.78)',
    gps: '#5AA9FF', terra: '#C28A55', ok: '#34C759', atencao: '#FFB340', primariaTexto: '#A9A2FF', sobrePerigo: '#2B0A0A',
  },
};


export function useTema(): Paleta {
  const forcado = useTemaForcado((s) => s.modo);
  const sistema = useColorScheme();
  return forcado === 'escuro' || sistema === 'dark' ? paletas.escuro : paletas.claro;
}

export const espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const raio = { sm: 8, md: 12, lg: 16, xl: 24, pilula: 999 };

export const fonte = {
  regular: 'Inter_400Regular',
  media: 'Inter_500Medium',
  // Visual mais fino: os pesos "semi" e "negrito" usam um degrau mais leve (só há 400/500/600 carregados).
  semi: 'Inter_500Medium',
  negrito: 'Inter_600SemiBold',
};

// Escala tipográfica no estilo do iOS (Inter fica o mais perto possível da fonte do iPhone na web/Android).
export const tipo = {
  tituloGrande: { fontFamily: fonte.negrito, fontSize: 34, letterSpacing: -0.9, lineHeight: 40 },
  titulo: { fontFamily: fonte.negrito, fontSize: 22, letterSpacing: -0.4, lineHeight: 28 },
  subtitulo: { fontFamily: fonte.negrito, fontSize: 17, letterSpacing: -0.3, lineHeight: 22 },
  corpo: { fontFamily: fonte.regular, fontSize: 16, letterSpacing: -0.2, lineHeight: 22 },
  legenda: { fontFamily: fonte.media, fontSize: 13, letterSpacing: -0.1 },
  numeroGrande: { fontFamily: fonte.media, fontSize: 40, letterSpacing: -1.2, fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
};
