import { signal, computed } from '@preact/signals';
import { LIMITES_PADRAO } from '../shared/tipos';
import type { ErroModelo, Limites, Lugar, Medida, PayloadLugar, PayloadPrevisao, Talhao } from '../shared/tipos';
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

// ---- local pesquisado (cidade, estado ou coordenada fora do KML) ----
export const lugar = signal<Lugar | null>(null);
export const payloadLugar = signal<PayloadLugar | null>(null);
export const statusLugar = signal<{ carregando: boolean; erro: string | null; offline: boolean; ts: number | null }>({ carregando: false, erro: null, offline: false, ts: null });
export const buscaAberta = signal(false);

const chaveLugar = (l: Lugar) => `${l.lat},${l.lon}`;

export async function abrirLugar(l: Lugar | null, forcar = false) {
  lugar.value = l;
  if (!l) {
    payloadLugar.value = null;
    return;
  }
  aba.value = 'hoje';
  diaSel.value = null;
  horaSel.value = null;
  buscaAberta.value = false;
  salvarRecente(l);
  if (payloadLugar.value && chaveLugar(payloadLugar.value.lugar) !== chaveLugar(l)) payloadLugar.value = null;
  statusLugar.value = { ...statusLugar.value, carregando: true, erro: null };
  try {
    const q = `lat=${l.lat}&lon=${l.lon}&nome=${encodeURIComponent(l.nome)}&detalhe=${encodeURIComponent(l.detalhe || '')}&tipo=${encodeURIComponent(l.tipo || '')}`;
    const r = await getJson<PayloadLugar>(`/api/ponto?${q}`, forcar);
    if (lugar.value && chaveLugar(lugar.value) === chaveLugar(l)) {
      payloadLugar.value = r.data;
      statusLugar.value = { carregando: false, erro: r.data.erros.length ? r.data.erros.join(' | ') : null, offline: r.offline, ts: r.ts };
    }
  } catch (e) {
    statusLugar.value = { carregando: false, erro: `Não consegui a previsão de ${l.nome}: ${(e as Error).message}`, offline: false, ts: null };
  }
}

const RECENTES = 'chuvapro:recentes';
export function lerRecentes(): Lugar[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTES) || '[]');
  } catch {
    return [];
  }
}
function salvarRecente(l: Lugar) {
  try {
    const lista = [l, ...lerRecentes().filter((x) => chaveLugar(x) !== chaveLugar(l))].slice(0, 6);
    localStorage.setItem(RECENTES, JSON.stringify(lista));
  } catch {
    /* sem armazenamento: segue */
  }
}
