import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../store/toast';
import { Vidro } from './Vidro';
import { fonte, useTema } from '../theme';

export function Toast() {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const { msg, tipo, id, esconder } = useToast();
  useEffect(() => {
    if (!msg) return;
    const h = setTimeout(esconder, 3200);
    return () => clearTimeout(h);
  }, [id]);
  if (!msg) return null;
  const cor = tipo === 'ok' ? t.ok : tipo === 'erro' ? t.perigo : t.gps;
  const icone = tipo === 'ok' ? 'checkmark-circle' : tipo === 'erro' ? 'alert-circle' : 'information-circle';
  return (
    <Animated.View key={id} entering={FadeInDown.duration(260)} exiting={FadeOutUp.duration(200)} pointerEvents="none" style={{ position: 'absolute', top: ins.top + 10, left: 16, right: 16, zIndex: 100, alignItems: 'center' }}>
      <Vidro raioBorda={22}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16 }}>
          <Ionicons name={icone} size={22} color={cor} />
          <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.texto, flexShrink: 1 }}>{msg}</Text>
        </View>
      </Vidro>
    </Animated.View>
  );
}
