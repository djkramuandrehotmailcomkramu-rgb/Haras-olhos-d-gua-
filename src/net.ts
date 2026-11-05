export const FAZENDA = 'lagoa-formosa';

export interface Cached<T> {
  data: T;
  ts: number; // quando foi obtido
  offline: boolean; // true = veio do armazenamento local porque a rede falhou
}

const chave = (p: string) => `chuvapro:v1:${p}`;

export async function getJson<T>(path: string, forcarRede = false): Promise<Cached<T>> {
  try {
    const r = await fetch(path, { cache: forcarRede ? 'no-store' : 'no-cache' });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error((j && j.erro) || `HTTP ${r.status}`);
    const c: Cached<T> = { data: j as T, ts: Date.now(), offline: false };
    try {
      localStorage.setItem(chave(path), JSON.stringify({ data: c.data, ts: c.ts }));
    } catch {
      /* armazenamento cheio: segue sem cache */
    }
    return c;
  } catch (e) {
    const salvo = localStorage.getItem(chave(path));
    if (salvo) {
      const p = JSON.parse(salvo);
      return { data: p.data as T, ts: p.ts, offline: true };
    }
    throw e;
  }
}

export async function enviar<T = unknown>(path: string, metodo: 'POST' | 'PUT' | 'DELETE', corpo?: unknown): Promise<T> {
  const r = await fetch(path, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && j.erro) || `HTTP ${r.status}`);
  return j as T;
}

export function haMinutos(ts: number): string {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `há ${h} h` : `há ${Math.floor(h / 24)} dias`;
}
