import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, Alert, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MapaCampo } from '../../components/MapaCampo';
import { Cartao } from '../../components/Cartao';
import { Botao } from '../../components/Botao';
import { Campo } from '../../components/Campo';
import { Fichas } from '../../components/Fichas';
import { CULTURAS } from '../../components/FolhaSalvar';
import { useDados, useUi } from '../../store/dados';
import { areaM2, perimetroM } from '../../geo/medidas';
import { formatarArea, formatarDistancia, ROTULO_AREA, converterArea, type UnidadeArea } from '../../geo/unidades';
import { paraGeoJSON, paraKML, paraGPX } from '../../io/formatos';
import { entregarArquivo } from '../../io/arquivos';
import { useToast } from '../../store/toast';
import { fonte, tipo, useTema } from '../../theme';

const OUTRAS: UnidadeArea[] = ['alqPaulista', 'alqMineiro', 'alqGoiano', 'alqBaiano', 'm2'];

export default function TalhaoDetalhe() {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const x = useDados((s) => s.talhoes.find((z) => z.id === id));
  const { atualizarTalhao, removerTalhao } = useDados();
  const enviar = useUi((s) => s.enviar);
  const mostrar = useToast((s) => s.mostrar);
  const baixar = (n: string, c: string, m: string) => { entregarArquivo(n, c, m); mostrar('Arquivo exportado', 'ok'); };
  const [f, setF] = useState({ nome: '', fazenda: '', cultura: 'Soja', safra: '', obs: '' });
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (x) setF({ nome: x.nome, fazenda: x.fazenda, cultura: x.cultura, safra: x.safra, obs: x.obs ?? '' });
  }, [x?.id]);

  if (!x) {
    return (
      <View style={{ flex: 1, backgroundColor: t.fundo, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text style={[tipo.subtitulo, { color: t.texto }]}>Talhão não encontrado</Text>
        <Botao titulo="Voltar" onPress={() => router.back()} />
      </View>
    );
  }

  const m2 = areaM2(x.contorno);
  const apagar = () => {
    const ok = () => { removerTalhao(x.id); router.back(); };
    if (Platform.OS === 'web') { if (window.confirm(`Excluir "${x.nome}"?`)) ok(); }
    else Alert.alert('Excluir talhão', x.nome, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: ok }]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.fundo }} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={{ height: 260 + ins.top }}>
        <MapaCampo largura={width} altura={260 + ins.top} poligonos={[{ id: x.id, pontos: x.contorno, destaque: true }]} margem={50} />
        <Pressable onPress={() => router.back()} style={{ position: 'absolute', top: ins.top + 10, left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: t.cartao, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={t.texto} />
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.duration(380)} style={{ marginTop: -26, backgroundColor: t.fundo, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Cartao style={{ flex: 1 }}>
            <Text style={[tipo.legenda, { color: t.textoSuave }]}>ÁREA</Text>
            <Text numberOfLines={1} style={{ fontFamily: fonte.negrito, fontSize: formatarArea(m2, 'ha').length > 12 ? 17 : 24, color: t.primaria, marginTop: 4 }}>{formatarArea(m2, 'ha')}</Text>
          </Cartao>
          <Cartao style={{ flex: 1 }}>
            <Text style={[tipo.legenda, { color: t.textoSuave }]}>PERÍMETRO</Text>
            <Text numberOfLines={1} style={{ fontFamily: fonte.negrito, fontSize: 22, color: t.texto, marginTop: 4 }}>{formatarDistancia(perimetroM(x.contorno))}</Text>
          </Cartao>
        </View>

        <Botao titulo="Ver no mapa de satélite" tamanho="g" icone={<Ionicons name="map" size={20} color={t.sobrePrimaria} />} onPress={() => { enviar({ tipo: 'ajustar', pontos: x.contorno }); router.navigate('/'); }} />

        <Cartao style={{ gap: 12 }}>
          <Text style={[tipo.subtitulo, { color: t.texto }]}>Dados do talhão</Text>
          <Campo rotulo="Nome" value={f.nome} onChangeText={(v) => { setF({ ...f, nome: v }); setSalvo(false); }} />
          <Campo rotulo="Fazenda" value={f.fazenda} onChangeText={(v) => { setF({ ...f, fazenda: v }); setSalvo(false); }} />
          <Text style={[tipo.legenda, { color: t.textoSuave }]}>CULTURA</Text>
          <Fichas opcoes={CULTURAS} valor={f.cultura} onChange={(v) => { setF({ ...f, cultura: v }); setSalvo(false); }} />
          <Campo rotulo="Safra" value={f.safra} onChangeText={(v) => { setF({ ...f, safra: v }); setSalvo(false); }} />
          <Campo rotulo="Observações" value={f.obs} onChangeText={(v) => { setF({ ...f, obs: v }); setSalvo(false); }} multiline placeholder="Solo, variedade, histórico…" />
          <Botao titulo={salvo ? 'Salvo ✓' : 'Salvar alterações'} onPress={() => { atualizarTalhao(x.id, { ...f, nome: f.nome.trim() || x.nome }); setSalvo(true); mostrar('Alterações salvas', 'ok'); }} />
        </Cartao>

        <Cartao style={{ gap: 8 }}>
          <Text style={[tipo.legenda, { color: t.textoSuave }]}>EM OUTRAS UNIDADES</Text>
          {OUTRAS.map((u) => (
            <View key={u} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[tipo.corpo, { color: t.textoSuave }]}>{ROTULO_AREA[u]}</Text>
              <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.texto }}>
                {converterArea(m2, u).toLocaleString('pt-BR', { maximumFractionDigits: u === 'm2' ? 0 : 2, minimumFractionDigits: u === 'm2' ? 0 : 2 })}
              </Text>
            </View>
          ))}
          <Text style={[tipo.corpo, { color: t.textoSuave, marginTop: 4 }]}>{x.contorno.length} vértices</Text>
        </Cartao>

        <Cartao style={{ gap: 10 }}>
          <Text style={[tipo.legenda, { color: t.textoSuave }]}>EXPORTAR ESTE TALHÃO</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Botao titulo="KML" variante="suave" onPress={() => baixar(`${x.nome}.kml`, paraKML([x]), 'application/vnd.google-earth.kml+xml')} />
            <Botao titulo="GeoJSON" variante="suave" onPress={() => baixar(`${x.nome}.geojson`, paraGeoJSON([x]), 'application/geo+json')} />
            <Botao titulo="GPX" variante="suave" onPress={() => baixar(`${x.nome}.gpx`, paraGPX([x]), 'application/gpx+xml')} />
          </View>
        </Cartao>

        <Botao titulo="Excluir talhão" variante="perigo" onPress={apagar} />
      </Animated.View>
    </ScrollView>
  );
}
