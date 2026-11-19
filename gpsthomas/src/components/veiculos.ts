export type Veiculo = 'carro' | 'picape' | 'caminhao' | 'moto';

export const VEICULOS: { id: Veiculo; rotulo: string }[] = [
  { id: 'carro', rotulo: 'Carro' },
  { id: 'picape', rotulo: 'Picape' },
  { id: 'caminhao', rotulo: 'Caminhão' },
  { id: 'moto', rotulo: 'Moto' },
];

const VIDRO = '#10261A';

/** Desenho do veículo visto de cima, de frente para o topo (norte). Mesmo desenho no mapa e nos menus. */
export function svgVeiculo(tipo: Veiculo, cor = '#5B4FE0', tamanho = 64): string {
  const halo = `<circle cx="32" cy="32" r="30" fill="${cor}" fill-opacity=".16"/>`;
  const sombra = `<ellipse cx="33" cy="36" rx="15" ry="26" fill="#000" fill-opacity=".22"/>`;
  let corpo = '';
  if (tipo === 'carro') {
    corpo = `<rect x="18" y="7" width="28" height="50" rx="12" fill="${cor}" stroke="#fff" stroke-width="2.5"/>
      <path d="M22.5 22 L41.5 22 L39.5 31 L24.5 31 Z" fill="${VIDRO}" fill-opacity=".82"/>
      <path d="M24.5 43 L39.5 43 L41.5 49 L22.5 49 Z" fill="${VIDRO}" fill-opacity=".82"/>
      <rect x="22" y="31" width="20" height="12" rx="3" fill="#fff" fill-opacity=".25"/>
      <rect x="14" y="26" width="5" height="7" rx="2" fill="${cor}" stroke="#fff" stroke-width="1.5"/><rect x="45" y="26" width="5" height="7" rx="2" fill="${cor}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="24" cy="10.5" r="2" fill="#FFE9A8"/><circle cx="40" cy="10.5" r="2" fill="#FFE9A8"/>`;
  } else if (tipo === 'picape') {
    corpo = `<rect x="17" y="4" width="30" height="56" rx="9" fill="${cor}" stroke="#fff" stroke-width="2.5"/>
      <path d="M21.5 18 L42.5 18 L40.5 27 L23.5 27 Z" fill="${VIDRO}" fill-opacity=".82"/>
      <rect x="21" y="35" width="22" height="21" rx="3" fill="#000" fill-opacity=".28"/>
      <rect x="21" y="35" width="22" height="21" rx="3" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/>
      <rect x="13" y="22" width="5" height="7" rx="2" fill="${cor}" stroke="#fff" stroke-width="1.5"/><rect x="46" y="22" width="5" height="7" rx="2" fill="${cor}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="23" cy="7.5" r="2" fill="#FFE9A8"/><circle cx="41" cy="7.5" r="2" fill="#FFE9A8"/>`;
  } else if (tipo === 'caminhao') {
    corpo = `<rect x="16" y="25" width="32" height="37" rx="4" fill="#E5E7EB" stroke="#fff" stroke-width="2.5"/>
      <path d="M22 30 H42 M22 38 H42 M22 46 H42 M22 54 H42" stroke="#9CA3AF" stroke-width="1.5"/>
      <rect x="18" y="3" width="28" height="19" rx="7" fill="${cor}" stroke="#fff" stroke-width="2.5"/>
      <path d="M21.5 9 L42.5 9 L41 15 L23 15 Z" fill="${VIDRO}" fill-opacity=".82"/>
      <rect x="13" y="8" width="5" height="7" rx="2" fill="${cor}" stroke="#fff" stroke-width="1.5"/><rect x="46" y="8" width="5" height="7" rx="2" fill="${cor}" stroke="#fff" stroke-width="1.5"/>`;
  } else {
    corpo = `<path d="M17 19 H47" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/><path d="M17 19 H47" stroke="${cor}" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="32" cy="34" rx="7.5" ry="24" fill="${cor}" stroke="#fff" stroke-width="2.5"/>
      <circle cx="32" cy="33" r="7.5" fill="${VIDRO}" fill-opacity=".85"/><circle cx="32" cy="33" r="4.5" fill="#fff" fill-opacity=".9"/>
      <circle cx="32" cy="12" r="2.2" fill="#FFE9A8"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 64 64">${halo}${tipo === 'moto' ? '' : sombra}${corpo}</svg>`;
}
