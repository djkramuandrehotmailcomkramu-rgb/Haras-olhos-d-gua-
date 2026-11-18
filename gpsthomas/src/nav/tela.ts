import { Platform } from 'react-native';

const web = () => Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined';

/** O app está instalado (aberto pelo ícone da tela inicial, sem a barra do navegador)? */
export function emStandalone(): boolean {
  if (!web()) return true;
  try {
    // A casca Android (APK) se identifica no navegador interno e já abre em tela cheia.
    if (/GPSThomasApp/.test(navigator.userAgent)) return true;
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

export type ItemDiagnostico = { id: string; ok: boolean; titulo: string; detalhe: string };

/**
 * Verifica o que o Chrome precisa para instalar o app, pedindo os arquivos SEM login
 * (como o instalador faz). Serve para achar bloqueios, como a proteção da Vercel.
 */
export async function diagnosticoInstalacao(): Promise<ItemDiagnostico[]> {
  if (!web()) return [];
  const itens: ItemDiagnostico[] = [];
  const add = (id: string, ok: boolean, titulo: string, detalhe: string) => itens.push({ id, ok, titulo, detalhe });
  add('https', location.protocol === 'https:' || location.hostname === 'localhost', 'Endereço seguro (https)', location.origin);

  let manifest: any = null;
  try {
    const href = document.querySelector('link[rel=manifest]')?.getAttribute('href') ?? '/manifest.webmanifest';
    const r = await fetch(href, { credentials: 'omit', cache: 'no-store' });
    const tipo = r.headers.get('content-type') ?? '';
    if (r.status === 401 || r.status === 403 || /text\/html/.test(tipo)) {
      add('manifest', false, 'Manifest acessível sem login', r.status === 401 || r.status === 403
        ? `O servidor respondeu ${r.status}: o endereço está protegido por login (Vercel Authentication). O Chrome não consegue ler o manifest e só oferece o atalho comum, com a barra verde. É preciso liberar o acesso público ao app.`
        : 'O servidor devolveu uma página no lugar do manifest.');
    } else if (!r.ok) {
      add('manifest', false, 'Manifest acessível sem login', `Resposta ${r.status}.`);
    } else {
      manifest = await r.json();
      add('manifest', true, 'Manifest acessível sem login', `${manifest.name ?? 'GPSThomas'} · ${manifest.display ?? ''}`);
    }
  } catch (e: any) {
    add('manifest', false, 'Manifest acessível sem login', 'Não foi possível baixar o manifest.');
  }

  if (manifest) {
    const icones: any[] = manifest.icons ?? [];
    let falhas = 0;
    for (const ic of icones) {
      try { const r = await fetch(new URL(ic.src, location.origin).toString(), { credentials: 'omit', cache: 'no-store' }); if (!r.ok) falhas += 1; } catch { falhas += 1; }
    }
    const tem = (t: string) => icones.some((i) => String(i.sizes).includes(t));
    add('icones', falhas === 0 && tem('192') && tem('512'), 'Ícones 192 e 512 acessíveis', falhas ? `${falhas} ícone(s) não abriram sem login.` : `${icones.length} ícones (inclui o recortável do Android).`);
  }

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    add('sw', !!reg?.active, 'Service worker ativo', reg?.active ? 'Ativo: o app abre sem internet.' : 'Ainda não ativou. Recarregue a página uma vez.');
  } catch { add('sw', false, 'Service worker ativo', 'O navegador não permitiu registrar.'); }

  add('modo', emStandalone(), 'Aberto como aplicativo', emStandalone() ? 'Sim: sem barra do navegador.' : 'Não: está aberto no navegador ou por atalho comum (a barra verde).');
  return itens;
}
