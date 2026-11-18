/** Detecção da casca Android (APK Capacitor) e acesso às funções nativas. Recebe o `window` para poder ser testado. */

export type PluginImpressao = {
  imprimirPagina: (o: { nome: string }) => Promise<unknown>;
  imprimirHtml: (o: { html: string; nome: string }) => Promise<unknown>;
  compartilhar: (o: { nome: string; mime: string; base64: string }) => Promise<unknown>;
};

export type JanelaApp = {
  navigator?: { userAgent?: string };
  Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> };
  AndroidPrint?: { imprimirHtml?: (html: string, nome: string) => void };
};

const janela = (): JanelaApp => (typeof window === 'undefined' ? {} : (window as unknown as JanelaApp));

/** O app está rodando dentro da casca Android (por marca no navegador ou pelo Capacitor)? */
export function emAppAndroid(w: JanelaApp = janela()): boolean {
  try {
    return /GPSThomasApp/.test(w.navigator?.userAgent ?? '') || !!w.Capacitor?.isNativePlatform?.();
  } catch { return false; }
}

/** Plugin nativo "Impressao" (impressão + compartilhar arquivo), se a casca tiver. */
export function pluginImpressao(w: JanelaApp = janela()): PluginImpressao | null {
  const p = w.Capacitor?.Plugins?.Impressao as Partial<PluginImpressao> | undefined;
  return p && typeof p.imprimirPagina === 'function' && typeof p.compartilhar === 'function' ? (p as PluginImpressao) : null;
}

/** Ponte antiga (interface JavaScript do WebView), usada como reserva. */
export function ponteAntiga(w: JanelaApp = janela()): { imprimirHtml: (html: string, nome: string) => void } | null {
  const p = w.AndroidPrint;
  return p && typeof p.imprimirHtml === 'function' ? (p as { imprimirHtml: (html: string, nome: string) => void }) : null;
}

export type SituacaoApp = { app: boolean; plugin: boolean; ponteAntiga: boolean; agente: string };
export function situacaoApp(w: JanelaApp = janela()): SituacaoApp {
  return { app: emAppAndroid(w), plugin: !!pluginImpressao(w), ponteAntiga: !!ponteAntiga(w), agente: w.navigator?.userAgent ?? '' };
}

export const mensagemErro = (e: unknown): string => (e instanceof Error ? e.message : typeof e === 'string' ? e : (e as { message?: string })?.message ?? JSON.stringify(e));

/** Bytes → base64 (em pedaços, para não estourar a pilha). */
export function bytesParaBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
