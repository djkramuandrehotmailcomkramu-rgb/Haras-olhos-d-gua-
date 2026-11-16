import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { paletas } from '../theme';

export default function RaizLayout() {
  const escuro = useColorScheme() === 'dark';
  const [fontesProntas] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!fontesProntas) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: (escuro ? paletas.escuro : paletas.claro).fundo }}>
      <StatusBar style={escuro ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: (escuro ? paletas.escuro : paletas.claro).fundo } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="talhao/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
