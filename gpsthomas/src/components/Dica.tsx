import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { fonte, raio, useTema } from '../theme';

/** Botão "?" que abre uma explicação curta logo abaixo, no próprio lugar. */
export function Dica({ texto }: { texto: string }) {
  const t = useTema();
  const [aberta, setAberta] = useState(false);
  return (
    <View style={{ position: 'relative', zIndex: aberta ? 60 : 1 }}>
      <Pressable onPress={() => setAberta((v) => !v)} accessibilityRole="button" accessibilityLabel={aberta ? 'Fechar explicação' : 'O que é isto?'} hitSlop={12} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: aberta ? t.primaria : t.cartaoSuave, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonte.negrito, fontSize: 12.5, color: aberta ? t.sobrePrimaria : t.textoSuave }}>?</Text>
      </Pressable>
      {aberta && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ position: 'absolute', top: 28, left: 0, width: 270, padding: 12, borderRadius: raio.md, backgroundColor: t.cartao, borderWidth: 1, borderColor: t.linha, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
          <Text style={{ fontFamily: fonte.regular, fontSize: 13.5, lineHeight: 19, color: t.texto }}>{texto}</Text>
        </Animated.View>
      )}
    </View>
  );
}
