import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Toast } from '../components/Toast';
import { Onboarding } from '../components/Onboarding';
import { paletas } from '../theme';

export default function RaizLayout() {
  const escuro = useColorScheme() === 'dark';
  const cor = (escuro ? paletas.escuro : paletas.claro).fundo;
  const [fontesProntas] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!fontesProntas) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: cor }}>
      <StatusBar style={escuro ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 260, contentStyle: { backgroundColor: cor } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="talhao/[id]" options={{ animation: 'slide_from_bottom', animationDuration: 320 }} />
      </Stack>
      <Toast />
      <Onboarding />
    </GestureHandlerRootView>
  );
}
