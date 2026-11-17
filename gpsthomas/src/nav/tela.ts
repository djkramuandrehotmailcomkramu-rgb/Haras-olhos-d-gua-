import { Platform } from 'react-native';

const web = () => Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined';

/** O app está instalado (aberto pelo ícone da tela inicial, sem a barra do navegador)? */
export function emStandalone(): boolean {
  if (!web()) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || (navigator as any).standalone === true;
  } catch { return false; }
}

export const emTelaCheia = () => web() && !!document.fullscreenElement;

/** Esconde a barra do navegador / barra de status. Precisa de um toque do usuário. */
export async function entrarTelaCheia(): Promise<boolean> {
  if (!web()) return false;
  try {
    const el: any = document.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
    return true;
  } catch { return false; }
}

export async function sairTelaCheia(): Promise<void> {
  if (!web() || !document.fullscreenElement) return;
  try { await document.exitFullscreen(); } catch {}
}

export const podeTelaCheia = () => web() && !!(document.documentElement.requestFullscreen || (document.documentElement as any).webkitRequestFullscreen);

export type ResultadoInstalar = 'aceito' | 'recusado' | 'indisponivel';

/** Abre o pedido de instalação do Chrome, se o navegador já o liberou. */
export async function instalarApp(): Promise<ResultadoInstalar> {
  if (!web()) return 'indisponivel';
  const ev = (window as any).__gtInstalar;
  if (!ev) return 'indisponivel';
  try {
    ev.prompt();
    const r = await ev.userChoice;
    (window as any).__gtInstalar = null;
    return r?.outcome === 'accepted' ? 'aceito' : 'recusado';
  } catch { return 'indisponivel'; }
}

export const INSTRUCAO_INSTALAR =
  'No Chrome: toque no menu ⋮ e em "Instalar app" (ou "Adicionar à tela inicial"). Se já houver um atalho antigo do GPSThomas na tela inicial, remova-o antes e abra o app pelo ícone novo: a barra verde some.';
