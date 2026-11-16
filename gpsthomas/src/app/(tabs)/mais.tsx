import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Tela } from '../../components/Tela';
import { Cartao } from '../../components/Cartao';
import { usePrefs } from '../../store/prefs';
import { ROTULO_AREA, type UnidadeArea } from '../../geo/unidades';
import { fonte, raio, tipo, useTema } from '../../theme';

const UNIDADES: UnidadeArea[] = ['ha', 'alqPaulista', 'alqMineiro', 'alqGoiano', 'alqBaiano', 'm2'];

export default function MaisTela() {
  const t = useTema();
  const { unidadeArea, definirUnidadeArea } = usePrefs();
  return (
    <Tela titulo="Mais" subtitulo="Ajustes do GPSThomas">
      <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 6 }]}>UNIDADE DE ÁREA</Text>
      <Cartao style={{ padding: 6 }}>
        {UNIDADES.map((u, i) => {
          const ativo = u === unidadeArea;
          return (
            <Pressable
              key={u}
              onPress={() => { Haptics.selectionAsync(); definirUnidadeArea(u); }}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 14, paddingHorizontal: 14, borderRadius: raio.md,
                backgroundColor: ativo ? t.primariaSuave : 'transparent',
                marginTop: i ? 2 : 0,
              }}
            >
              <Text style={{ fontFamily: ativo ? fonte.semi : fonte.regular, fontSize: 16, color: t.texto }}>{ROTULO_AREA[u]}</Text>
              {ativo ? <Ionicons name="checkmark-circle" size={22} color={t.primaria} /> : <View />}
            </Pressable>
          );
        })}
      </Cartao>
      <Text style={[tipo.corpo, { color: t.textoSuave, textAlign: 'center', marginTop: 8 }]}>GPSThomas · versão 0.1 (Fase 1)</Text>
    </Tela>
  );
}
