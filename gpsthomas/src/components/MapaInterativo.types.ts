import type { Coord } from '../geo/medidas';
import type { Comando } from '../store/dados';
import type { Camada } from '../store/prefs';
import type { Veiculo } from './veiculos';

export type TalhaoMapa = { id: string; nome: string; rotulo: string; contorno: Coord[] };

export type ParcelaMapa = { id: string; pedacos: Coord[][]; cor: string; rotulo: string; sub?: string };
export type BandeiraMapa = { id: string; coord: Coord; estado: 'pendente' | 'atual' | 'ok'; rotulo: string };

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
  /** Linha entre você e o ponto-alvo. */
  linhaGuia?: [Coord, Coord] | null;
  /** Toque numa bandeirinha. */
  onBandeira?: (id: string) => void;
};
