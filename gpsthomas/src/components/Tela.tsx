import { Children, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Vidro } from './Vidro';
import { Revelar } from './Revelar';
import { useEntradaFoco } from '../hooks/animacao';
import { fonte, tipo, useTema } from '../theme';

/** Tela com título grande estilo iOS que encolhe para uma barra de vidro ao rolar. */
export function Tela({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const entrada = useEntradaFoco();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });

  const grande = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, 60], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [0, 60], [0, -8], Extrapolation.CLAMP) }, { scale: interpolate(y.value, [-80, 0], [1.06, 1], Extrapolation.CLAMP) }],
  }));
  const barra = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [40, 80], [0, 1], Extrapolation.CLAMP) }));

  return (
    <View style={{ flex: 1, backgroundColor: t.fundo }}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={[{ flex: 1, overscrollBehaviorY: 'contain', scrollBehavior: 'smooth' } as any, entrada]}
        contentContainerStyle={{ paddingTop: ins.top + 18, paddingBottom: 130, paddingHorizontal: 18, gap: 14 }}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
      >
        <Animated.View style={[{ transformOrigin: 'left center' } as any, grande]}>
          <Text style={[tipo.tituloGrande, { color: t.texto }]}>{titulo}</Text>
          {subtitulo ? <Text style={[tipo.corpo, { color: t.textoSuave, marginTop: 2 }]}>{subtitulo}</Text> : null}
        </Animated.View>
        <View style={{ gap: 14 }}>
          {Children.toArray(children).map((c, i) => <Revelar key={(c as any)?.key ?? i} atraso={Math.min(i, 4) * 40}>{c}</Revelar>)}
        </View>
      </Animated.ScrollView>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { bottom: undefined, height: ins.top + 52 }, barra]}>
        <Vidro raioBorda={0} style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 12, borderWidth: 0 }}>
          <Text style={{ fontFamily: fonte.semi, fontSize: 17, color: t.texto }}>{titulo}</Text>
        </Vidro>
      </Animated.View>
    </View>
  );
}
