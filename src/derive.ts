import { addDias, assinaturaPrevisao, diasPrevistos, hojeLocal, horasPrevistas, somaMm } from '../shared/calc';
import type { ValorDia, ValorHora } from '../shared/calc';
import type { Grupo, Medida, PayloadPrevisao, Talhao } from '../shared/tipos';

export interface VisaoGrupo {
  grupo: Grupo;
  dias: ValorDia[];
  horas: ValorHora[];
}

const memo = new Map<string, VisaoGrupo>();

export function visaoGrupo(p: PayloadPrevisao, g: Grupo, erros: import('../shared/tipos').ErroModelo[]): VisaoGrupo {
  const k = `${p.gerado_em}|${g.id}|${erros.map((e) => e.atualizado_em).join(',').length}`;
  const hit = memo.get(k);
  if (hit) return hit;
  const hoje = hojeLocal(p.fazenda.fuso);
  const v = {
    grupo: g,
    dias: diasPrevistos(g.forecast, p.fazenda.fuso, erros, hoje, g.ens),
    horas: horasPrevistas(g.forecast, g.meteo, p.fazenda.fuso, erros, hoje),
  };
  if (memo.size > 12) memo.clear();
  memo.set(k, v);
  return v;
}

export function grupoDoTalhao(p: PayloadPrevisao, talhaoId: string): Grupo | undefined {
  return p.grupos.find((g) => g.talhoes.includes(talhaoId));
}

/** Grupo de referência da fazenda: o que concentra mais talhões. */
export function grupoReferencia(p: PayloadPrevisao): Grupo {
  return [...p.grupos].sort((a, b) => b.talhoes.length - a.talhoes.length)[0];
}

/** Dois grupos são a "mesma célula" só se TODOS os modelos deram exatamente os mesmos números (as grades dos modelos diferem). */
export const chaveCelula = (g: Grupo) => assinaturaPrevisao(g.forecast);

/** Quantos talhões compartilham a mesma célula de grade do modelo (inclui o próprio). */
export function talhoesNaCelula(p: PayloadPrevisao, talhaoId: string): number {
  const g = grupoDoTalhao(p, talhaoId);
  if (!g) return 1;
  const c = chaveCelula(g);
  return p.grupos.filter((x) => chaveCelula(x) === c).reduce((s, x) => s + x.talhoes.length, 0);
}

/** Chuva medida de um dia: do talhão (se houver), senão média dos lançamentos gerais do dia. */
export function medidoDia(ms: Medida[], data: string, talhaoId: string | null): number | null {
  const doDia = ms.filter((m) => m.data === data);
  if (!doDia.length) return null;
  if (talhaoId) {
    const t = doDia.filter((m) => m.talhao_id === talhaoId);
    if (t.length) return t.reduce((s, m) => s + Number(m.mm), 0) / t.length;
    const g = doDia.filter((m) => !m.talhao_id);
    return g.length ? g.reduce((s, m) => s + Number(m.mm), 0) / g.length : null;
  }
  return doDia.reduce((s, m) => s + Number(m.mm), 0) / doDia.length;
}

export function medidoPeriodo(ms: Medida[], de: string, ate: string, talhaoId: string | null): number {
  let s = 0;
  for (let d = de; d <= ate; d = addDias(d, 1)) s += medidoDia(ms, d, talhaoId) ?? 0;
  return s;
}

export function inicioSafra(hoje: string, mmdd: string): string {
  const ano = Number(hoje.slice(0, 4));
  const cand = `${ano}-${mmdd}`;
  return cand <= hoje ? cand : `${ano - 1}-${mmdd}`;
}

export function previstoPeriodo(v: VisaoGrupo, hoje: string, dias: number): number {
  return v.dias.filter((d) => d.data >= hoje && d.data < addDias(hoje, dias)).reduce((s, d) => s + (d.provavel ?? 0), 0);
}

export { somaMm };

/** Ponto dentro do polígono (ray casting). */
export function dentro(lat: number, lon: number, t: Talhao): boolean {
  const anel = t.geom.coordinates[0];
  let c = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
