import type { Coord } from '../geo/medidas';
import type { Comando } from '../store/dados';
import type { Camada } from '../store/prefs';
import type { Veiculo } from './veiculos';

export type TalhaoMapa = { id: string; nome: string; rotulo: string; contorno: Coord[] };

export type ParcelaMapa = { id: string; pedacos: Coord[][]; cor: string; rotulo: string; sub?: string };
export type BandeiraMapa = { id: string; coord: Coord; estado: 'pendente' | 'atual' | 'aqui' | 'ok'; rotulo: string };

export type PropsMapa = {
  talhoes: TalhaoMapa[];
  rascunho: Coord[];
  /** true: polígono (área); false: linha aberta (distância). */
  poligono: boolean;
  camada: Camada;
  posicao: { coord: Coord; precisaoM: number | null } | null;
  comando: Comando | null;
  onAdicionar: (c: Coord) => void;
  onMover: (indice: number, c: Coord) => void;
  onTalhao: (id: string) => void;
  /** Rotas calculadas (a ativa é desenhada por cima, em azul). */
  rotas?: Coord[][];
  rotaAtiva?: number;
  destino?: Coord | null;
  /** Quando definido, a câmera acompanha esta posição (modo navegação). */
  seguir?: Coord | null;
  onRota?: (indice: number) => void;
  /** Veículo desenhado no lugar da bolinha de GPS (modo navegação). */
  veiculo?: { tipo: Veiculo; rumo: number; coord: Coord } | null;
  /** Segmento da rota já percorrido (desenhado em cinza). */
  progressoIdx?: number;
  /** Parcelas coloridas do campo de sementes. */
  parcelas?: ParcelaMapa[];
  /** Bandeirinhas a colocar (cinza = pendente, âmbar = próxima, verde = colocada). */
  bandeiras?: BandeiraMapa[];
  /** Rastro reto (linha AB do monitor): desenhado estendido pelo campo, com os pontos A e B. */
  rastro?: { a: Coord; b: Coord; nome?: string } | null;
  /** Linha entre você e o ponto-alvo. */
  linhaGuia?: [Coord, Coord] | null;
  /** Toque numa bandeirinha. */
  onBandeira?: (id: string) => void;
  /** Índice do vértice selecionado (ganha a alça de arraste ao lado e fica fora do dedo). */
  /** Área ocupada pelos painéis (px) — o mapa leva o ponto selecionado para a área livre. */
  margemTopo?: number;
  margemBase?: number;
  selecionado?: number | null;
  onSelecionar?: (indice: number | null) => void;
  /** Quanto o ponto anda para cada pixel que a alça anda: 1 = igual, 0,25 = quatro vezes mais fino. */
  fatorAlca?: number;
  /** Avisa a região visível do mapa (para baixar mapas offline dela). */
  onVista?: (v: { oeste: number; sul: number; leste: number; norte: number; zoom: number; centro: Coord }) => void;
  /** Modo mira: o centro do mapa é o alvo; avisa o centro a cada movimento. */
  mira?: boolean;
  onCentro?: (c: Coord) => void;
  /** Ponto provisório (centro da mira) desenhado tracejado a partir do último ponto. */
  fantasma?: Coord | null;
};
