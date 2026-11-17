import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Tela } from '../../components/Tela';
import { Cartao } from '../../components/Cartao';
import { Ilustracao } from '../../components/Ilustracao';
import { Botao } from '../../components/Botao';
import { useDados } from '../../store/dados';
import { areaM2 } from '../../geo/medidas';
import { formatarArea } from '../../geo/unidades';
import { usePrefs } from '../../store/prefs';
import { fonte, raio, tipo, useTema } from '../../theme';

export default function TalhoesTela() {
  const t = useTema();
  const unidade = usePrefs((s) => s.unidadeArea);
  const talhoes = useDados((s) => s.talhoes);
  const campos = useDados((s) => s.campos);
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? talhoes.filter((x) => `${x.nome} ${x.fazenda} ${x.cultura}`.toLowerCase().includes(q)) : talhoes;
  }, [talhoes, busca]);

  const porFazenda = useMemo(() => {
    const m = new Map<string, typeof talhoes>();
    filtrados.forEach((x) => m.set(x.fazenda, [...(m.get(x.fazenda) ?? []), x]));
    return [...m.entries()];
  }, [filtrados]);

  const totalM2 = talhoes.reduce((s, x) => s + areaM2(x.contorno), 0);

  return (
    <Tela titulo="Talhões" subtitulo={talhoes.length ? `${talhoes.length} áreas · ${formatarArea(totalM2, unidade)} no total` : 'Suas áreas medidas, por fazenda e safra'}>
      {talhoes.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.cartao, borderRadius: raio.pilula, paddingHorizontal: 14, height: 44, gap: 8 }}>
          <Ionicons name="search" size={18} color={t.textoSuave} />
          <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar talhão, fazenda ou cultura" placeholderTextColor={t.textoSuave} style={{ flex: 1, fontFamily: fonte.regular, fontSize: 15, color: t.texto, outlineWidth: 0 } as any} />
        </View>
      )}

      {talhoes.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 6 }]}>CAMPOS DE SEMENTES</Text>
          {campos.map((c) => (
            <Pressable key={c.id} onPress={() => router.push(`/campo/${c.id}`)}>
              <Cartao style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 46, height: 46, borderRadius: raio.md, backgroundColor: t.primariaSuave, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="flag" size={22} color={t.primaria} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[tipo.subtitulo, { color: t.texto }]}>{c.nome}</Text>
                  <Text style={[tipo.corpo, { color: t.textoSuave }]}>{c.partes.length} partes · {c.bandeiras.filter((b) => b.colocada).length}/{c.bandeiras.length} bandeiras</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={t.textoSuave} />
              </Cartao>
            </Pressable>
          ))}
          <Botao titulo="Novo campo de sementes" variante="suave" icone={<Ionicons name="flag-outline" size={19} color={t.primaria} />} onPress={() => router.push('/campo/novo')} />
        </View>
      )}

      {talhoes.length === 0 && (
        <Cartao style={{ alignItems: 'center', gap: 10, paddingVertical: 36 }}>
          <Ilustracao tamanho={150} />
          <Text style={[tipo.subtitulo, { color: t.texto }]}>Nenhum talhão ainda</Text>
          <Text style={[tipo.corpo, { color: t.textoSuave, textAlign: 'center' }]}>Meça uma área no mapa e salve como talhão, ou importe um arquivo KML/GeoJSON em Mais.</Text>
          <View style={{ marginTop: 8 }}><Botao titulo="Medir no mapa" onPress={() => router.navigate('/')} /></View>
        </Cartao>
      )}

      {porFazenda.map(([fazenda, lista], gi) => (
        <View key={fazenda} style={{ gap: 10 }}>
          <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 6 }]}>{fazenda.toUpperCase()}</Text>
          {lista.map((x, i) => (
            <View key={x.id}>
              <Pressable onPress={() => router.push(`/talhao/${x.id}`)}>
                <Cartao style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 46, height: 46, borderRadius: raio.md, backgroundColor: t.primariaSuave, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="leaf" size={22} color={t.primaria} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[tipo.subtitulo, { color: t.texto }]} numberOfLines={1}>{x.nome}</Text>
                    <Text style={[tipo.corpo, { color: t.textoSuave }]} numberOfLines={1}>{x.cultura} · safra {x.safra}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: fonte.negrito, fontSize: 17, color: t.primaria }}>{formatarArea(areaM2(x.contorno), unidade)}</Text>
                    <Ionicons name="chevron-forward" size={16} color={t.textoSuave} />
                  </View>
                </Cartao>
              </Pressable>
            </View>
          ))}
        </View>
      ))}
    </Tela>
  );
}
