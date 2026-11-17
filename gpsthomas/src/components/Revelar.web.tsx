import { ReactNode, useEffect, useRef } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

/** Aparece com fade, leve subida e escala quando entra na tela durante a rolagem (uma vez só). */
export function Revelar({ children, atraso = 0, style }: { children: ReactNode; atraso?: number; style?: ViewStyle }) {
  const ref = useRef<any>(null);
  const reduzir = useReducedMotion();
  const p = useSharedValue(reduzir ? 1 : 0);

  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (reduzir || !el || typeof IntersectionObserver === 'undefined') { p.value = 1; return; }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          p.value = withDelay(atraso, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
          io.disconnect();
        }
      },
      { threshold: 0.04, rootMargin: '0px 0px -5% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduzir]);

  const st = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 16 }, { scale: 0.985 + 0.015 * p.value }],
  }));

  return (
    <View ref={ref} style={style}>
      <Animated.View style={st}>{children}</Animated.View>
    </View>
  );
}
