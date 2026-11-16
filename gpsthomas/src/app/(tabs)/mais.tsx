import { useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Tela } from '../../components/Tela';
import { Cartao } from '../../components/Cartao';
import { Botao } from '../../components/Botao';
import { useDados } from '../../store/dados';
import { usePrefs } from '../../store/prefs';
import { ROTULO_AREA, type UnidadeArea } from '../../geo/unidades';
import { lerArquivo, paraCSV, paraGeoJSON, paraGPX, paraKML } from '../../io/formatos';
import { entregarArquivo, escolherArquivo } from '../../io/arquivos';
import { fonte, raio, tipo, useTema } from '../../theme';

const UNIDADES: UnidadeArea[] = ['ha', 'alqPaulista', 'alqMineiro', 'alqGoiano', 'alqBaiano', 'm2'];

function confirmar(msg: string, ok: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(msg)) ok(); }
  else Alert.alert('Confirmar', msg, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: ok }]);
}

export default function MaisTela() {
  const t = useTema();
  const { unidadeArea, definirUnidadeArea } = usePrefs();
  const { talhoes, medicoes, adicionarTalhao, adicionarMedicao, limparTudo } = useDados();
  const [msg, setMsg] = useState<string | null>(null);

  const importar = async () => {
    const f = await escolherArquivo();
    if (!f) return;
    const r = lerArquivo(f.texto);
    r.poligonos.forEach((p) => adicionarTalhao({ nome: p.nome, fazenda: 'Importado', cultura: 'Soja', safra: '2026/27', contorno: p.pontos }));
    r.linhas.forEach((l) => adicionarMedicao({ tipo: 'linha', nome: l.nome, pontos: l.pontos, origem: 'importado' }));
    setMsg(r.poligonos.length + r.linhas.length === 0 ? 'Nenhuma área ou linha encontrada. Use GeoJSON, KML ou GPX.' : `Importado de ${f.nome}: ${r.poligonos.length} talhões e ${r.linhas.length} linhas.`);
  };

  const exportar = (ext: 'geojson' | 'kml' | 'gpx' | 'csv') => {
    const nome = `gpsthomas-${new Date().toISOString().slice(0, 10)}.${ext}`;
    if (ext === 'geojson') entregarArquivo(nome, paraGeoJSON(talhoes, medicoes), 'application/geo+json');
    if (ext === 'kml') entregarArquivo(nome, paraKML(talhoes, medicoes), 'application/vnd.google-earth.kml+xml');
    if (ext === 'gpx') entregarArquivo(nome, paraGPX(talhoes, medicoes), 'application/gpx+xml');
    if (ext === 'csv') entregarArquivo(nome, paraCSV(talhoes), 'text/csv');
  };

  const vazio = talhoes.length + medicoes.length === 0;

  return (
    <Tela titulo="Mais" subtitulo="Arquivos, unidades e ajustes">
      <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 6 }]}>ARQUIVOS</Text>
      <Cartao style={{ gap: 12 }}>
        <Text style={[tipo.corpo, { color: t.textoSuave }]}>Traga áreas do Google Earth, QGIS ou do monitor da máquina e leve suas medições para eles.</Text>
        <Botao titulo="Importar KML / GeoJSON / GPX" variante="suave" icone={<Ionicons name="download-outline" size={19} color={t.primaria} />} onPress={importar} />
        <Text style={[tipo.legenda, { color: t.textoSuave }]}>EXPORTAR TUDO ({talhoes.length} talhões · {medicoes.length} medições)</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(['kml', 'geojson', 'gpx', 'csv'] as const).map((e) => (
            <Botao key={e} titulo={e.toUpperCase()} variante="suave" desabilitado={vazio} onPress={() => exportar(e)} />
          ))}
        </View>
        {msg && <Text style={[tipo.corpo, { color: t.primaria }]}>{msg}</Text>}
      </Cartao>

      <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 6 }]}>UNIDADE DE ÁREA</Text>
      <Cartao style={{ padding: 6 }}>
        {UNIDADES.map((u, i) => {
          const ativo = u === unidadeArea;
          return (
            <Pressable
              key={u}
              onPress={() => { Haptics.selectionAsync(); definirUnidadeArea(u); }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 14, borderRadius: raio.md, backgroundColor: ativo ? t.primariaSuave : 'transparent', marginTop: i ? 2 : 0 }}
            >
              <Text style={{ fontFamily: ativo ? fonte.semi : fonte.regular, fontSize: 16, color: t.texto }}>{ROTULO_AREA[u]}</Text>
              {ativo ? <Ionicons name="checkmark-circle" size={22} color={t.primaria} /> : <View />}
            </Pressable>
          );
        })}
      </Cartao>

      <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 6 }]}>DADOS</Text>
      <Cartao style={{ gap: 10 }}>
        <Text style={[tipo.corpo, { color: t.textoSuave }]}>Tudo fica salvo neste aparelho. Exporte um arquivo para fazer backup.</Text>
        <Botao titulo="Apagar todos os dados" variante="perigo" desabilitado={vazio} onPress={() => confirmar('Apagar todos os talhões e medições deste aparelho?', limparTudo)} />
      </Cartao>
      <Text style={[tipo.corpo, { color: t.textoSuave, textAlign: 'center', marginTop: 4 }]}>GPSThomas · versão 0.2</Text>
    </Tela>
  );
}
