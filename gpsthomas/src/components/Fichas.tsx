import { Pressable, ScrollView, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { fonte, raio, useTema } from '../theme';

/** Linha de opções rápidas (chips) com seleção única. */
export function Fichas({ opcoes, valor, onChange }: { opcoes: string[]; valor: string; onChange: (v: string) => void }) {
  const t = useTema();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {opcoes.map((o) => {
        const ativo = o === valor;
        return (
          <Pressable
            key={o}
            onPress={() => { Haptics.selectionAsync(); onChange(o); }}
            style={{ paddingHorizontal: 14, height: 36, borderRadius: raio.pilula, justifyContent: 'center', backgroundColor: ativo ? t.primaria : t.cartaoSuave }}
          >
            <Text style={{ fontFamily: fonte.semi, fontSize: 14, color: ativo ? t.sobrePrimaria : t.texto }}>{o}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
