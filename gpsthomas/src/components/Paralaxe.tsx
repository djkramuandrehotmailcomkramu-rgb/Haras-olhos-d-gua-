import { ReactNode } from 'react';
import { ViewStyle } from 'react-native';
import Animated, { Extrapolation, SharedValue, interpolate, useAnimatedStyle } from 'react-native-reanimated';

/** Cabeçalho (ex.: mapa) que anda mais devagar que o conteúdo e dá um leve zoom ao puxar para baixo. */
export function Paralaxe({ y, children, style, fator = 0.35 }: { y: SharedValue<number>; children: ReactNode; style?: ViewStyle; fator?: number }) {
  const st = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(y.value, [-200, 0, 400], [-60, 0, 400 * fator], Extrapolation.CLAMP) },
      { scale: interpolate(y.value, [-200, 0], [1.18, 1], Extrapolation.CLAMP) },
    ],
  }));
  return <Animated.View style={[style, st]}>{children}</Animated.View>;
}
