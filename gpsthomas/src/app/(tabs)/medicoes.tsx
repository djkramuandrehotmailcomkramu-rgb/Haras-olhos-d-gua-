import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tela } from '../../components/Tela';
import { Cartao } from '../../components/Cartao';
import { Botao } from '../../components/Botao';
import { tipo, useTema } from '../../theme';

export default function MedicoesTela() {
  const t = useTema();
  return (
    <Tela titulo="Medições" subtitulo="Histórico de áreas e distâncias">
      <Cartao style={{ alignItems: 'center', gap: 10, paddingVertical: 36 }}>
        <Ionicons name="analytics-outline" size={44} color={t.primaria} />
        <Text style={[tipo.subtitulo, { color: t.texto }]}>Nenhuma medição ainda</Text>
        <Text style={[tipo.corpo, { color: t.textoSuave, textAlign: 'center' }]}>
          Caminhe o perímetro ou marque pontos no mapa para criar a primeira.
        </Text>
        <View style={{ marginTop: 8 }}>
          <Botao titulo="Nova medição" icone={<Ionicons name="add" size={20} color={t.sobrePrimaria} />} />
        </View>
      </Cartao>
    </Tela>
  );
}
