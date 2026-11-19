import { Children, Fragment, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fonte, raio, tipo, useTema } from '../theme';

/** Grupo de linhas no estilo "Ajustes" do iOS: cantos suaves e divisórias finas. */
export function Grupo({ titulo, rodape, children }: { titulo?: string; rodape?: string; children: ReactNode }) {
  const t = useTema();
  const itens = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: 6 }}>
      {titulo ? <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 16, textTransform: 'uppercase' }]}>{titulo}</Text> : null}
      <View style={{ backgroundColor: t.cartao, borderRadius: raio.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: t.linha }}>
        {itens.map((c, i) => (
          <Fragment key={(c as any)?.key ?? i}>
            {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.linha, marginLeft: 16 }} />}
            {c}
          </Fragment>
        ))}
      </View>
      {rodape ? <Text style={[tipo.legenda, { color: t.textoSuave, marginHorizontal: 16 }]}>{rodape}</Text> : null}
    </View>
  );
}

type PropsLinha = {
  titulo: string;
  subtitulo?: string;
  valor?: string;
  icone?: keyof typeof Ionicons.glyphMap;
  /** cor do quadradinho do ícone (estilo Ajustes do iPhone) */
  corIcone?: string;
  onPress?: () => void;
  perigo?: boolean;
  /** mostra a setinha > (padrão quando é clicável) */
  seta?: boolean;
  direita?: ReactNode;
  desabilitado?: boolean;
  acessibilidade?: string;
};

/** Linha de lista de 52 px: ícone colorido, título, valor e setinha. Toda a linha é clicável. */
export function Linha({ titulo, subtitulo, valor, icone, corIcone, onPress, perigo, seta, direita, desabilitado, acessibilidade }: PropsLinha) {
  const t = useTema();
  const clicavel = !!onPress;
  const conteudo = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: subtitulo ? 60 : 52, paddingHorizontal: 16, paddingVertical: 8 }}>
      {icone && (
        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: perigo ? t.perigo : corIcone ?? t.primaria, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icone} size={18} color="#fff" />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonte.regular, fontSize: 17, letterSpacing: -0.3, color: perigo ? t.perigo : t.texto }}>{titulo}</Text>
        {subtitulo ? <Text numberOfLines={2} style={{ fontFamily: fonte.regular, fontSize: 13.5, letterSpacing: -0.1, color: t.textoSuave, marginTop: 1 }}>{subtitulo}</Text> : null}
      </View>
      {valor ? <Text numberOfLines={1} style={{ fontFamily: fonte.regular, fontSize: 16, color: t.textoSuave, maxWidth: '45%' }}>{valor}</Text> : null}
      {direita}
      {(seta ?? clicavel) && !direita ? <Ionicons name="chevron-forward" size={18} color={t.textoSuave} style={{ opacity: 0.6 }} /> : null}
    </View>
  );
  if (!clicavel) return conteudo;
  return (
    <Pressable
      disabled={desabilitado}
      accessibilityRole="button"
      accessibilityLabel={acessibilidade ?? titulo}
      onPress={() => { Haptics.selectionAsync(); onPress?.(); }}
      style={({ pressed }) => ({ backgroundColor: pressed ? t.cartaoSuave : 'transparent', opacity: desabilitado ? 0.4 : 1 })}
    >
      {conteudo}
    </Pressable>
  );
}
