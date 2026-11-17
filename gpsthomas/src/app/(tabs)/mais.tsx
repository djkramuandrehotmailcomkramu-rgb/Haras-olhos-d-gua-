import { useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Tela } from '../../components/Tela';
import { Campo } from '../../components/Campo';
import { Cartao } from '../../components/Cartao';
import { Botao } from '../../components/Botao';
import { useDados } from '../../store/dados';
import { usePrefs } from '../../store/prefs';
import { useToast } from '../../store/toast';
import { IconeVeiculo } from '../../components/IconeVeiculo';
import { VEICULOS } from '../../components/veiculos';
import { formatarDistancia } from '../../geo/unidades';
import { formatarDuracao } from '../../nav/progresso';
import { ROTULO_AREA, type UnidadeArea } from '../../geo/unidades';
import { lerArquivo, paraCSV, paraGeoJSON, paraGPX, paraKML } from '../../io/formatos';
import { entregarArquivo, escolherArquivo } from '../../io/arquivos';
import { areaM2 } from '../../geo/medidas';
import { fonte, raio, tipo, useTema } from '../../theme';

const UNIDADES: UnidadeArea[] = ['ha', 'alqPaulista', 'alqMineiro', 'alqGoiano', 'alqBaiano', 'm2'];

function confirmar(msg: string, ok: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(msg)) ok(); }
  else Alert.alert('Confirmar', msg, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: ok }]);
}

