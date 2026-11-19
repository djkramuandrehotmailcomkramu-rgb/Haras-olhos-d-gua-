import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import type { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useEffect } from 'react';
import { usePrefs } from '../store/prefs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Vidro } from './Vidro';
import { fonte, useTema } from '../theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONES: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['map-outline', 'map'],
  rotas: ['navigate-circle-outline', 'navigate-circle'],
  talhoes: ['layers-outline', 'layers'],
  mais: ['ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle'],
};

/** Barra de abas no estilo do iPhone: faixa de vidro colada embaixo, ícone + nome, aba ativa na cor de destaque. */
export function BarraAbas({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const rotaAtual = state.routes[state.index]?.name;
  const noMapa = rotaAtual === 'index' || rotaAtual === 'rotas';
  const esconder = usePrefs((x) => x.painelRecolhido) && noMapa;
  const oculta = useSharedValue(esconder ? 1 : 0);
  useEffect(() => { oculta.value = withSpring(esconder ? 1 : 0, { damping: 21, stiffness: 210, mass: 0.9 }); }, [esconder]);
  const estiloOculta = useAnimatedStyle(() => ({ opacity: 1 - oculta.value, transform: [{ translateY: oculta.value * 160 }] }));

  const rotas = state.routes.filter((r) => (descriptors[r.key].options as any).href !== null && ICONES[r.name]);

  return (
    <Animated.View pointerEvents={esconder ? 'none' : 'box-none'} style={[s.raiz, estiloOculta]}>
      <Vidro raioBorda={0} style={{ borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth }}>
        <View role="tablist" accessibilityRole="tablist" style={{ flexDirection: 'row', paddingTop: 6, paddingBottom: Math.max(ins.bottom, 8) }}>
          {rotas.map((rota) => {
            const foco = state.routes[state.index]?.key === rota.key;
            const rotulo = (descriptors[rota.key].options.title ?? rota.name) as string;
            const [fora, dentro] = ICONES[rota.name];
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
                <Ionicons name={foco ? dentro : fora} size={26} color={foco ? t.primaria : t.textoSuave} />
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
  raiz: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  aba: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, gap: 2 },
  rot: { fontFamily: fonte.media, fontSize: 10.5, letterSpacing: 0.1 },
});
