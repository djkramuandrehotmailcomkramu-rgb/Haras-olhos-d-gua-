import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Tela } from '../../components/Tela';
import { Cartao } from '../../components/Cartao';
import { Ilustracao } from '../../components/Ilustracao';
import { Botao } from '../../components/Botao';
import { FolhaSalvar, type DadosTalhao } from '../../components/FolhaSalvar';
import { useDados, useUi, type Medicao } from '../../store/dados';
import { areaM2, comprimentoM, perimetroM } from '../../geo/medidas';
import { formatarArea, formatarDistancia } from '../../geo/unidades';
import { paraGeoJSON, paraKML, paraGPX } from '../../io/formatos';
import { entregarArquivo } from '../../io/arquivos';
import { usePrefs } from '../../store/prefs';
import { useToast } from '../../store/toast';
import { fonte, tipo, useTema } from '../../theme';

const quando = (ms: number) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function MedicoesTela() {
  const t = useTema();
  const unidade = usePrefs((s) => s.unidadeArea);
  const { medicoes, talhoes, removerMedicao, adicionarTalhao } = useDados();
  const enviar = useUi((s) => s.enviar);
  const mostrar = useToast((s) => s.mostrar);
  const baixar = (n: string, c: string, m: string) => { entregarArquivo(n, c, m); mostrar('Arquivo exportado', 'ok'); };
  const [aberta, setAberta] = useState<string | null>(null);
  const [converter, setConverter] = useState<Medicao | null>(null);

  const valor = (m: Medicao) => (m.tipo === 'area' ? formatarArea(areaM2(m.pontos), unidade) : formatarDistancia(comprimentoM(m.pontos)));
  const fazendas = [...new Set(talhoes.map((x) => x.fazenda))];

  return (
    <Tela titulo="Medições" subtitulo={medicoes.length ? `${medicoes.length} salvas neste aparelho` : 'Histórico de áreas e distâncias'}>
      {medicoes.length === 0 && (
        <Cartao style={{ alignItems: 'center', gap: 10, paddingVertical: 36 }}>
          <Ilustracao tamanho={150} />
          <Text style={[tipo.subtitulo, { color: t.texto }]}>Nenhuma medição ainda</Text>
          <Text style={[tipo.corpo, { color: t.textoSuave, textAlign: 'center' }]}>Caminhe o perímetro, marque pontos ou meça uma distância no mapa e toque em Salvar.</Text>
          <View style={{ marginTop: 8 }}><Botao titulo="Nova medição" icone={<Ionicons name="add" size={20} color={t.sobrePrimaria} />} onPress={() => router.navigate('/')} /></View>
        </Cartao>
      )}

      {medicoes.map((m, i) => {
        const ab = aberta === m.id;
        return (
          <View key={m.id}>
            <Pressable onPress={() => setAberta(ab ? null : m.id)}>
              <Cartao style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: t.primariaSuave, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={m.tipo === 'area' ? 'shapes' : 'git-commit'} size={20} color={t.primaria} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[tipo.subtitulo, { color: t.texto }]} numberOfLines={1}>{m.nome}</Text>
                    <Text style={[tipo.legenda, { color: t.textoSuave }]}>{quando(m.criadoEm)} · {m.origem === 'gps' ? 'caminhada GPS' : m.origem === 'importado' ? 'importado' : 'pontos no mapa'}</Text>
                  </View>
                  <Text style={{ fontFamily: fonte.negrito, fontSize: 16, color: t.primaria }}>{valor(m)}</Text>
                </View>
                {ab && (
                  <View style={{ gap: 10 }}>
                    {m.tipo === 'area' && <Text style={[tipo.corpo, { color: t.textoSuave }]}>Perímetro {formatarDistancia(perimetroM(m.pontos))} · {m.pontos.length} pontos</Text>}
                    {m.tipo === 'linha' && <Text style={[tipo.corpo, { color: t.textoSuave }]}>{m.pontos.length} pontos</Text>}
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <Botao titulo="Ver no mapa" variante="suave" onPress={() => { enviar({ tipo: 'ajustar', pontos: m.pontos }); router.navigate('/'); }} />
                      {m.tipo === 'area' && <Botao titulo="Virar talhão" variante="suave" onPress={() => setConverter(m)} />}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <Botao titulo="KML" variante="fantasma" onPress={() => baixar(`${m.nome}.kml`, paraKML([], [m]), 'application/vnd.google-earth.kml+xml')} />
                      <Botao titulo="GeoJSON" variante="fantasma" onPress={() => baixar(`${m.nome}.geojson`, paraGeoJSON([], [m]), 'application/geo+json')} />
                      <Botao titulo="GPX" variante="fantasma" onPress={() => baixar(`${m.nome}.gpx`, paraGPX([], [m]), 'application/gpx+xml')} />
                      <Botao titulo="Excluir" variante="fantasma" onPress={() => removerMedicao(m.id)} />
                    </View>
                  </View>
                )}
              </Cartao>
            </Pressable>
          </View>
        );
      })}

      <FolhaSalvar
        visivel={!!converter}
        podeTalhao
        resumo={converter ? valor(converter) : ''}
        fazendas={fazendas}
        onFechar={() => setConverter(null)}
        onTalhao={(d: DadosTalhao) => {
          if (converter) {
            const id = adicionarTalhao({ ...d, contorno: converter.pontos });
            removerMedicao(converter.id);
            setConverter(null);
            router.push(`/talhao/${id}`);
          }
        }}
        onMedicao={() => setConverter(null)}
      />
    </Tela>
  );
}
