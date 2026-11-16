import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Tela } from '../../components/Tela';
import { Cartao } from '../../components/Cartao';
import { talhoes } from '../../dados/exemplo';
import { areaM2 } from '../../geo/medidas';
import { formatarArea } from '../../geo/unidades';
import { usePrefs } from '../../store/prefs';
import { fonte, tipo, useTema, raio } from '../../theme';

export default function TalhoesTela() {
  const t = useTema();
  const unidade = usePrefs((s) => s.unidadeArea);
  return (
    <Tela titulo="Talhões" subtitulo="Suas áreas medidas, por fazenda e safra">
      {talhoes.map((x, i) => (
        <Animated.View key={x.id} entering={FadeInDown.delay(80 + i * 70).duration(360)}>
          <Pressable onPress={() => router.push(`/talhao/${x.id}`)}>
            <Cartao style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: raio.md, backgroundColor: t.primariaSuave, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="leaf" size={24} color={t.primaria} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[tipo.subtitulo, { color: t.texto }]}>{x.nome}</Text>
                <Text style={[tipo.corpo, { color: t.textoSuave }]}>{x.fazenda} · {x.cultura} {x.safra}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: fonte.negrito, fontSize: 17, color: t.primaria }}>{formatarArea(areaM2(x.contorno), unidade)}</Text>
                <Ionicons name="chevron-forward" size={16} color={t.textoSuave} />
              </View>
            </Cartao>
          </Pressable>
        </Animated.View>
      ))}
    </Tela>
  );
}
