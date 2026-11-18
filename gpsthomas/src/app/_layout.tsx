import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Toast } from '../components/Toast';
import { Onboarding } from '../components/Onboarding';
import { ErroGlobal } from '../components/ErroGlobal';
import { AvisoSistema } from '../components/AvisoSistema';
import { paletas } from '../theme';

export default function RaizLayout() {
  const escuro = useColorScheme() === 'dark';
  const cor = (escuro ? paletas.escuro : paletas.claro).fundo;
  // Na web as fontes vêm do CSS (leves, woff2) e a tela não espera por elas; no celular carrega pelo expo-font.
  const [fontesProntas] = useFonts(Platform.OS === 'web' ? {} : { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const el = document.getElementById('gt-splash');
    // a abertura fica pelo menos ~0,9 s para a animação ser vista (e desaparece rápido se o app demorou)
    const faltam = Math.max(0, 900 - (typeof performance !== 'undefined' ? performance.now() : 900));
    const h1 = setTimeout(() => {
      document.documentElement.classList.add('gt-pronto');
      el?.classList.add('saindo');
    }, faltam);
    const h2 = setTimeout(() => el?.remove(), faltam + 560);
    return () => { clearTimeout(h1); clearTimeout(h2); };
  }, []);
  if (!fontesProntas) return null;

  return (
    <ErroGlobal>
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: cor }}>
      <StatusBar style={escuro ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 260, contentStyle: { backgroundColor: cor } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="talhao/[id]" options={{ animation: 'slide_from_bottom', animationDuration: 320 }} />
        <Stack.Screen name="campo/[id]" options={{ animation: 'slide_from_bottom', animationDuration: 320 }} />
        <Stack.Screen name="campo/novo" options={{ animation: 'slide_from_bottom', animationDuration: 320 }} />
        <Stack.Screen name="ajuda" options={{ animation: 'slide_from_right', animationDuration: 300 }} />
      </Stack>
      <Toast />
      <AvisoSistema />
      <Onboarding />
    </GestureHandlerRootView>
    </ErroGlobal>
  );
}
