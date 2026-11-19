import { Platform } from 'react-native';
import { urlsDaArea, contarTiles, type Caixa } from './tiles';
import type { CamadaId } from './camadas';

/** Mapas salvos no aparelho (Cache Storage do navegador): o mesmo cache que o service worker usa para mostrar o mapa sem internet. */
export const CACHE_TILES = 'gpsthomas-tiles';
const CHAVE = 'gpsthomas-areas-offline';

export type AreaOffline = {
  id: string;
  nome: string;
  caixa: Caixa;
  camada: CamadaId;
  zmin: number;
  zmax: number;
  tiles: number;
  bytes: number;
  falhas: number;
  criadoEm: number;
};

const web = () => Platform.OS === 'web' && typeof caches !== 'undefined';

export function listarAreas(): AreaOffline[] {
  try { return JSON.parse(localStorage.getItem(CHAVE) ?? '[]'); } catch { return []; }
}
const salvarLista = (l: AreaOffline[]) => { try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch {} };

export const suportaOffline = () => web() && typeof fetch !== 'undefined';

export type Progresso = { feitos: number; total: number; bytes: number; falhas: number };

/**
 * Baixa os blocos da área para o cache. Respeita o limite de conexões (6 por vez), repete falhas 2 vezes
 * e pula o que já está salvo. Pode ser cancelado pelo `sinal`.
 */
export async function baixarArea(o: {
  nome: string; caixa: Caixa; camada: CamadaId; zmin: number; zmax: number;
  onProgresso?: (p: Progresso) => void; sinal?: AbortSignal;
  /** para testes */ buscar?: typeof fetch;
}): Promise<AreaOffline> {
  if (!suportaOffline()) throw new Error('Este navegador não permite guardar mapas offline.');
  const buscar = o.buscar ?? fetch.bind(globalThis);
  const urls = urlsDaArea(o.camada, o.caixa, o.zmin, o.zmax);
  const cache = await caches.open(CACHE_TILES);
  let feitos = 0, bytes = 0, falhas = 0, proximo = 0;
  const total = urls.length;
  let ultimoAviso = 0;
  const avisar = (forcar = false) => {
    const agora = Date.now();
    if (!forcar && agora - ultimoAviso < 200) return;
    ultimoAviso = agora;
    o.onProgresso?.({ feitos, total, bytes, falhas });
  };

  const um = async (url: string) => {
    if (await cache.match(url, { ignoreVary: true })) return true;
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      if (o.sinal?.aborted) return false;
      try {
        const r = await buscar(url, { mode: 'cors', credentials: 'omit', signal: o.sinal });
        if (r.ok) {
          const copia = r.clone();
          bytes += (await copia.blob()).size;
          await cache.put(url, r);
          return true;
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return false;
      }
      await new Promise((ok) => setTimeout(ok, 300 * (tentativa + 1)));
    }
    return false;
  };

  const trabalhador = async () => {
    while (!o.sinal?.aborted) {
      const i = proximo++;
      if (i >= total) return;
      const ok = await um(urls[i]);
      if (o.sinal?.aborted) return;
      if (ok) feitos += 1; else falhas += 1;
      avisar();
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, total) }, trabalhador));
  avisar(true);
  if (o.sinal?.aborted) throw new DOMException('Download cancelado', 'AbortError');

  const area: AreaOffline = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    nome: o.nome, caixa: o.caixa, camada: o.camada, zmin: o.zmin, zmax: o.zmax, tiles: total, bytes, falhas, criadoEm: Date.now(),
  };
  salvarLista([area, ...listarAreas()]);
  return area;
}

/** Remove uma área salva (e os blocos dela que nenhuma outra área usa). */
export async function removerArea(id: string): Promise<void> {
  const lista = listarAreas();
  const alvo = lista.find((a) => a.id === id);
  if (!alvo) return;
  const resto = lista.filter((a) => a.id !== id);
  salvarLista(resto);
  if (!web()) return;
  const cache = await caches.open(CACHE_TILES);
  const mantidas = new Set<string>();
  for (const a of resto) for (const u of urlsDaArea(a.camada, a.caixa, a.zmin, a.zmax)) mantidas.add(u);
  for (const u of urlsDaArea(alvo.camada, alvo.caixa, alvo.zmin, alvo.zmax)) if (!mantidas.has(u)) await cache.delete(u);
}

/** Quantos blocos da área já estão salvos (para mostrar "completo"). */
export async function blocosSalvos(a: Pick<AreaOffline, 'camada' | 'caixa' | 'zmin' | 'zmax'>): Promise<{ salvos: number; total: number }> {
  const total = contarTiles(a.caixa, a.zmin, a.zmax);
  if (!web()) return { salvos: 0, total };
  const cache = await caches.open(CACHE_TILES);
  const chaves = await cache.keys();
  const urls = new Set(urlsDaArea(a.camada, a.caixa, a.zmin, a.zmax));
  let salvos = 0;
  for (const k of chaves) if (urls.has(k.url)) salvos += 1;
  return { salvos: Math.floor(salvos / (a.camada === 'satelite' ? 2 : 1)), total };
}

export async function armazenamento(): Promise<{ usado: number; quota: number; persistente: boolean }> {
  try {
    const e = await navigator.storage?.estimate?.();
    const persistente = (await navigator.storage?.persisted?.()) ?? false;
    return { usado: e?.usage ?? 0, quota: e?.quota ?? 0, persistente };
  } catch { return { usado: 0, quota: 0, persistente: false }; }
}

/** Pede ao navegador para não apagar os mapas salvos quando o espaço apertar. */
export async function pedirPersistencia(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
