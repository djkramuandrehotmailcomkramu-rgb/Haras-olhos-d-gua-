import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import type { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, useDerivedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Vidro } from './Vidro';
import { fonte, raio, useTema } from '../theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONES: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['map-outline', 'map'],
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
  const larguraAba = largura > 0 ? (largura - PAD * 2) / n : 0;

  const alvo = useSharedValue(state.index);
  alvo.value = state.index;
  const pos = useDerivedValue(() => withSpring(alvo.value, { damping: 20, stiffness: 240, mass: 0.8 }));
  const indicador = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value * larguraAba }] }));

  return (
    <View pointerEvents="box-none" style={[s.raiz, { bottom: Math.max(ins.bottom, 12) }]}>
      <Vidro raioBorda={raio.xl} style={{ width: '100%' }}>
        <View style={s.linha} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
          {larguraAba > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[{ position: 'absolute', left: PAD, top: PAD, bottom: PAD, width: larguraAba, borderRadius: raio.lg, backgroundColor: t.primariaSuave }, indicador]}
            />
          )}
          {state.routes.map((rota, i) => {
            const foco = state.index === i;
            const rotulo = (descriptors[rota.key].options.title ?? rota.name) as string;
            const [fora, dentro] = ICONES[rota.name] ?? ICONES.index;
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
                <Ionicons name={foco ? dentro : fora} size={23} color={foco ? t.primaria : t.textoSuave} />
                <Text style={[s.rot, { color: foco ? t.primaria : t.textoSuave }]}>{rotulo}</Text>
              </Pressable>
            );
          })}
        </View>
      </Vidro>
    </View>
  );
}

const s = StyleSheet.create({
  raiz: { position: 'absolute', left: 16, right: 16 },
  linha: { flexDirection: 'row', padding: PAD },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  rot: { fontFamily: fonte.semi, fontSize: 11 },
});
