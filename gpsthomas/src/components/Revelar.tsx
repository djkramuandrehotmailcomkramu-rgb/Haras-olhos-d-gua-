import { ReactNode } from 'react';
import { ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

/** Versão nativa: entrada simples (a revelação por rolagem fica na versão web). */
export function Revelar({ children, atraso = 0, style }: { children: ReactNode; atraso?: number; style?: ViewStyle }) {
  return <Animated.View entering={FadeInDown.delay(atraso).duration(350)} style={style}>{children}</Animated.View>;
}
