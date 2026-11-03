// Acesso ao Supabase via REST (sem SDK). Chave só no servidor (env), nunca no celular.
export interface Req {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body?: any;
  headers: Record<string, string | string[] | undefined>;
}
export interface Res {
  status(c: number): Res;
  json(b: unknown): void;
  setHeader(k: string, v: string): void;
  end(b?: string): void;
}

const URL_ = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = () => process.env.SUPABASE_KEY || '';

export const q1 = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) || '';

export async function db<T = any>(
  tabela: string,
  opts: { method?: string; query?: string; body?: unknown; upsert?: string; retorno?: boolean } = {},
): Promise<T> {
  if (!URL_() || !KEY()) throw new Error('SUPABASE_URL/SUPABASE_KEY não configurados');
  const h: Record<string, string> = { apikey: KEY(), Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json' };
  const prefer: string[] = [];
  if (opts.upsert) prefer.push(`resolution=merge-duplicates`);
  if (opts.retorno !== false && opts.method && opts.method !== 'GET') prefer.push('return=representation');
  if (prefer.length) h.Prefer = prefer.join(',');
  const url = `${URL_()}/rest/v1/${tabela}?${opts.upsert ? `on_conflict=${opts.upsert}&` : ''}${opts.query || ''}`;
  const r = await fetch(url, { method: opts.method || 'GET', headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${tabela} ${r.status}: ${txt.slice(0, 300)}`);
  return (txt ? JSON.parse(txt) : null) as T;
}

export function erro(res: Res, e: unknown, status = 500) {
  const msg = e instanceof Error ? e.message : String(e);
  res.status(status).json({ erro: msg });
}
