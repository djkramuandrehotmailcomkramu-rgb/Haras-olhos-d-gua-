import { useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapaCampo } from '../../components/MapaCampo';
import { Vidro } from '../../components/Vidro';
import { Botao } from '../../components/Botao';
import { talhoes } from '../../dados/exemplo';
import { areaM2, perimetroM } from '../../geo/medidas';
import { formatarArea, formatarDistancia } from '../../geo/unidades';
import { usePrefs } from '../../store/prefs';
import { fonte, tipo, useTema } from '../../theme';

export default function MapaTela() {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const unidade = usePrefs((s) => s.unidadeArea);
  const [sel, setSel] = useState(talhoes[0].id);
  const atual = talhoes.find((x) => x.id === sel)!;

  return (
    <View style={{ flex: 1, backgroundColor: t.fundo }}>
      <MapaCampo
        largura={width}
        altura={height}
        margem={70}
        poligonos={talhoes.map((x) => ({ id: x.id, pontos: x.contorno, destaque: x.id === sel }))}
      />

      <Animated.View entering={FadeInUp.duration(400)} style={{ position: 'absolute', top: ins.top + 12, left: 16, right: 16 }}>
        <Vidro>
          <View style={{ padding: 16 }}>
            <Text style={[tipo.legenda, { color: t.textoSuave }]}>{atual.fazenda.toUpperCase()}</Text>
            <Text style={[tipo.subtitulo, { color: t.texto, marginTop: 2 }]}>{atual.nome}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 18, marginTop: 10 }}>
              <View>
                <Text style={[tipo.numeroGrande, { color: t.primaria }]}>{formatarArea(areaM2(atual.contorno), unidade).split(' ')[0]}</Text>
                <Text style={[tipo.legenda, { color: t.textoSuave }]}>{formatarArea(areaM2(atual.contorno), unidade).split(' ').slice(1).join(' ')}</Text>
              </View>
              <View style={{ paddingBottom: 6 }}>
                <Text style={{ fontFamily: fonte.semi, fontSize: 17, color: t.texto }}>{formatarDistancia(perimetroM(atual.contorno))}</Text>
                <Text style={[tipo.legenda, { color: t.textoSuave }]}>perímetro</Text>
              </View>
            </View>
          </View>
        </Vidro>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(120).duration(400)} style={{ position: 'absolute', left: 16, right: 16, bottom: ins.bottom + 104, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {talhoes.map((x) => (
            <Botao key={x.id} titulo={`T${x.id}`} variante={x.id === sel ? 'primario' : 'suave'} onPress={() => setSel(x.id)} style={{ flex: 1 }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Botao titulo="Caminhar" tamanho="g" icone={<Ionicons name="walk" size={20} color={t.sobrePrimaria} />} style={{ flex: 1 }} />
          <Botao titulo="Marcar" tamanho="g" variante="suave" icone={<Ionicons name="pin" size={19} color={t.primaria} />} style={{ flex: 1 }} />
        </View>
      </Animated.View>
    </View>
  );
}
