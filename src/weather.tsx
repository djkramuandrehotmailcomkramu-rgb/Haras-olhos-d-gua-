import type { Icone } from '../shared/texto';

/** Ícones de clima em SVG, com animação leve (desligada para quem pede menos movimento). */
const Nuvem = ({ cor = '#dbe6f5', y = 0 }: { cor?: string; y?: number }) => (
  <path transform={`translate(0 ${y})`} d="M22 52a12 12 0 0 1 2-23.8A16 16 0 0 1 55 30a11 11 0 0 1-1 22z" fill={cor} />
);
const Raios = () => (
  <g class="w-raios" stroke="#ffb300" stroke-width="4" stroke-linecap="round">
    {Array.from({ length: 8 }, (_, i) => (
      <line x1="32" y1="6" x2="32" y2="12" transform={`rotate(${i * 45} 32 32)`} />
    ))}
  </g>
);
const Gotas = ({ n, forte }: { n: number; forte: boolean }) => (
  <g stroke={forte ? '#2f6fe0' : '#5bb6f0'} stroke-width={forte ? 3.4 : 2.6} stroke-linecap="round">
    {Array.from({ length: n }, (_, i) => (
      <line class="w-gota" style={`animation-delay:${i * 0.18}s`} x1={20 + i * (30 / Math.max(1, n - 1))} y1="54" x2={17 + i * (30 / Math.max(1, n - 1))} y2={forte ? 62 : 60} />
    ))}
  </g>
);

export function IconeClima({ tipo, size = 72, titulo }: { tipo: Icone; size?: number; titulo?: string }) {
  return (
    <svg class={`w-ico w-${tipo}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={titulo || tipo}>
      {tipo === 'sol' && (
        <>
          <Raios />
          <circle cx="32" cy="32" r="13" fill="#ffc107" />
        </>
      )}
      {tipo === 'parcial' && (
        <>
          <g transform="translate(-6 -8) scale(.85)">
            <Raios />
            <circle cx="32" cy="32" r="13" fill="#ffc107" />
          </g>
          <g class="w-nuv"><Nuvem /></g>
        </>
      )}
      {tipo === 'nuvem' && (
        <g class="w-nuv"><Nuvem cor="#c5d3e8" y={-4} /></g>
      )}
      {tipo === 'chuva' && (
        <>
          <Nuvem cor="#b9c9e0" y={-8} />
          <Gotas n={3} forte={false} />
        </>
      )}
      {tipo === 'forte' && (
        <>
          <Nuvem cor="#8fa3c4" y={-8} />
          <Gotas n={5} forte />
        </>
      )}
      {tipo === 'tempestade' && (
        <>
          <Nuvem cor="#6b7fa3" y={-8} />
          <path class="w-raio" d="M34 36 26 50h7l-3 11 11-16h-7z" fill="#ffd54f" stroke="#ff9800" stroke-width="1" stroke-linejoin="round" />
          <Gotas n={3} forte />
        </>
      )}
    </svg>
  );
}

export const IconeVento = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" />
  </svg>
);
