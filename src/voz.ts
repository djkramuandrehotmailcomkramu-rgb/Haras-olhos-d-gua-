/** Lê um texto em voz alta (pt-BR). Retorna false se o aparelho não tiver voz. Chamar de novo enquanto fala = parar. */
export function falar(texto: string, aoTerminar?: () => void): boolean {
  const s = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  if (!s || typeof SpeechSynthesisUtterance === 'undefined') return false;
  if (s.speaking) {
    s.cancel();
    aoTerminar?.();
    return true;
  }
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'pt-BR';
  u.rate = 0.95;
  const voz = s.getVoices().find((v) => v.lang?.toLowerCase().startsWith('pt'));
  if (voz) u.voice = voz;
  u.onend = () => aoTerminar?.();
  u.onerror = () => aoTerminar?.();
  s.speak(u);
  return true;
}
export const temVoz = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
