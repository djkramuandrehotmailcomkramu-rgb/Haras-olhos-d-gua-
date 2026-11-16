import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import type { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
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

function Aba({ foco, nome, rotulo, onPress }: { foco: boolean; nome: string; rotulo: string; onPress: () => void }) {
  const t = useTema();
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(foco ? 1.08 : 1, { damping: 14, stiffness: 260 }) }],
  }));
  const [fora, dentro] = ICONES[nome] ?? ICONES.index;
  return (
    <Pressable onPress={onPress} style={s.aba}>
      <Animated.View style={[s.pilula, foco && { backgroundColor: t.primariaSuave }, anim]}>
        <Ionicons name={foco ? dentro : fora} size={23} color={foco ? t.primaria : t.textoSuave} />
        <Text style={[s.rot, { color: foco ? t.primaria : t.textoSuave }]}>{rotulo}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function BarraAbas({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const ins = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[s.raiz, { bottom: Math.max(ins.bottom, 12) }]}>
      <Vidro raioBorda={raio.xl} style={{ width: '100%' }}>
        <View style={s.linha}>
          {state.routes.map((rota, i) => {
            const foco = state.index === i;
            const rotulo = (descriptors[rota.key].options.title ?? rota.name) as string;
            return (
              <Aba
                key={rota.key}
                foco={foco}
                nome={rota.name}
                rotulo={rotulo}
                onPress={() => {
                  Haptics.selectionAsync();
                  const ev = emitter.emit({ type: 'tabPress', target: rota.key, canPreventDefault: true });
                  if (!foco && !ev.defaultPrevented) navigateToTab(rota.key);
                }}
              />
            );
          })}
        </View>
      </Vidro>
    </View>
  );
}

const s = StyleSheet.create({
  raiz: { position: 'absolute', left: 16, right: 16 },
  linha: { flexDirection: 'row', padding: 6 },
  aba: { flex: 1, alignItems: 'center' },
  pilula: { alignItems: 'center', paddingVertical: 7, paddingHorizontal: 14, borderRadius: raio.lg, gap: 2 },
  rot: { fontFamily: fonte.semi, fontSize: 11 },
});
