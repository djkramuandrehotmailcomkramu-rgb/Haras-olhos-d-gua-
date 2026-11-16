import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { raio, useTema } from '../theme';

/** Painel de vidro fosco (blur) usado em barras e cartões flutuantes. */
export function Vidro({ children, style, raioBorda = raio.lg }: { children: ReactNode; style?: ViewStyle; raioBorda?: number }) {
  const t = useTema();
  return (
    <View style={[{ borderRadius: raioBorda, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: t.linha }, style]}>
      <BlurView intensity={55} tint={t.vidro} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.vidroCor }]} />
      {children}
    </View>
  );
}
