import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { raio, useTema } from '../theme';

export function Cartao({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTema();
  return (
    <View
      style={[
        { backgroundColor: t.cartao, borderRadius: raio.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: t.linha, shadowColor: '#000', shadowOpacity: 0.035, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
        style,
      ]}
    >
      {children}
    </View>
  );
}
