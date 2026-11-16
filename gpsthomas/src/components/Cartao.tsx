import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { raio, useTema } from '../theme';

export function Cartao({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTema();
  return (
    <View
      style={[
        { backgroundColor: t.cartao, borderRadius: raio.lg, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
        style,
      ]}
    >
      {children}
    </View>
  );
}
