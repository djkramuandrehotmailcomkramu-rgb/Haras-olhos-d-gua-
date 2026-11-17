import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, StyleSheet, ViewStyle, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { fonte, raio, useTema } from '../theme';

type Props = {
  titulo: string;
  onPress?: () => void;
  icone?: ReactNode;
  variante?: 'primario' | 'suave' | 'fantasma' | 'perigo';
  tamanho?: 'm' | 'g';
  style?: ViewStyle;
  desabilitado?: boolean;
  carregando?: boolean;
};

const AnimadoPressable = Animated.createAnimatedComponent(Pressable);

export function Botao({ titulo, onPress, icone, variante = 'primario', tamanho = 'm', style, desabilitado, carregando }: Props) {
  const t = useTema();
  const escala = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  const cores = {
    primario: { bg: t.primaria, fg: t.sobrePrimaria },
    suave: { bg: t.primariaSuave, fg: t.primariaTexto },
    fantasma: { bg: 'transparent', fg: t.primariaTexto },
    perigo: { bg: t.perigo, fg: t.sobrePerigo },
  }[variante];

  return (
    <AnimadoPressable
      disabled={desabilitado || carregando}
      onPressIn={() => { escala.value = withSpring(0.96, { damping: 18, stiffness: 400 }); }}
      onPressOut={() => { escala.value = withSpring(1, { damping: 14, stiffness: 300 }); }}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
      style={[
        s.base,
        { backgroundColor: cores.bg, height: tamanho === 'g' ? 56 : 46, opacity: desabilitado ? 0.45 : 1 },
        variante === 'primario' && s.sombra,
        anim,
        style,
      ]}
    >
      {carregando ? <ActivityIndicator color={cores.fg} style={{ marginRight: 8 }} /> : icone ? <View style={{ marginRight: 8 }}>{icone}</View> : null}
      <Text style={[s.txt, { color: cores.fg, fontSize: tamanho === 'g' ? 17 : 15.5 }]}>{titulo}</Text>
    </AnimadoPressable>
  );
}

const s = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: raio.pilula, paddingHorizontal: 22 },
  txt: { fontFamily: fonte.semi, letterSpacing: -0.2 },
  sombra: { shadowColor: '#1F7A3E', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
});
