import type { Coord } from '../geo/medidas';

// Dados de exemplo só para a Fase 1 (serão trocados pelo banco local).
export type Talhao = {
  id: string;
  nome: string;
  fazenda: string;
  cultura: string;
  safra: string;
  contorno: Coord[];
};

const base: Coord = [-47.9292, -15.7801];
const g = (dx: number, dy: number): Coord => [base[0] + dx / 111_320, base[1] + dy / 110_574];

export const talhoes: Talhao[] = [
  { id: '1', nome: 'Talhão 01 – Lagoa', fazenda: 'Fazenda Lagoa Formosa', cultura: 'Soja', safra: '2026/27',
    contorno: [g(0, 0), g(900, 60), g(940, 520), g(380, 640), g(-40, 480)] },
  { id: '2', nome: 'Talhão 02 – Várzea', fazenda: 'Fazenda Lagoa Formosa', cultura: 'Soja', safra: '2026/27',
    contorno: [g(1000, 0), g(1500, 40), g(1560, 700), g(1010, 640)] },
  { id: '3', nome: 'Talhão 03 – Sede', fazenda: 'Haras Olhos d’Água', cultura: 'Milho', safra: '2026/27',
    contorno: [g(0, 760), g(620, 720), g(700, 1180), g(80, 1220)] },
];
