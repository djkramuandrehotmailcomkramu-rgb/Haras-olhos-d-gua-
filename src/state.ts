import { signal, computed } from '@preact/signals';
import { LIMITES_PADRAO } from '../shared/tipos';
import type { ErroModelo, Limites, Lugar, Medida, PayloadLugar, PayloadPrevisao, Talhao } from '../shared/tipos';
import { FAZENDA, getJson } from './net';

import type { Operacao } from '../shared/calc';
export type Aba = 'hoje' | 'semana' | 'talhoes' | 'mapa' | 'medida' | 'confiab' | 'ajustes' | 'mais';
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

// ---- preferências (modo, tema, tamanho do texto, guia) e relógio ao vivo ----
export type Modo = 'simples' | 'tecnico';
export type Tema = 'auto' | 'claro' | 'escuro';
export type Fonte = 'normal' | 'grande' | 'extra';
const ler = (k: string, pad: string) => {
  try {
    return localStorage.getItem('chuvapro:' + k) || pad;
  } catch {
    return pad;
  }
};
const gravar = (k: string, v: string) => {
  try {
    localStorage.setItem('chuvapro:' + k, v);
  } catch {
    /* sem armazenamento */
  }
};
export const modo = signal<Modo>(ler('modo', 'simples') as Modo);
export const tema = signal<Tema>(ler('tema', 'auto') as Tema);
export const fonte = signal<Fonte>(ler('fonte', 'grande') as Fonte);
export const guiaVisto = signal<boolean>(ler('guia', '0') === '1');
export const guiaAberto = signal<boolean>(false);
export const guiaPasso = signal<number>(0);
export function abrirGuia() {
  guiaPasso.value = 0;
  guiaAberto.value = true;
}
/** relógio que "bate" a cada 30 s para o app mostrar "há X min" e a hora atual sem precisar recarregar */
export const agora = signal<number>(Date.now());

export function aplicarPreferencias() {
  const r = document.documentElement;
  r.dataset.tema = tema.value;
  r.dataset.fonte = fonte.value;
  const claro = tema.value === 'claro' || (tema.value === 'auto' && window.matchMedia?.('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', claro ? '#1d5fc4' : '#0B1B33');
}
export function definirModo(m: Modo) {
  modo.value = m;
  gravar('modo', m);
}
export function definirTema(t: Tema) {
  tema.value = t;
  gravar('tema', t);
  aplicarPreferencias();
}
export function definirFonte(f: Fonte) {
  fonte.value = f;
  gravar('fonte', f);
  aplicarPreferencias();
}
export function concluirGuia() {
  guiaVisto.value = true;
  guiaAberto.value = false;
  guiaPasso.value = 0;
  gravar('guia', '1');
}

export const instalarEvt = signal<any>(null);
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    instalarEvt.value = e;
  });
}

/** Atualiza fazenda e (se houver) o local pesquisado. `forcar` ignora o cache do navegador. */
export async function atualizarTudo(forcar = false) {
  agora.value = Date.now();
  await Promise.all([carregar(forcar), lugar.value ? abrirLugar(lugar.value, forcar) : Promise.resolve()]);
  agora.value = Date.now();
}
