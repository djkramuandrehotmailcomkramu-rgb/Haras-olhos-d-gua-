import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { fonte, raio, useTema } from '../theme';

/** Opções lado a lado que dividem a largura (nunca cortam): ótimo para 2 a 4 escolhas curtas. */
export function Segmentos({ opcoes, valor, onChange }: { opcoes: string[]; valor: string; onChange: (v: string) => void }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {opcoes.map((o) => {
        const ativo = o === valor;
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityLabel={o}
            accessibilityState={{ selected: ativo }}
            onPress={() => { Haptics.selectionAsync(); onChange(o); }}
            style={{ flex: 1, height: 40, borderRadius: raio.pilula, alignItems: 'center', justifyContent: 'center', backgroundColor: ativo ? t.primaria : t.cartaoSuave }}
          >
            <Text style={{ fontFamily: fonte.semi, fontSize: 14, color: ativo ? t.sobrePrimaria : t.texto }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
