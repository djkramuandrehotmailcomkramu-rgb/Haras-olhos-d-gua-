import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polygon, Circle, Line, Defs, Pattern, Rect } from 'react-native-svg';
import type { Coord } from '../geo/medidas';
import { useTema } from '../theme';

type Props = {
  poligonos: { id: string; pontos: Coord[]; destaque?: boolean }[];
  largura: number;
  altura: number;
  margem?: number;
};

/**
 * Prévia vetorial dos talhões (projeção plana local) para a Fase 1.
 * Na Fase 2 este componente é trocado pelo mapa de satélite (MapLibre).
 */
export function MapaCampo({ poligonos, largura, altura, margem = 40 }: Props) {
  const t = useTema();
  const desenho = useMemo(() => {
    const todos = poligonos.flatMap((p) => p.pontos);
    if (todos.length === 0) return [];
    const lons = todos.map((c) => c[0]);
    const lats = todos.map((c) => c[1]);
    const minX = Math.min(...lons), maxX = Math.max(...lons);
    const minY = Math.min(...lats), maxY = Math.max(...lats);
    const k = Math.min((largura - 2 * margem) / (maxX - minX || 1), (altura - 2 * margem) / (maxY - minY || 1));
    const offX = (largura - (maxX - minX) * k) / 2;
    const offY = (altura - (maxY - minY) * k) / 2;
    return poligonos.map((p) => ({
      ...p,
      xy: p.pontos.map((c) => [offX + (c[0] - minX) * k, altura - (offY + (c[1] - minY) * k)] as [number, number]),
    }));
  }, [poligonos, largura, altura, margem]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={largura} height={altura}>
        <Defs>
          <Pattern id="grade" width="32" height="32" patternUnits="userSpaceOnUse">
            <Line x1="0" y1="0" x2="0" y2="32" stroke={t.linha} strokeWidth="1" />
            <Line x1="0" y1="0" x2="32" y2="0" stroke={t.linha} strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect width={largura} height={altura} fill={t.cartaoSuave} />
        <Rect width={largura} height={altura} fill="url(#grade)" />
        {desenho.map((p) => (
          <Polygon
            key={p.id}
            points={p.xy.map((c) => c.join(',')).join(' ')}
            fill={p.destaque ? t.primariaSuave : 'rgba(217,154,0,0.14)'}
            stroke={p.destaque ? t.primaria : t.destaque}
            strokeWidth={p.destaque ? 3 : 2}
            strokeLinejoin="round"
          />
        ))}
        {desenho
          .filter((p) => p.destaque)
          .flatMap((p) => p.xy)
          .map((c, i) => (
            <Circle key={i} cx={c[0]} cy={c[1]} r={6} fill="#fff" stroke={t.primaria} strokeWidth={3} />
          ))}
      </Svg>
    </View>
  );
}
