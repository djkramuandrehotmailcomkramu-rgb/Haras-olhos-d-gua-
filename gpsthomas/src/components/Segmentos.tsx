import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { fonte, useTema } from '../theme';

/** Controle segmentado do iOS: opções lado a lado que dividem a largura (nunca cortam); ótimo para 2 a 5 escolhas curtas. */
export function Segmentos({ opcoes, valor, onChange }: { opcoes: string[]; valor: string; onChange: (v: string) => void }) {
  const t = useTema();
  return (
    <View role="group" style={{ flexDirection: 'row', backgroundColor: t.cartaoSuave, borderRadius: 10, padding: 2 }}>
      {opcoes.map((o) => {
        const ativo = o === valor;
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityLabel={o}
            accessibilityState={{ selected: ativo }}
            onPress={() => { Haptics.selectionAsync(); onChange(o); }}
            style={{ flex: 1, minHeight: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, backgroundColor: ativo ? t.cartao : 'transparent', borderWidth: ativo ? 0.5 : 0, borderColor: t.linha, shadowColor: '#000', shadowOpacity: ativo ? 0.1 : 0, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}
          >
            <Text numberOfLines={1} style={{ fontFamily: ativo ? fonte.semi : fonte.media, fontSize: 14, letterSpacing: -0.2, color: ativo ? t.texto : t.textoSuave }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
