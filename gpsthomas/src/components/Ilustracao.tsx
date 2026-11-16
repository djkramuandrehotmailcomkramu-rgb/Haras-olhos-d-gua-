import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTema } from '../theme';

/** Ilustração de estado vazio: talhão + pino de GPS (mesmo desenho do ícone). */
export function Ilustracao({ tamanho = 120 }: { tamanho?: number }) {
  const t = useTema();
  return (
    <View style={{ width: tamanho, height: tamanho * 0.85 }}>
      <Svg width={tamanho} height={tamanho * 0.85} viewBox="0 0 240 204">
        <Defs>
          <LinearGradient id="amb" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFD166" /><Stop offset="1" stopColor="#F0A01C" />
          </LinearGradient>
        </Defs>
        <Path d="M30 96 L96 60 L170 78 L204 138 L140 180 L58 166 Z" fill={t.primariaSuave} stroke={t.primaria} strokeWidth={6} strokeLinejoin="round" />
        {[[30, 96], [96, 60], [170, 78], [204, 138], [140, 180], [58, 166]].map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={8} fill="#fff" stroke={t.primaria} strokeWidth={4} />
        ))}
        <Path d="M120 118 C 98 96, 92 82, 92 70 A28 28 0 1 1 148 70 C 148 82, 142 96, 120 118 Z" fill="url(#amb)" />
        <Circle cx={120} cy={70} r={10} fill={t.fundo} />
      </Svg>
    </View>
  );
}
