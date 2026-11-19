import { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonte, tipo, useTema } from '../theme';

/** Página interna no estilo iOS: botão "Voltar" com seta, título grande e rolagem suave. */
export function Pagina({ titulo, subtitulo, children, voltar }: { titulo: string; subtitulo?: string; children: ReactNode; voltar?: () => void }) {
  const t = useTema();
  const ins = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.fundo }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 6, paddingBottom: 60, paddingHorizontal: 18, gap: 14 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable onPress={voltar ?? (() => router.back())} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, marginLeft: -6 }}>
          <Ionicons name="chevron-back" size={28} color={t.primaria} />
          <Text style={{ fontFamily: fonte.regular, fontSize: 17, color: t.primaria, marginLeft: -2 }}>Voltar</Text>
        </Pressable>
        <View>
          <Text style={[tipo.tituloGrande, { color: t.texto }]}>{titulo}</Text>
          {subtitulo ? <Text style={[tipo.corpo, { color: t.textoSuave, marginTop: 2 }]}>{subtitulo}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </View>
  );
}
