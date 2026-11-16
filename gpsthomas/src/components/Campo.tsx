import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { fonte, raio, tipo, useTema } from '../theme';

export function Campo({ rotulo, ...rest }: { rotulo: string } & TextInputProps) {
  const t = useTema();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[tipo.legenda, { color: t.textoSuave }]}>{rotulo.toUpperCase()}</Text>
      <TextInput
        placeholderTextColor={t.textoSuave}
        {...rest}
        style={{
          fontFamily: fonte.regular, fontSize: 16, color: t.texto, backgroundColor: t.cartaoSuave,
          borderRadius: raio.md, paddingHorizontal: 14, height: 48, outlineWidth: 0,
        } as any}
      />
    </View>
  );
}
