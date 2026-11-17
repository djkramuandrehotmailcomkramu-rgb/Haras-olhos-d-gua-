import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { fonte, raio, tipo, useTema } from '../theme';

type Props = { rotulo: string; compacto?: boolean } & TextInputProps;

/** Campo de texto/número. `compacto` reduz a altura e esconde o rótulo (use com accessibilityLabel). */
export function Campo({ rotulo, compacto, style, accessibilityLabel, ...rest }: Props) {
  const t = useTema();
  return (
    <View style={{ gap: 6 }}>
      {rotulo ? <Text style={[tipo.legenda, { color: t.textoSuave }]}>{rotulo.toUpperCase()}</Text> : null}
      <TextInput
        placeholderTextColor={t.textoSuave}
        accessibilityLabel={accessibilityLabel ?? (rotulo || undefined)}
        selectTextOnFocus
        {...rest}
        style={[
          {
            fontFamily: fonte.regular, fontSize: 16, color: t.texto, backgroundColor: t.cartaoSuave,
            borderRadius: raio.md, paddingHorizontal: 14, height: compacto ? 44 : 48, outlineWidth: 0,
            fontVariant: rest.keyboardType === 'decimal-pad' || rest.keyboardType === 'numeric' ? ['tabular-nums'] : undefined,
          } as any,
          style,
        ]}
      />
    </View>
  );
}
