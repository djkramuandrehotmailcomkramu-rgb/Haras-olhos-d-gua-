import { useEffect } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSistema } from '../store/sistema';
import { Vidro } from './Vidro';
import { fonte, useTema } from '../theme';

/** Avisos de sistema: nova versão do app, sem internet. */
export function AvisoSistema() {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const { novaVersao, offline, definir } = useSistema();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const nova = () => definir({ novaVersao: true });
    const fora = () => definir({ offline: true });
    const dentro = () => definir({ offline: false });
    window.addEventListener('gt-nova-versao', nova);
    window.addEventListener('offline', fora);
    window.addEventListener('online', dentro);
    definir({ offline: !navigator.onLine });
    if ((window as any).__gtReg?.waiting && navigator.serviceWorker?.controller) nova();
    // pede armazenamento persistente para o navegador não apagar os dados salvos
    navigator.storage?.persist?.().then((ok: boolean) => definir({ armazenamentoPersistente: ok })).catch(() => definir({ armazenamentoPersistente: false }));
    return () => {
      window.removeEventListener('gt-nova-versao', nova);
      window.removeEventListener('offline', fora);
      window.removeEventListener('online', dentro);
    };
  }, []);

  const atualizar = () => {
    const reg = (window as any).__gtReg as ServiceWorkerRegistration | undefined;
    (window as any).__gtAtualizando = true;
    if (reg?.waiting) reg.waiting.postMessage('SKIP_WAITING');
    else window.location.reload();
  };

  if (!novaVersao && !offline) return null;
  return (
    <Animated.View entering={FadeInUp.duration(250)} exiting={FadeOutUp.duration(180)} pointerEvents="box-none" style={{ position: 'absolute', top: ins.top + 6, left: 14, right: 14, zIndex: 150, alignItems: 'center' }}>
      <Vidro raioBorda={22}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 14, paddingRight: 10 }}>
          <Ionicons name={novaVersao ? 'sparkles' : 'cloud-offline'} size={20} color={novaVersao ? t.primaria : t.atencao} />
          <Text style={{ fontFamily: fonte.semi, fontSize: 14, color: t.texto, flexShrink: 1 }}>
            {novaVersao ? 'Nova versão disponível' : 'Sem internet: mapas já vistos funcionam; busca e rotas não.'}
          </Text>
          {novaVersao && (
            <Pressable onPress={atualizar} accessibilityRole="button" accessibilityLabel="Atualizar o aplicativo" style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: t.primaria, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonte.semi, fontSize: 13.5, color: t.sobrePrimaria }}>Atualizar</Text>
            </Pressable>
          )}
        </View>
      </Vidro>
    </Animated.View>
  );
}
