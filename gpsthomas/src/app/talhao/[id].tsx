import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MapaCampo } from '../../components/MapaCampo';
import { Cartao } from '../../components/Cartao';
import { Botao } from '../../components/Botao';
import { talhoes } from '../../dados/exemplo';
import { areaM2, perimetroM } from '../../geo/medidas';
import { formatarArea, formatarDistancia, ROTULO_AREA, converterArea, type UnidadeArea } from '../../geo/unidades';
import { fonte, tipo, useTema } from '../../theme';

const TODAS: UnidadeArea[] = ['ha', 'alqPaulista', 'alqMineiro', 'alqGoiano', 'alqBaiano', 'm2'];

export default function TalhaoDetalhe() {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const x = talhoes.find((z) => z.id === id);
  if (!x) return null;
  const m2 = areaM2(x.contorno);

  return (
    <View style={{ flex: 1, backgroundColor: t.fundo }}>
      <View style={{ height: 300 + ins.top }}>
        <MapaCampo largura={width} altura={300 + ins.top} poligonos={[{ id: x.id, pontos: x.contorno, destaque: true }]} margem={50} />
        <Pressable
          onPress={() => router.back()}
          style={{ position: 'absolute', top: ins.top + 10, left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: t.cartao, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={24} color={t.texto} />
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.duration(380)} style={{ flex: 1, marginTop: -26, backgroundColor: t.fundo, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, gap: 14 }}>
        <View>
          <Text style={[tipo.titulo, { color: t.texto }]}>{x.nome}</Text>
          <Text style={[tipo.corpo, { color: t.textoSuave }]}>{x.fazenda} · {x.cultura} {x.safra}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Cartao style={{ flex: 1 }}>
            <Text style={[tipo.legenda, { color: t.textoSuave }]}>ÁREA</Text>
            <Text style={{ fontFamily: fonte.negrito, fontSize: 24, color: t.primaria, marginTop: 4 }}>{formatarArea(m2, 'ha')}</Text>
          </Cartao>
          <Cartao style={{ flex: 1 }}>
            <Text style={[tipo.legenda, { color: t.textoSuave }]}>PERÍMETRO</Text>
            <Text style={{ fontFamily: fonte.negrito, fontSize: 24, color: t.texto, marginTop: 4 }}>{formatarDistancia(perimetroM(x.contorno))}</Text>
          </Cartao>
        </View>
        <Cartao style={{ gap: 8 }}>
          <Text style={[tipo.legenda, { color: t.textoSuave }]}>EM OUTRAS UNIDADES</Text>
          {TODAS.filter((u) => u !== 'ha').map((u) => (
            <View key={u} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[tipo.corpo, { color: t.textoSuave }]}>{ROTULO_AREA[u]}</Text>
              <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.texto }}>
                {converterArea(m2, u).toLocaleString('pt-BR', { maximumFractionDigits: u === 'm2' ? 0 : 2, minimumFractionDigits: u === 'm2' ? 0 : 2 })}
              </Text>
            </View>
          ))}
        </Cartao>
        <Botao titulo="Voltar" variante="suave" onPress={() => router.back()} />
      </Animated.View>
    </View>
  );
}
