import { ReactNode, useEffect, useMemo } from 'react';
import { PanResponder, Pressable, Text, View, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Vidro } from './Vidro';
import { fonte, raio, useTema } from '../theme';

/** Painel que desce (some) com mola quando recolhido, deixando o mapa livre. */
export function Recolhivel({ recolhido, de = 'baixo', children, style }: { recolhido: boolean; de?: 'baixo' | 'cima'; children: ReactNode; style?: ViewStyle }) {
  const p = useSharedValue(recolhido ? 1 : 0);
  useEffect(() => { p.value = withSpring(recolhido ? 1 : 0, { damping: 21, stiffness: 210, mass: 0.9 }); }, [recolhido]);
  const st = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [{ translateY: (de === 'baixo' ? 1 : -1) * p.value * 280 }, { scale: 1 - p.value * 0.04 }],
  }));
  return <Animated.View pointerEvents={recolhido ? 'none' : 'box-none'} style={[style, st]}>{children}</Animated.View>;
}

/** Alça no topo do painel: arraste para baixo (ou toque) para recolher. */
export function AlcaRecolher({ onRecolher }: { onRecolher: () => void }) {
  const t = useTema();
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
        onPanResponderRelease: (_, g) => {
          if (g.dy > 18 || (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6)) { Haptics.selectionAsync(); onRecolher(); }
        },
      }),
    [onRecolher],
  );
  return (
    <View {...pan.panHandlers} accessibilityRole="button" accessibilityLabel="Recolher painel" style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 6, cursor: 'pointer' } as any}>
      <View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: t.linha }} />
      <Ionicons name="chevron-down" size={16} color={t.textoSuave} style={{ marginTop: 2 }} />
    </View>
  );
}

/** Pílula flutuante que traz o painel de volta. */
export function PilulaMostrar({ visivel, rotulo, onPress, icone = 'chevron-up' }: { visivel: boolean; rotulo: string; onPress: () => void; icone?: keyof typeof Ionicons.glyphMap }) {
  const t = useTema();
  const ins = useSafeAreaInsets();
  if (!visivel) return null;
  return (
    <Animated.View entering={FadeIn.delay(120).duration(220)} exiting={FadeOut.duration(120)} style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(ins.bottom, 12) + 14, alignItems: 'center', zIndex: 20 }} pointerEvents="box-none">
      <Pressable onPress={() => { Haptics.selectionAsync(); onPress(); }} accessibilityRole="button" accessibilityLabel={rotulo}>
        <Vidro raioBorda={raio.pilula}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, height: 46 }}>
            <Ionicons name={icone} size={18} color={t.primaria} />
            <Text style={{ fontFamily: fonte.semi, fontSize: 14.5, color: t.texto }}>{rotulo}</Text>
          </View>
        </Vidro>
      </Pressable>
    </Animated.View>
  );
}
