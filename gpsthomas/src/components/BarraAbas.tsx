import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import type { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, useDerivedValue } from 'react-native-reanimated';
import { useEffect } from 'react';
import { usePrefs } from '../store/prefs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Vidro } from './Vidro';
import { fonte, raio, useTema } from '../theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONES: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['map-outline', 'map'],
  rotas: ['navigate-circle-outline', 'navigate-circle'],
  talhoes: ['leaf-outline', 'leaf'],
  medicoes: ['analytics-outline', 'analytics'],
  mais: ['ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle'],
};

const PAD = 6;

export function BarraAbas({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const [largura, setLargura] = useState(0);
  const n = state.routes.length;
  const rotaAtual = state.routes[state.index]?.name;
  const noMapa = rotaAtual === 'index' || rotaAtual === 'rotas';
  const esconder = usePrefs((x) => x.painelRecolhido) && noMapa;
  const oculta = useSharedValue(esconder ? 1 : 0);
  useEffect(() => { oculta.value = withSpring(esconder ? 1 : 0, { damping: 21, stiffness: 210, mass: 0.9 }); }, [esconder]);
  const estiloOculta = useAnimatedStyle(() => ({ opacity: 1 - oculta.value, transform: [{ translateY: oculta.value * 140 }] }));
  const larguraAba = largura > 0 ? (largura - PAD * 2) / n : 0;

  const alvo = useSharedValue(state.index);
  alvo.value = state.index;
  const pos = useDerivedValue(() => withSpring(alvo.value, { damping: 22, stiffness: 190, mass: 0.9 }));
  const indicador = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value * larguraAba }] }));

  return (
    <Animated.View pointerEvents={esconder ? 'none' : 'box-none'} style={[s.raiz, { bottom: Math.max(ins.bottom, 12) }, estiloOculta]}>
      <Vidro raioBorda={raio.xl} style={{ width: '100%' }}>
        <View role="tablist" accessibilityRole="tablist" style={s.linha} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
          {larguraAba > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[{ position: 'absolute', left: PAD, top: PAD, bottom: PAD, width: larguraAba, borderRadius: raio.lg, backgroundColor: t.primariaSuave }, indicador]}
            />
          )}
          {state.routes.map((rota, i) => {
            const foco = state.index === i;
            const rotulo = (descriptors[rota.key].options.title ?? rota.name) as string;
            const [fora] = ICONES[rota.name] ?? ICONES.index;
            return (
              <Pressable
                key={rota.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: foco }}
                accessibilityLabel={rotulo}
                style={s.aba}
                onPress={() => {
                  Haptics.selectionAsync();
                  const ev = emitter.emit({ type: 'tabPress', target: rota.key, canPreventDefault: true });
                  if (!foco && !ev.defaultPrevented) navigateToTab(rota.key);
                }}
              >
                <Ionicons name={fora} size={22} color={foco ? t.primariaTexto : t.textoSuave} />
                <Text style={[s.rot, { color: foco ? t.primariaTexto : t.textoSuave }]}>{rotulo}</Text>
              </Pressable>
            );
          })}
        </View>
      </Vidro>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  raiz: { position: 'absolute', left: 16, right: 16 },
  linha: { flexDirection: 'row', padding: PAD },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  rot: { fontFamily: fonte.media, fontSize: 10.5 },
});
