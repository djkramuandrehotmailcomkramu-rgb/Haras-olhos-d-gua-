import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSistema } from '../store/sistema';
import { usePrefs } from '../store/prefs';
import { useToast } from '../store/toast';
import { INSTRUCAO_INSTALAR, emStandalone, emTelaCheia, instalarApp } from '../nav/tela';
import { Vidro } from './Vidro';
import { fonte, useTema } from '../theme';

/** Avisos de sistema: nova versão do app, sem internet. */
export function AvisoSistema() {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const { novaVersao, offline, instalado, podeInstalar, definir } = useSistema();
  const { avisoInstalarFechado, fecharAvisoInstalar, onboardingVisto } = usePrefs();
  const mostrar = useToast((x) => x.mostrar);
  const [atrasoOk, setAtrasoOk] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const nova = () => definir({ novaVersao: true });
    const fora = () => definir({ offline: true });
    const dentro = () => definir({ offline: false });
    const pode = () => definir({ podeInstalar: true });
    const instalou = () => definir({ instalado: true, podeInstalar: false });
    const tela = () => definir({ telaCheia: emTelaCheia() });
    window.addEventListener('gt-pode-instalar', pode);
    window.addEventListener('gt-instalado', instalou);
    document.addEventListener('fullscreenchange', tela);
    definir({ instalado: emStandalone(), podeInstalar: !!(window as any).__gtInstalar, telaCheia: emTelaCheia() });
    const atraso = setTimeout(() => setAtrasoOk(true), 5000);
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
      window.removeEventListener('gt-pode-instalar', pode);
      window.removeEventListener('gt-instalado', instalou);
      document.removeEventListener('fullscreenchange', tela);
      clearTimeout(atraso);
    };
  }, []);

  const atualizar = () => {
    const reg = (window as any).__gtReg as ServiceWorkerRegistration | undefined;
    (window as any).__gtAtualizando = true;
    if (reg?.waiting) reg.waiting.postMessage('SKIP_WAITING');
    else window.location.reload();
  };

  const mostrarInstalar = !novaVersao && !offline && !instalado && !avisoInstalarFechado && onboardingVisto && atrasoOk;
  if (!novaVersao && !offline && !mostrarInstalar) return null;

  const instalar = async () => {
    const r = await instalarApp();
    if (r === 'aceito') { mostrar('Instalando… abra o app pelo ícone novo na tela inicial.', 'ok'); fecharAvisoInstalar(); }
    else if (r === 'indisponivel') mostrar(INSTRUCAO_INSTALAR, 'info');
  };

  return (
    <Animated.View entering={FadeInUp.duration(250)} exiting={FadeOutUp.duration(180)} pointerEvents="box-none" style={{ position: 'absolute', top: ins.top + 6, left: 14, right: 14, zIndex: 150, alignItems: 'center' }}>
      <Vidro raioBorda={22}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 14, paddingRight: 10 }}>
          <Ionicons name={novaVersao ? 'sparkles' : offline ? 'cloud-offline' : 'phone-portrait'} size={20} color={novaVersao ? t.primaria : t.atencao} />
          <Text style={{ fontFamily: fonte.semi, fontSize: 14, color: t.texto, flexShrink: 1 }}>
            {novaVersao ? 'Nova versão disponível' : offline ? 'Sem internet: mapas já vistos funcionam; busca e rotas não.' : 'Instale o app para tirar a barra verde e usar a tela inteira.'}
          </Text>
          {novaVersao && (
            <Pressable onPress={atualizar} accessibilityRole="button" accessibilityLabel="Atualizar o aplicativo" style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: t.primaria, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonte.semi, fontSize: 13.5, color: t.sobrePrimaria }}>Atualizar</Text>
            </Pressable>
          )}
          {mostrarInstalar && (
            <>
              <Pressable onPress={instalar} accessibilityRole="button" accessibilityLabel={podeInstalar ? 'Instalar o aplicativo' : 'Como instalar o aplicativo'} style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: t.primaria, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonte.semi, fontSize: 13.5, color: t.sobrePrimaria }}>{podeInstalar ? 'Instalar' : 'Como?'}</Text>
              </Pressable>
              <Pressable onPress={fecharAvisoInstalar} accessibilityRole="button" accessibilityLabel="Dispensar aviso" hitSlop={10} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={18} color={t.textoSuave} />
              </Pressable>
            </>
          )}
        </View>
      </Vidro>
    </Animated.View>
  );
}
