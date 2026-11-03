import { signal, computed } from '@preact/signals';
import { LIMITES_PADRAO } from '../shared/tipos';
import type { ErroModelo, Limites, Medida, PayloadPrevisao, Talhao } from '../shared/tipos';
import { FAZENDA, getJson } from './net';

import type { Operacao } from '../shared/calc';
export type Aba = 'hoje' | 'semana' | 'talhoes' | 'mapa' | 'medida' | 'confiab' | 'ajustes';
export const aba = signal<Aba>('hoje');
export const payload = signal<PayloadPrevisao | null>(null);
export const talhoes = signal<Talhao[]>([]);
export const erros = signal<ErroModelo[]>([]);
export const medidas = signal<Medida[]>([]);
export const limites = signal<Limites>(LIMITES_PADRAO);
export const historico = signal<{ data: string; prev: number }[]>([]);
export const status = signal<{ carregando: boolean; erro: string | null; ts: number | null; offline: boolean }>({
  carregando: true,
  erro: null,
  ts: null,
  offline: false,
});
export const online = signal<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => (online.value = true));
  window.addEventListener('offline', () => (online.value = false));
}
export const escopo = signal<string>('fazenda');
export const operacao = signal<Operacao>('pulv');
export const diaSel = signal<string | null>(null);
export const horaSel = signal<number | null>(null); // 'fazenda' ou id do talhão

export const fuso = computed(() => payload.value?.fazenda.fuso || 'America/Sao_Paulo');

export async function carregar(forcar = false) {
  status.value = { ...status.value, carregando: true, erro: null };
  const falhas: string[] = [];
  const lim = await getJson<Limites>(`/api/limites?fazenda=${FAZENDA}`, forcar).catch(() => null);
  if (lim) limites.value = { ...LIMITES_PADRAO, ...lim.data };
  const km = limites.value.agrupamento_km;
  const [p, t, e, m, h] = await Promise.all([
    getJson<PayloadPrevisao>(`/api/previsao?fazenda=${FAZENDA}&km=${km}`, forcar).catch((x) => (falhas.push(`previsão: ${x.message}`), null)),
    getJson<Talhao[]>(`/api/talhoes?fazenda=${FAZENDA}`, forcar).catch((x) => (falhas.push(`talhões: ${x.message}`), null)),
    getJson<ErroModelo[]>(`/api/confiabilidade?fazenda=${FAZENDA}`, forcar).catch(() => null),
    getJson<Medida[]>(`/api/medidas?fazenda=${FAZENDA}`, forcar).catch(() => null),
    getJson<{ data: string; prev: number }[]>(`/api/historico?fazenda=${FAZENDA}`, forcar).catch(() => null),
  ]);
  if (p) payload.value = p.data;
  if (t) talhoes.value = t.data;
  if (e) erros.value = e.data;
  if (m) medidas.value = m.data;
  if (h) historico.value = h.data;
  status.value = {
    carregando: false,
    erro: falhas.length ? falhas.join(' | ') : null,
    ts: p?.ts ?? status.value.ts,
    offline: !!p?.offline,
  };
}
