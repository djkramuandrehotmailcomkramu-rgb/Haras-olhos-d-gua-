import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { raio, useTema } from '../theme';

/** Cartão no estilo "lista agrupada" do iOS: fundo branco, cantos suaves e fio fino (sem sombra pesada). */
export function Cartao({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTema();
  return (
    <View style={[{ backgroundColor: t.cartao, borderRadius: raio.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: t.linha }, style]}>
      {children}
    </View>
  );
}
