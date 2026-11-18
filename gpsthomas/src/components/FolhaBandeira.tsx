import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Botao } from './Botao';
import { formatarNumeroBR } from '../geo/numero';
import { fonte, tipo, useTema } from '../theme';

const ALTURA = Dimensions.get('window').height;

type Props = {
  visivel: boolean;
  rotulo: string;
  colocada: boolean;
  /** distância (m) até você, se o GPS já respondeu */
  distanciaM: number | null;
  ehAlvo: boolean;
  onGuiar: () => void;
  onRota: () => void;
  onAlternar: () => void;
  onFechar: () => void;
};

/** Folha de ações ao tocar numa bandeirinha. */
export function FolhaBandeira({ visivel, rotulo, colocada, distanciaM, ehAlvo, onGuiar, onRota, onAlternar, onFechar }: Props) {
  const t = useTema();
  const [montada, setMontada] = useState(false);
  const ty = useSharedValue(ALTURA);
  const fundo = useSharedValue(0);

  useEffect(() => {
    if (visivel) {
      setMontada(true);
      ty.value = ALTURA;
      ty.value = withSpring(0, { damping: 22, stiffness: 230, mass: 0.9 });
      fundo.value = withTiming(1, { duration: 200 });
    } else if (montada) {
      ty.value = withTiming(ALTURA, { duration: 220, easing: Easing.in(Easing.cubic) });
      fundo.value = withTiming(0, { duration: 200 });
      const h = setTimeout(() => setMontada(false), 230);
      return () => clearTimeout(h);
    }
  }, [visivel]);

  const eFolha = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const eFundo = useAnimatedStyle(() => ({ opacity: fundo.value }));
  const dist = distanciaM == null ? 'Ative o GPS para ver a distância' : distanciaM >= 1000 ? `${formatarNumeroBR(distanciaM / 1000)} km de você` : `${Math.round(distanciaM)} m de você`;

  return (
    <Modal visible={montada} transparent animationType="none" onRequestClose={onFechar}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }, eFundo]}>
          <Pressable onPress={onFechar} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View style={[{ backgroundColor: t.fundo, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12, gap: 14 }, eFolha]}>
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: t.linha }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colocada ? t.primariaSuave : 'rgba(242,183,61,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="flag-outline" size={22} color={colocada ? t.ok : t.atencao} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={[tipo.subtitulo, { color: t.texto }]}>{rotulo}</Text>
              <Text style={[tipo.legenda, { color: t.textoSuave }]}>{colocada ? 'Já colocada' : 'Pendente'} · {dist}</Text>
            </View>
          </View>
          {!colocada && (
            <Botao titulo={ehAlvo ? 'Continuar guiando até esta' : 'Guiar até esta bandeira'} tamanho="g" icone={<Ionicons name="walk-outline" size={20} color={t.sobrePrimaria} />} onPress={onGuiar} />
          )}
          <Botao titulo="Rota por estrada até aqui" variante="suave" icone={<Ionicons name="car-outline" size={19} color={t.primaria} />} onPress={onRota} />
          <Botao titulo={colocada ? 'Marcar como pendente' : 'Marcar como colocada'} variante="fantasma" onPress={onAlternar} />
          <Pressable onPress={onFechar} style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.textoSuave }}>Fechar</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}
