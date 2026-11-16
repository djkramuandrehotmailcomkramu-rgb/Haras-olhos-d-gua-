import type { Coord } from '../geo/medidas';
import type { Comando } from '../store/dados';
import type { Camada } from '../store/prefs';

export type TalhaoMapa = { id: string; nome: string; rotulo: string; contorno: Coord[] };

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
};
