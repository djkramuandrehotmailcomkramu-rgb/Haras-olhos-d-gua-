import { Tabs } from 'expo-router';
import { BarraAbas } from '../../components/BarraAbas';

export default function AbasLayout() {
  return (
    <Tabs tabBar={(p) => <BarraAbas {...p} />} screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Tabs.Screen name="index" options={{ title: 'Mapa' }} />
      <Tabs.Screen name="talhoes" options={{ title: 'Talhões' }} />
      <Tabs.Screen name="medicoes" options={{ title: 'Medições' }} />
      <Tabs.Screen name="mais" options={{ title: 'Mais' }} />
    </Tabs>
  );
}
