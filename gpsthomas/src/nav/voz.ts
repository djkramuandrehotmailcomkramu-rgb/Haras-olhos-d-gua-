import { Platform } from 'react-native';

/** Fala em português (voz do navegador). Silencioso onde não houver suporte. */
export function falar(texto: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    u.rate = 1.02;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith('pt'));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch {}
}

export function pararVoz() {
  try { if (Platform.OS === 'web' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); } catch {}
}

/** Mantém a tela ligada durante a navegação (quando o navegador permite). */
let trava: any = null;
export async function manterTelaLigada(ligar: boolean) {
  if (Platform.OS !== 'web') return;
  try {
    if (ligar && 'wakeLock' in navigator) trava = await (navigator as any).wakeLock.request('screen');
    else if (!ligar && trava) { await trava.release(); trava = null; }
  } catch {}
}
