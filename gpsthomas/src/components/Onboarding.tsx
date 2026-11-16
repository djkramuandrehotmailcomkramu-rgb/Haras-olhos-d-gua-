import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOut, FadeOutLeft } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Botao } from './Botao';
import { Ilustracao } from './Ilustracao';
import { usePrefs } from '../store/prefs';
import { fonte, tipo, useTema } from '../theme';

const PASSOS: { icone: keyof typeof Ionicons.glyphMap; titulo: string; texto: string }[] = [
  { icone: 'walk', titulo: 'Meça caminhando ou no mapa', texto: 'Caminhe pelo contorno com o GPS gravando, ou toque no mapa de satélite para marcar os cantos. Arraste os pontos para ajustar.' },
  { icone: 'leaf', titulo: 'Salve como talhão', texto: 'Dê nome, fazenda, cultura e safra. A área aparece em hectare, alqueire (paulista, mineiro, goiano, baiano) ou m².' },
  { icone: 'navigate', titulo: 'Ative o GPS', texto: 'O navegador vai pedir permissão de localização. Toque em "Permitir" para ver sua posição e medir andando. Seus dados ficam só neste aparelho.' },
];

export function Onboarding() {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const { onboardingVisto, concluirOnboarding } = usePrefs();
  const [i, setI] = useState(0);
  if (onboardingVisto) return null;
  const ultimo = i === PASSOS.length - 1;
  const p = PASSOS[i];

  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(250)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: t.fundo, paddingTop: ins.top + 24, paddingBottom: Math.max(ins.bottom, 20) + 8, paddingHorizontal: 24 }}>
      <View style={{ alignItems: 'flex-end', height: 36 }}>
        {!ultimo && (
          <Pressable onPress={concluirOnboarding} hitSlop={12}>
            <Text style={{ fontFamily: fonte.semi, fontSize: 16, color: t.textoSuave }}>Pular</Text>
          </Pressable>
        )}
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <Animated.View key={i} entering={FadeInRight.duration(340)} exiting={FadeOutLeft.duration(200)} style={{ alignItems: 'center', gap: 22 }}>
          {i === 0 ? <Ilustracao tamanho={220} /> : (
            <View style={{ width: 132, height: 132, borderRadius: 40, backgroundColor: t.primariaSuave, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={p.icone} size={64} color={t.primaria} />
            </View>
          )}
          <Text style={[tipo.tituloGrande, { color: t.texto, textAlign: 'center', fontSize: 28 }]}>{p.titulo}</Text>
          <Text style={[tipo.corpo, { color: t.textoSuave, textAlign: 'center', fontSize: 16, lineHeight: 23, maxWidth: 340 }]}>{p.texto}</Text>
        </Animated.View>
      </View>

      <View style={{ gap: 20, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {PASSOS.map((_, k) => (
            <View key={k} style={{ width: k === i ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? t.primaria : t.linha }} />
          ))}
        </View>
        <Botao titulo={ultimo ? 'Começar' : 'Continuar'} tamanho="g" onPress={() => (ultimo ? concluirOnboarding() : setI(i + 1))} style={{ alignSelf: 'stretch' }} />
      </View>
    </Animated.View>
  );
}
