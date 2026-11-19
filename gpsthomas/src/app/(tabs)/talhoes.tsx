import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Tela } from '../../components/Tela';
import { Cartao } from '../../components/Cartao';
import { Grupo, Linha } from '../../components/Lista';
import { Segmentos } from '../../components/Segmentos';
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
  const [limite, setLimite] = useState(30);
  const [aba, setAba] = useState('Talhões');

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? talhoes.filter((x) => `${x.nome} ${x.fazenda} ${x.cultura}`.toLowerCase().includes(q)) : talhoes;
  }, [talhoes, busca]);

  const porFazenda = useMemo(() => {
    const m = new Map<string, typeof talhoes>();
    filtrados.slice(0, limite).forEach((x) => m.set(x.fazenda, [...(m.get(x.fazenda) ?? []), x]));
    return [...m.entries()];
  }, [filtrados, limite]);

  const totalM2 = talhoes.reduce((s, x) => s + areaM2(x.contorno), 0);

  return (
    <Tela titulo="Talhões" subtitulo={talhoes.length ? `${talhoes.length} áreas · ${formatarArea(totalM2, unidade)} no total` : 'Suas áreas medidas, por fazenda e safra'}>
      {aba === 'Talhões' && talhoes.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.cartao, borderRadius: raio.pilula, paddingHorizontal: 14, height: 44, gap: 8 }}>
          <Ionicons name="search" size={18} color={t.textoSuave} />
          <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar talhão, fazenda ou cultura" placeholderTextColor={t.textoSuave} style={{ flex: 1, fontFamily: fonte.regular, fontSize: 15, color: t.texto, outlineWidth: 0 } as any} />
        </View>
      )}

      <Segmentos opcoes={['Talhões', 'Campos de sementes']} valor={aba} onChange={setAba} />

      {aba === 'Campos de sementes' && (
        <>
          <Grupo>
            {campos.map((c) => (
              <Linha key={c.id} titulo={c.nome} subtitulo={`${c.partes.length} partes · ${c.bandeiras.filter((b) => b.colocada).length}/${c.bandeiras.length} bandeiras`} icone="flag" onPress={() => router.push(`/campo/${c.id}`)} />
            ))}
            <Linha titulo="Novo campo de sementes" icone="add" corIcone="#8E8E93" onPress={() => router.push('/campo/novo')} />
          </Grupo>
          <Grupo>
            <Linha titulo="Medições salvas" subtitulo="Distâncias e áreas medidas no mapa" icone="analytics" corIcone="#FF9F0A" onPress={() => router.push('/medicoes')} />
          </Grupo>
        </>
      )}

      {aba === 'Talhões' && talhoes.length === 0 && (
        <Cartao style={{ alignItems: 'center', gap: 10, paddingVertical: 36 }}>
          <Ilustracao tamanho={150} />
          <Text style={[tipo.subtitulo, { color: t.texto }]}>Nenhum talhão ainda</Text>
          <Text style={[tipo.corpo, { color: t.textoSuave, textAlign: 'center' }]}>Meça uma área no mapa e salve como talhão, ou importe um arquivo KML/GeoJSON em Mais.</Text>
          <View style={{ marginTop: 8 }}><Botao titulo="Medir no mapa" onPress={() => router.navigate('/')} /></View>
        </Cartao>
      )}

      {aba === 'Talhões' && porFazenda.map(([fazenda, lista]) => (
        <Grupo key={fazenda} titulo={fazenda}>
          {lista.map((x) => (
            <Linha key={x.id} titulo={x.nome} subtitulo={`${x.cultura} · safra ${x.safra}`} icone="leaf" valor={formatarArea(areaM2(x.contorno), unidade)} onPress={() => router.push(`/talhao/${x.id}`)} />
          ))}
        </Grupo>
      ))}
      {aba === 'Talhões' && filtrados.length > limite && <Botao titulo={`Mostrar mais (${filtrados.length - limite})`} variante="suave" onPress={() => setLimite((l) => l + 30)} />}
      {talhoes.length > 0 && filtrados.length === 0 && <Text style={[tipo.corpo, { color: t.textoSuave, textAlign: 'center' }]}>Nenhum talhão encontrado para "{busca}".</Text>}
    </Tela>
  );
}