export default function MaisTela() {
  const t = useTema();
  const { unidadeArea, definirUnidadeArea, veiculo, definirVeiculo } = usePrefs();
  const viagens = useDados((x) => x.viagens);
  const { talhoes, medicoes, adicionarTalhao, adicionarMedicao, limparTudo } = useDados();
  const [msg, setMsg] = useState<string | null>(null);
  const [fazendaImport, setFazendaImport] = useState('');
  const [resumo, setResumo] = useState<{ nome: string; m2: number }[]>([]);
  const [importando, setImportando] = useState(false);
  const mostrar = useToast((s) => s.mostrar);

  const importar = async () => {
    setImportando(true);
    const f = await escolherArquivo();
    setImportando(false);
    if (!f) return;
    const r = lerArquivo(f.texto);
    r.poligonos.forEach((p) => adicionarTalhao({ nome: p.nome, fazenda: fazendaImport.trim() || 'Importado', cultura: 'Soja', safra: '2026/27', contorno: p.pontos }));
    setResumo(r.poligonos.map((p) => ({ nome: p.nome, m2: areaM2(p.pontos) })));
    (r.avisos ?? []).forEach((a) => mostrar(a, 'info'));
    r.linhas.forEach((l) => adicionarMedicao({ tipo: 'linha', nome: l.nome, pontos: l.pontos, origem: 'importado' }));
    const vazio0 = r.poligonos.length + r.linhas.length === 0;
    const m = vazio0 ? 'Nenhuma área ou linha encontrada. Use GeoJSON, KML ou GPX.' : `Importado: ${r.poligonos.length} talhões e ${r.linhas.length} linhas`;
    setMsg(m);
    mostrar(m, vazio0 ? 'erro' : 'ok');
  };

  const exportar = (ext: 'geojson' | 'kml' | 'gpx' | 'csv') => {
    const nome = `gpsthomas-${new Date().toISOString().slice(0, 10)}.${ext}`;
    if (ext === 'geojson') entregarArquivo(nome, paraGeoJSON(talhoes, medicoes), 'application/geo+json');
    if (ext === 'kml') entregarArquivo(nome, paraKML(talhoes, medicoes), 'application/vnd.google-earth.kml+xml');
    if (ext === 'gpx') entregarArquivo(nome, paraGPX(talhoes, medicoes), 'application/gpx+xml');
    if (ext === 'csv') entregarArquivo(nome, paraCSV(talhoes), 'text/csv');
    mostrar('Arquivo exportado', 'ok');
  };

  const vazio = talhoes.length + medicoes.length === 0;

  return (
    <Tela titulo="Mais" subtitulo="Arquivos, unidades e ajustes">
      <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 6 }]}>ARQUIVOS</Text>
      <Cartao style={{ gap: 12 }}>
        <Text style={[tipo.corpo, { color: t.textoSuave }]}>Traga áreas do Google Earth, QGIS ou do monitor da máquina e leve suas medições para eles.</Text>
        <Campo rotulo="Nome da fazenda dos talhões importados" value={fazendaImport} onChangeText={setFazendaImport} placeholder="Ex.: Lagoa Formosa" />
        <Botao titulo="Importar KML / KMZ / GeoJSON / GPX" variante="suave" carregando={importando} icone={<Ionicons name="download-outline" size={19} color={t.primaria} />} onPress={importar} />
        {resumo.length > 0 && (
          <View style={{ gap: 4 }}>
            <Text style={[tipo.legenda, { color: t.textoSuave }]}>ÁREAS MEDIDAS NO ARQUIVO IMPORTADO</Text>
            {resumo.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text numberOfLines={1} style={{ fontFamily: fonte.regular, fontSize: 15, color: t.texto, flex: 1 }}>{r.nome}</Text>
                <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.primaria }}>{(r.m2 / 10000).toFixed(2).replace('.', ',')} ha</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={[tipo.legenda, { color: t.textoSuave }]}>EXPORTAR TUDO ({talhoes.length} talhões · {medicoes.length} medições)</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(['kml', 'geojson', 'gpx', 'csv'] as const).map((e) => (
            <Botao key={e} titulo={e.toUpperCase()} variante="suave" desabilitado={vazio} onPress={() => exportar(e)} />
          ))}
        </View>
      </Cartao>

      <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 6 }]}>MEU VEÍCULO</Text>
      <Cartao style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10 }}>
        {VEICULOS.map((v) => {
          const sel = v.id === veiculo;
          return (
            <Pressable key={v.id} onPress={() => { Haptics.selectionAsync(); definirVeiculo(v.id); }} style={{ alignItems: 'center', gap: 2, paddingVertical: 8, paddingHorizontal: 10, borderRadius: raio.md, backgroundColor: sel ? t.primariaSuave : 'transparent' }}>
              <IconeVeiculo tipo={v.id} cor={t.primaria} tamanho={48} />
              <Text style={{ fontFamily: sel ? fonte.semi : fonte.regular, fontSize: 12.5, color: t.texto }}>{v.rotulo}</Text>
            </Pressable>
          );
        })}
      </Cartao>

      {viagens.length > 0 && (
        <>
          <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 6 }]}>VIAGENS RECENTES</Text>
          <Cartao style={{ gap: 12 }}>
            {viagens.slice(0, 5).map((v) => (
              <View key={v.id} style={{ gap: 2 }}>
                <Text numberOfLines={1} style={{ fontFamily: fonte.semi, fontSize: 15, color: t.texto }}>{v.destino}</Text>
                <Text style={[tipo.legenda, { color: t.textoSuave }]}>
                  {new Date(v.inicioMs).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {formatarDistancia(v.distanciaM)} · {formatarDuracao((v.fimMs - v.inicioMs) / 1000)} · média {Math.round(v.vmedKmh)} km/h · máx. {Math.round(v.vmaxKmh)} km/h
                </Text>
              </View>
            ))}
          </Cartao>
        </>
      )}

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
      <Text style={[tipo.legenda, { color: t.textoSuave, textAlign: 'center', marginTop: 4, lineHeight: 18 }]}>Imagens de satélite © Esri, Maxar, Earthstar Geographics · Mapa, busca e rotas © colaboradores do OpenStreetMap (Nominatim, OSRM)</Text>
      <Text style={[tipo.corpo, { color: t.textoSuave, textAlign: 'center' }]}>GPSThomas · versão 0.6</Text>
    </Tela>
  );
}
