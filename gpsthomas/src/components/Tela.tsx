import { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tipo, useTema } from '../theme';

/** Tela com título grande estilo iOS e entrada animada. */
export function Tela({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  const t = useTema();
  const ins = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.fundo }}
      contentContainerStyle={{ paddingTop: ins.top + 18, paddingBottom: 130, paddingHorizontal: 18, gap: 14 }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(380)}>
        <Text style={[tipo.tituloGrande, { color: t.texto }]}>{titulo}</Text>
        {subtitulo ? <Text style={[tipo.corpo, { color: t.textoSuave, marginTop: 2 }]}>{subtitulo}</Text> : null}
      </Animated.View>
      <View style={{ gap: 14 }}>{children}</View>
    </ScrollView>
  );
}
